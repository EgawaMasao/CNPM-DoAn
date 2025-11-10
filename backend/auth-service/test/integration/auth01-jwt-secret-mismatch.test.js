/**
 * INTEGRATION TEST: AUTH-01 - JWT Secret Mismatch Between Services
 * 
 * RISK DESCRIPTION:
 * Auth-service signs JWTs with one secret, but other services (order, payment, restaurant)
 * may use different secrets, causing authentication failures across microservices.
 * 
 * VULNERABILITY LOCATION:
 * - auth-service/utils/jwt.js (lines 3-7) - JWT signing
 * - Other services' middleware - JWT verification
 * 
 * BUSINESS IMPACT:
 * - Users cannot access other services after successful authentication
 * - Complete service outage if secrets mismatch
 * - Security risk if one service uses weak/leaked secret
 * 
 * TEST STRATEGY:
 * 1. Simulate auth-service with known JWT_SECRET
 * 2. Create tokens with different secrets
 * 3. Verify tokens fail when secrets don't match
 * 4. Document the cross-service dependency
 */

require('dotenv').config();
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Customer = require('../../models/Customer');

// Create minimal Express app simulating auth-service
const createAuthApp = (jwtSecret) => {
  const app = express();
  app.use(express.json());

  // Registration endpoint
  app.post('/api/auth/register/customer', async (req, res) => {
    try {
      const { firstName, lastName, email, phone, password } = req.body;
      
      if (!firstName || !lastName || !email || !phone || !password) {
        return res.status(400).json({ message: "Please provide all required fields." });
      }

      const existing = await Customer.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: "Email already registered." });
      }

      const customer = await Customer.create({
        firstName, lastName, email, phone, password
      });

      // Sign with the specific secret for this app instance
      const token = jwt.sign(
        { id: customer._id, role: 'customer' },
        jwtSecret,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        status: 'success',
        token,
        data: { customer: { id: customer._id, email: customer.email } }
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
      }

      const customer = await Customer.findOne({ email }).select('+password');
      if (!customer) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      const valid = await customer.comparePassword(password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      const token = jwt.sign(
        { id: customer._id, role: 'customer' },
        jwtSecret,
        { expiresIn: '7d' }
      );

      res.json({
        status: 'success',
        token,
        data: { customer: { id: customer._id, email: customer.email } }
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return app;
};

// Create app simulating order-service verification
const createOrderServiceApp = (jwtSecret) => {
  const app = express();
  app.use(express.json());

  // Protected order creation endpoint
  app.post('/api/orders', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];

      // Verify token with order-service's JWT_SECRET
      const decoded = jwt.verify(token, jwtSecret);

      res.status(201).json({
        status: 'success',
        message: 'Order created',
        userId: decoded.id,
        role: decoded.role
      });
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Token is invalid or expired.' });
      }
      res.status(500).json({ message: err.message });
    }
  });

  return app;
};

describe('RISK-AUTH-01: JWT Secret Mismatch Between Services', () => {
  let authApp, orderApp;
  
  const AUTH_SECRET = 'auth_service_secret_key_123';
  const ORDER_SECRET = 'order_service_secret_key_456'; // Different!
  
  beforeAll(async () => {
    // Clean test data
    await Customer.deleteMany({ email: /^jwt_test_/ });

    authApp = createAuthApp(AUTH_SECRET);
    orderApp = createOrderServiceApp(ORDER_SECRET);
  }, 30000);

  afterAll(async () => {
    await Customer.deleteMany({ email: /^jwt_test_/ });
  }, 30000);

  describe('Test Case 1: JWT Secret Synchronization Verification', () => {
    it('should successfully authenticate when secrets match', async () => {
      // GIVEN: Both services use the SAME secret
      const matchingAuthApp = createAuthApp('SHARED_SECRET_123');
      const matchingOrderApp = createOrderServiceApp('SHARED_SECRET_123');

      // WHEN: Register user and get token
      const registerRes = await request(matchingAuthApp)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'JWT',
          lastName: 'Match',
          email: 'jwt_test_match@test.com',
          phone: '0901111111',
          password: 'password123'
        });

      expect(registerRes.status).toBe(201);
      const token = registerRes.body.token;

      // THEN: Token should work on order-service
      const orderRes = await request(matchingOrderApp)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerId: 'test123' });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.status).toBe('success');
    });

    it('should FAIL when auth-service and order-service use different secrets', async () => {
      // GIVEN: Services use DIFFERENT secrets (THE VULNERABILITY)
      
      // WHEN: Register user with auth-service secret
      const registerRes = await request(authApp)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'JWT',
          lastName: 'Mismatch',
          email: 'jwt_test_mismatch@test.com',
          phone: '0902222222',
          password: 'password123'
        });

      expect(registerRes.status).toBe(201);
      const token = registerRes.body.token;

      // THEN: Token FAILS on order-service (different secret)
      const orderRes = await request(orderApp)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerId: 'test123' });

      expect(orderRes.status).toBe(401);
      expect(orderRes.body.message).toContain('invalid or expired');
    });
  });

  describe('Test Case 2: Cross-Service Token Validation', () => {
    let customerToken;

    beforeAll(async () => {
      // Create customer and get token from auth-service
      const res = await request(authApp)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'Cross',
          lastName: 'Service',
          email: 'jwt_test_cross@test.com',
          phone: '0903333333',
          password: 'password123'
        });
      
      customerToken = res.body.token;
    });

    it('should reject token signed with different secret', async () => {
      // GIVEN: Token signed by auth-service with AUTH_SECRET
      expect(customerToken).toBeDefined();

      // Decode without verification to see payload
      const decoded = jwt.decode(customerToken);
      expect(decoded.role).toBe('customer');

      // WHEN: Order-service tries to verify with ORDER_SECRET (different)
      const orderRes = await request(orderApp)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ customerId: decoded.id });

      // THEN: Verification fails with 401
      expect(orderRes.status).toBe(401);
      expect(orderRes.body.message).toContain('invalid or expired');
    });

    it('should demonstrate that manually created token with wrong secret fails', async () => {
      // GIVEN: Malicious token created with wrong secret
      const fakeToken = jwt.sign(
        { id: 'fake_user_123', role: 'customer' },
        'WRONG_SECRET_789',
        { expiresIn: '7d' }
      );

      // WHEN: Try to use on order-service
      const orderRes = await request(orderApp)
        .post('/api/orders')
        .set('Authorization', `Bearer ${fakeToken}`)
        .send({ customerId: 'fake_user_123' });

      // THEN: Fails verification
      expect(orderRes.status).toBe(401);
      expect(orderRes.body.message).toContain('invalid or expired');
    });
  });

  describe('Test Case 3: Secret Rotation Impact Analysis', () => {
    it('should invalidate all tokens when secret changes', async () => {
      // GIVEN: Create auth-service with initial secret
      const initialSecret = 'INITIAL_SECRET_V1';
      const authAppV1 = createAuthApp(initialSecret);
      const orderAppV1 = createOrderServiceApp(initialSecret);

      // Register and get token with V1 secret
      const registerRes = await request(authAppV1)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'Rotation',
          lastName: 'Test',
          email: 'jwt_test_rotation@test.com',
          phone: '0904444444',
          password: 'password123'
        });

      const tokenV1 = registerRes.body.token;

      // Token works with V1
      const orderResV1 = await request(orderAppV1)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenV1}`)
        .send({ customerId: 'test' });
      expect(orderResV1.status).toBe(201);

      // WHEN: Secret is rotated to V2
      const newSecret = 'ROTATED_SECRET_V2';
      const orderAppV2 = createOrderServiceApp(newSecret);

      // THEN: Old tokens become invalid
      const orderResV2 = await request(orderAppV2)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenV1}`)
        .send({ customerId: 'test' });

      expect(orderResV2.status).toBe(401);
      expect(orderResV2.body.message).toContain('invalid or expired');
    });
  });

  describe('Test Case 4: Environment Variable Misconfiguration', () => {
    it('should demonstrate risk of undefined JWT_SECRET', async () => {
      // GIVEN: Service started with undefined/empty secret
      const emptySecretApp = createAuthApp(''); // Empty secret
      const orderApp = createOrderServiceApp(process.env.JWT_SECRET);
      
      // WHEN: Try to create token
      const registerRes = await request(emptySecretApp)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'Empty',
          lastName: 'Secret',
          email: 'jwt_test_empty@test.com',
          phone: '0905555555',
          password: 'password123'
        });

      // THEN: Registration may fail or succeed with insecure token
      if (registerRes.status === 201 && registerRes.body.token) {
        const token = registerRes.body.token;
        
        // Token can be decoded to see it used empty secret
        const decoded = jwt.decode(token);
        expect(decoded.role).toBe('customer');

        // But different service can't verify it
        const orderRes = await request(orderApp)
          .post('/api/orders')
          .set('Authorization', `Bearer ${token}`)
          .send({ customerId: decoded.id });

        expect(orderRes.status).toBe(401);
        console.log('  ✗ VULNERABILITY: Service created token with empty secret');
      } else {
        // Service failed to start properly without JWT_SECRET
        console.log('  ⚠️  Service failed with empty JWT_SECRET (status:', registerRes.status, ')');
        console.log('  This is expected behavior - JWT_SECRET should be required');
        expect(registerRes.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('should show tokens from different services are incompatible', async () => {
      // GIVEN: Three services with three different secrets
      const authSecret = 'AUTH_SECRET_A';
      const orderSecret = 'ORDER_SECRET_B';
      const paymentSecret = 'PAYMENT_SECRET_C';

      const authAppA = createAuthApp(authSecret);
      const orderAppB = createOrderServiceApp(orderSecret);
      const paymentAppC = createOrderServiceApp(paymentSecret); // Simulating payment service

      // WHEN: Get token from auth-service
      const registerRes = await request(authAppA)
        .post('/api/auth/register/customer')
        .send({
          firstName: 'Multi',
          lastName: 'Service',
          email: 'jwt_test_multi@test.com',
          phone: '0906666666',
          password: 'password123'
        });

      const token = registerRes.body.token;

      // THEN: Token fails on both order and payment services
      const orderRes = await request(orderAppB)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerId: 'test' });

      const paymentRes = await request(paymentAppC)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerId: 'test' });

      expect(orderRes.status).toBe(401);
      expect(paymentRes.status).toBe(401);
    });
  });

  describe('Test Case 5: Production Deployment Scenarios', () => {
    it('should document docker-compose JWT_SECRET environment variable risk', async () => {
      // GIVEN: Document that docker-compose.yml uses ${JWT_SECRET}
      // File: backend/docker-compose.yml line 29
      // This variable must be set correctly in .env file for ALL services

      const scenarios = [
        {
          name: 'Scenario 1: Secrets match',
          authSecret: 'PRODUCTION_SECRET_123',
          orderSecret: 'PRODUCTION_SECRET_123',
          shouldWork: true
        },
        {
          name: 'Scenario 2: Typo in one service',
          authSecret: 'PRODUCTION_SECRET_123',
          orderSecret: 'PRODUCTION_SECRET_124', // Typo!
          shouldWork: false
        },
        {
          name: 'Scenario 3: Copy-paste from different env',
          authSecret: 'STAGING_SECRET_ABC',
          orderSecret: 'PRODUCTION_SECRET_XYZ',
          shouldWork: false
        }
      ];

      for (const scenario of scenarios) {
        const authApp = createAuthApp(scenario.authSecret);
        const orderApp = createOrderServiceApp(scenario.orderSecret);

        const registerRes = await request(authApp)
          .post('/api/auth/register/customer')
          .send({
            firstName: scenario.name,
            lastName: 'Test',
            email: `jwt_test_${scenario.name.replace(/\s/g, '_')}@test.com`,
            phone: '0907777777',
            password: 'password123'
          });

        if (registerRes.status === 201) {
          const token = registerRes.body.token;
          
          const orderRes = await request(orderApp)
            .post('/api/orders')
            .set('Authorization', `Bearer ${token}`)
            .send({ customerId: 'test' });

          if (scenario.shouldWork) {
            expect(orderRes.status).toBe(201);
          } else {
            expect(orderRes.status).toBe(401);
          }
        }
      }
    });
  });
});
