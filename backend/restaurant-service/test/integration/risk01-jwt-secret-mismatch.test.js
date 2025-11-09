/**
 * RISK-01: JWT Secret Mismatch Across Services
 * Tests authentication token validation between auth-service and restaurant-service
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/server.js';
import mongoose from 'mongoose';
import Restaurant from '../../src/models/Restaurant.js';

describe('RISK-01: JWT Secret Mismatch Integration Test', () => {
  let testRestaurant;
  const MONGO_URI = 'mongodb://localhost:27017/Restaurant';
  
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI);
    }
  });

  beforeEach(async () => {
    // Clear and create test restaurant
    await Restaurant.deleteMany({});
    testRestaurant = await Restaurant.create({
      name: 'Test Restaurant JWT',
      ownerName: 'JWT Owner',
      location: 'JWT Street',
      contactNumber: '+1234567890',
      admin: {
        email: 'jwt@test.com',
        password: 'password123'
      }
    });
  });

  afterAll(async () => {
    await Restaurant.deleteMany({});
    await mongoose.connection.close();
  });

  test('Should reject token signed with wrong JWT_SECRET', async () => {
    // Simulate token from auth-service with different secret
    const wrongSecret = 'DIFFERENT_JWT_SECRET_FROM_AUTH_SERVICE';
    const wrongToken = jwt.sign(
      { id: testRestaurant._id, role: 'restaurant' },
      wrongSecret,
      { expiresIn: '1h' }
    );

    const response = await request(app)
      .get('/api/restaurant/profile')
      .set('Authorization', `Bearer ${wrongToken}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid token/i);
  });

  test('Should accept token signed with correct JWT_SECRET', async () => {
    // Token with correct secret (from environment)
    const correctToken = jwt.sign(
      { id: testRestaurant._id, role: 'restaurant' },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );

    const response = await request(app)
      .get('/api/restaurant/profile')
      .set('Authorization', `Bearer ${correctToken}`);

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Test Restaurant JWT');
  });

  test('Should detect JWT_SECRET mismatch in cross-service scenario', async () => {
    // Simulate auth-service secret
    const authServiceSecret = 'auth_service_secret_key_12345';
    // Simulate restaurant-service secret (different)
    const restaurantServiceSecret = 'restaurant_service_secret_67890';

    // Token issued by auth-service
    const authToken = jwt.sign(
      { id: testRestaurant._id, role: 'customer' },
      authServiceSecret,
      { expiresIn: '1h' }
    );

    // Try to use it in restaurant-service (should fail)
    try {
      jwt.verify(authToken, restaurantServiceSecret);
      fail('Should have thrown verification error');
    } catch (error) {
      expect(error.name).toBe('JsonWebTokenError');
      expect(error.message).toMatch(/invalid signature/i);
    }
  });

  test('Should validate JWT_SECRET consistency requirement', async () => {
    const secret1 = process.env.JWT_SECRET || 'default_secret';
    const secret2 = 'mismatched_secret';

    const token = jwt.sign({ id: '123' }, secret1);

    // Verification with same secret succeeds
    const decoded1 = jwt.verify(token, secret1);
    expect(decoded1.id).toBe('123');

    // Verification with different secret fails
    expect(() => {
      jwt.verify(token, secret2);
    }).toThrow();
  });

  test('Should expose JWT configuration mismatch in distributed system', async () => {
    // Test case: Multiple services with different JWT configs
    const services = [
      { name: 'auth-service', secret: 'secret_a', expiresIn: '1d' },
      { name: 'restaurant-service', secret: 'secret_b', expiresIn: '7d' },
      { name: 'order-service', secret: 'secret_c', expiresIn: '30d' }
    ];

    const userId = 'user_123';
    const tokens = services.map(svc => ({
      service: svc.name,
      token: jwt.sign({ id: userId }, svc.secret, { expiresIn: svc.expiresIn })
    }));

    // Try to verify each token with other service secrets
    let mismatchCount = 0;
    tokens.forEach(({ service: issuer, token }) => {
      services.forEach(({ name: verifier, secret }) => {
        if (issuer !== verifier) {
          try {
            jwt.verify(token, secret);
          } catch (error) {
            mismatchCount++;
            expect(error.name).toBe('JsonWebTokenError');
          }
        }
      });
    });

    // Should have 6 mismatches (3 services × 2 cross-verifications each)
    expect(mismatchCount).toBe(6);
  });

  test('Should fail when Authorization header format is incorrect', async () => {
    const token = jwt.sign(
      { id: testRestaurant._id },
      process.env.JWT_SECRET || 'test_secret'
    );

    // Missing "Bearer " prefix
    const response1 = await request(app)
      .get('/api/restaurant/profile')
      .set('Authorization', token);

    expect(response1.status).toBe(401);

    // Wrong prefix
    const response2 = await request(app)
      .get('/api/restaurant/profile')
      .set('Authorization', `Token ${token}`);

    expect(response2.status).toBe(401);
  });
});
