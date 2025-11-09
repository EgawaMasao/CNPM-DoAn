/**
 * RISK-01: JWT Secret Mismatch Between Services
 * Integration Test
 * 
 * Tests JWT token validation failure due to secret inconsistency
 * between auth-service and order-service
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import orderRoutes from '../../routes/orderRoutes.js';
import userRoutes from '../../routes/userRoutes.js';

// Load environment variables
dotenv.config();

// Create test app
let app;

describe('RISK-01: JWT Secret Mismatch Integration Test', () => {
    const CORRECT_JWT_SECRET = process.env.JWT_SECRET || 'MnAIm95T4VUQWaC591bxkhdmhZDlQk3EP2TFP27YUo65WjRBPxThKVd8PzH0M3wxQB3uX5XvzhYXf8n8jV8Vd8sfUatNPnK1Fo0IBnofLgKKqRWlQoJYBgnWIu3Er0IPB37cshF1KQK3o5r3loXYHBX1BGblU4pdgXZBBLuz5BnpzsSHAEaOQHKWyTEXry5TdkFvEpqXXtT74fZXQz9kJmQceiF8wKyWD1Rx50nyKj08XFx8WlEoOYmUNp8P9IQY';
    const WRONG_JWT_SECRET = 'DIFFERENT_SECRET_KEY_SIMULATING_AUTH_SERVICE_MISMATCH';
    const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/Order';

    beforeAll(async () => {
        // Connect to MongoDB
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGODB_URI);
        }

        // Create Express app for testing
        app = express();
        app.use(cors());
        app.use(express.json());
        app.use("/api/orders", orderRoutes);
        app.use("/api/users", userRoutes);
    }, 30000);

    afterAll(async () => {
        await mongoose.connection.close();
    }, 30000);

    describe('Test Case 1: Token signed with WRONG secret (simulating auth-service mismatch)', () => {
        it('should reject token signed with different JWT secret', async () => {
            // GIVEN: Token signed with WRONG secret (simulating auth-service using different secret)
            const tokenPayload = {
                id: 'user_mismatch_123',
                role: 'customer',
            };
            const tokenWithWrongSecret = jwt.sign(tokenPayload, WRONG_JWT_SECRET, { expiresIn: '1h' });

            const orderData = {
                customerId: 'customer_mismatch_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                deliveryAddress: '123 Test Street, City, Country'
            };

            // WHEN: Request made with token signed by different secret
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${tokenWithWrongSecret}`)
                .send(orderData);

            // THEN: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toMatch(/Invalid token|authorization denied/i);
        });

        it('should reject expired token even with correct secret', async () => {
            // GIVEN: Expired token with correct secret
            const tokenPayload = {
                id: 'user_expired_123',
                role: 'customer',
            };
            const expiredToken = jwt.sign(tokenPayload, CORRECT_JWT_SECRET, { expiresIn: '-1h' });

            const orderData = {
                customerId: 'customer_expired_123',
                restaurantId: 'restaurant_789',
                items: [
                    {
                        foodId: 'food_001',
                        quantity: 1,
                        price: 25.00
                    }
                ],
                deliveryAddress: '456 Expired Ave, City, Country'
            };

            // WHEN: Request made with expired token
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${expiredToken}`)
                .send(orderData);

            // THEN: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(response.body.message).toMatch(/Invalid token|expired/i);
        });
    });

    describe('Test Case 2: Token signed with CORRECT secret (normal flow)', () => {
        it('should accept token signed with correct JWT secret', async () => {
            // GIVEN: Token signed with CORRECT secret
            const tokenPayload = {
                id: 'user_valid_456',
                role: 'customer',
            };
            const validToken = jwt.sign(tokenPayload, CORRECT_JWT_SECRET, { expiresIn: '1h' });

            const orderData = {
                customerId: 'customer_valid_456',
                restaurantId: 'restaurant_789',
                items: [
                    {
                        foodId: 'food_valid_001',
                        quantity: 3,
                        price: 12.50
                    }
                ],
                deliveryAddress: '789 Valid Street, City, Country'
            };

            // WHEN: Request made with valid token
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .send(orderData);

            // THEN: Should return 201 Created
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('_id');
            expect(response.body.customerId).toBe('customer_valid_456');
            expect(response.body.totalPrice).toBe(37.50);
        });
    });

    describe('Test Case 3: No token provided', () => {
        it('should reject request without Authorization header', async () => {
            // GIVEN: Request without token
            const orderData = {
                customerId: 'customer_notoken_789',
                restaurantId: 'restaurant_999',
                items: [
                    {
                        foodId: 'food_002',
                        quantity: 1,
                        price: 10.00
                    }
                ],
                deliveryAddress: '999 No Token Blvd, City, Country'
            };

            // WHEN: Request made without Authorization header
            const response = await request(app)
                .post('/api/orders')
                .send(orderData);

            // THEN: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(response.body.message).toMatch(/No token|authorization denied/i);
        });

        it('should reject request with malformed Authorization header', async () => {
            // GIVEN: Malformed Authorization header
            const orderData = {
                customerId: 'customer_malformed_999',
                restaurantId: 'restaurant_888',
                items: [
                    {
                        foodId: 'food_003',
                        quantity: 2,
                        price: 8.99
                    }
                ],
                deliveryAddress: '888 Malformed St, City, Country'
            };

            // WHEN: Request made with malformed token
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', 'InvalidTokenFormat')
                .send(orderData);

            // THEN: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(response.body.message).toMatch(/No token|Invalid token|authorization denied/i);
        });
    });

    describe('Test Case 4: Token with missing role claim', () => {
        it('should reject token without role claim', async () => {
            // GIVEN: Token signed without role claim
            const tokenPayload = {
                id: 'user_norole_111',
                // role is missing
            };
            const tokenWithoutRole = jwt.sign(tokenPayload, CORRECT_JWT_SECRET, { expiresIn: '1h' });

            const orderData = {
                customerId: 'customer_norole_111',
                restaurantId: 'restaurant_222',
                items: [
                    {
                        foodId: 'food_004',
                        quantity: 1,
                        price: 20.00
                    }
                ],
                deliveryAddress: '222 No Role Ave, City, Country'
            };

            // WHEN: Request made with token missing role
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${tokenWithoutRole}`)
                .send(orderData);

            // THEN: Should return 401 or 403
            expect([401, 403]).toContain(response.status);
            expect(response.body.message).toMatch(/Role not found|Invalid token|Access denied/i);
        });
    });

    describe('Test Case 5: Cross-service secret rotation scenario', () => {
        it('should demonstrate impact when auth-service rotates secret but order-service does not', async () => {
            // GIVEN: Simulate auth-service using new secret
            const NEW_ROTATED_SECRET = 'NEW_ROTATED_SECRET_AFTER_SECURITY_INCIDENT';
            const tokenPayload = {
                id: 'user_rotated_222',
                role: 'customer',
            };
            const tokenWithRotatedSecret = jwt.sign(tokenPayload, NEW_ROTATED_SECRET, { expiresIn: '1h' });

            const orderData = {
                customerId: 'customer_rotated_222',
                restaurantId: 'restaurant_333',
                items: [
                    {
                        foodId: 'food_005',
                        quantity: 5,
                        price: 7.99
                    }
                ],
                deliveryAddress: '333 Rotated Key Rd, City, Country'
            };

            // WHEN: Request made with token from rotated secret
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${tokenWithRotatedSecret}`)
                .send(orderData);

            // THEN: Should fail - order-service still uses old secret
            expect(response.status).toBe(401);
            expect(response.body.message).toMatch(/Invalid token/i);
        });

        it('should succeed with token using current synchronized secret', async () => {
            // GIVEN: Both services using same current secret
            const tokenPayload = {
                id: 'user_synced_333',
                role: 'customer',
            };
            const syncedToken = jwt.sign(tokenPayload, CORRECT_JWT_SECRET, { expiresIn: '1h' });

            const orderData = {
                customerId: 'customer_synced_333',
                restaurantId: 'restaurant_444',
                items: [
                    {
                        foodId: 'food_006',
                        quantity: 2,
                        price: 15.50
                    }
                ],
                deliveryAddress: '444 Synced Secrets Blvd, City, Country'
            };

            // WHEN: Request made with synchronized secret token
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${syncedToken}`)
                .send(orderData);

            // THEN: Should succeed
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('_id');
            expect(response.body.totalPrice).toBe(31.00);
        });
    });
});
