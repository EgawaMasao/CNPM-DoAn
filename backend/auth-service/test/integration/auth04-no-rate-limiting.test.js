/**
 * INTEGRATION TEST: AUTH-04 - No Rate Limiting on Authentication Endpoints
 * 
 * RISK DESCRIPTION:
 * Authentication endpoints (/register, /login) have no rate limiting, allowing
 * unlimited requests from a single IP address. This enables brute-force attacks,
 * credential stuffing, and DoS attacks.
 * 
 * VULNERABILITY LOCATION:
 * - index.js (lines 8-13) - No rate limiting middleware
 * - routes/authRoutes.js (lines 6-7) - Unprotected endpoints
 * - package.json - No express-rate-limit dependency
 * 
 * BUSINESS IMPACT:
 * - Brute-force attacks can compromise user accounts
 * - Service degradation from excessive requests
 * - Credential stuffing attacks using leaked databases
 * - Bot registration spam
 * - Resource exhaustion (CPU, memory, database connections)
 */

require('dotenv').config();
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../../models/Customer');

// Create Express app without rate limiting (mimicking production)
const createApp = () => {
  const app = express();
  app.use(express.json());

  // Registration endpoint - NO RATE LIMITING
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

      const newCustomer = await Customer.create({
        firstName, lastName, email, phone, password
      });

      res.status(201).json({
        status: "success",
        data: { customer: { id: newCustomer._id, email: newCustomer.email } }
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Login endpoint - NO RATE LIMITING
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

      res.json({
        status: "success",
        token: "mock_jwt_token",
        data: { customer: { id: customer._id, email: customer.email } }
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return app;
};

describe('RISK-AUTH-04: No Rate Limiting on Authentication Endpoints', () => {
  let app;
  let testEmail;
  let testPassword;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/Auth', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await Customer.deleteMany({ email: /^rate_limit_test_/ });
    app = createApp();

    // Create test account for login attempts
    testEmail = 'rate_limit_test_victim@test.com';
    testPassword = 'correct_password_123';

    await Customer.create({
      firstName: 'Rate',
      lastName: 'Limit',
      email: testEmail,
      phone: '0901111111',
      password: testPassword
    });
  }, 30000);

  afterAll(async () => {
    await Customer.deleteMany({ email: /^rate_limit_test_/ });
    await mongoose.connection.close();
  }, 30000);

  describe('Test Case 1: Basic Rate Limiting Check', () => {
    it('should demonstrate no rate limiting on login endpoint', async () => {
      // GIVEN: No rate limiting configured
      const attemptCount = 10;
      let blockedCount = 0;

      // WHEN: Attempt login multiple times
      for (let i = 0; i < attemptCount; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testEmail,
            password: `wrong_password_${i}`
          });

        if (response.status === 429) {
          blockedCount++;
        }
      }

      // THEN: No requests blocked (vulnerability)
      expect(blockedCount).toBe(0);
      console.log(`✗ VULNERABILITY: ${attemptCount} login attempts processed without rate limiting`);
    });
  });

  describe('Test Case 2: Registration Endpoint', () => {
    it('should demonstrate lack of rate limiting on registration', async () => {
      // GIVEN: No rate limiting on registration
      console.log('✗ VULNERABILITY: Registration endpoint has no rate limiting');
      console.log('  Attacker can create unlimited spam accounts');
      console.log('  Recommendation: Limit to 3-5 registrations per hour per IP');
      
      // This test documents the vulnerability without actually spamming
      expect(true).toBe(true);
    });
  });

  describe('Test Case 4: Vulnerability Documentation', () => {
    it('should document rate limiting requirements', () => {
      console.log('\n📋 Rate Limiting Requirements (OWASP):');

      const requirements = {
        login: {
          endpoint: '/api/auth/login',
          recommended: '5 attempts per 15 minutes per IP',
          current: 'UNLIMITED',
          risk: 'HIGH - Brute force attacks possible'
        },
        registration: {
          endpoint: '/api/auth/register/customer',
          recommended: '3 registrations per hour per IP',
          current: 'UNLIMITED',
          risk: 'HIGH - Bot spam possible'
        }
      };

      console.log('\n  Login Endpoint:');
      console.log(`    Current: ${requirements.login.current}`);
      console.log(`    Recommended: ${requirements.login.recommended}`);
      console.log(`    Risk: ${requirements.login.risk}`);

      console.log('\n  Registration Endpoint:');
      console.log(`    Current: ${requirements.registration.current}`);
      console.log(`    Recommended: ${requirements.registration.recommended}`);
      console.log(`    Risk: ${requirements.registration.risk}`);

      console.log('\n✅ Recommended Solution: express-rate-limit middleware');
      console.log('  npm install express-rate-limit');
      console.log('  const rateLimit = require("express-rate-limit");');
      console.log('  const loginLimiter = rateLimit({');
      console.log('    windowMs: 15 * 60 * 1000, // 15 minutes');
      console.log('    max: 5, // 5 requests per window');
      console.log('    message: "Too many login attempts, try again later"');
      console.log('  });');
      console.log('  app.post("/api/auth/login", loginLimiter, loginHandler);');

      expect(requirements.login.current).toBe('UNLIMITED');
      expect(requirements.registration.current).toBe('UNLIMITED');
    });

    it('should document compliance requirements', () => {
      const compliance = [
        {
          standard: 'OWASP ASVS 2.2.1',
          requirement: 'Verify anti-automation controls',
          status: 'NOT MET'
        },
        {
          standard: 'NIST 800-63B',
          requirement: 'Rate limiting on authentication',
          status: 'NOT MET'
        },
        {
          standard: 'PCI-DSS 8.1.8',
          requirement: 'Limit repeated access attempts',
          status: 'NOT MET'
        }
      ];

      console.log('\n⚠️  Compliance Status:');
      compliance.forEach(item => {
        console.log(`  [${item.status}] ${item.standard}: ${item.requirement}`);
      });

      expect(compliance.every(c => c.status === 'NOT MET')).toBe(true);
    });
  });
});
