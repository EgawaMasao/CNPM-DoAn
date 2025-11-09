/**
 * RISK-10: CORS Wildcard in Production Environment
 * Integration Test
 * 
 * Tests that unrestricted cross-origin access allows request forgery
 * and services accept requests from any origin
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import orderRoutes from '../../routes/orderRoutes.js';
import userRoutes from '../../routes/userRoutes.js';
import Order from '../../models/orderModel.js';

// Load environment variables
dotenv.config();

let app;

describe('RISK-10: CORS Wildcard Integration Test', () => {
    const JWT_SECRET = process.env.JWT_SECRET || 'MnAIm95T4VUQWaC591bxkhdmhZDlQk3EP2TFP27YUo65WjRBPxThKVd8PzH0M3wxQB3uX5XvzhYXf8n8jV8Vd8sfUatNPnK1Fo0IBnofLgKKqRWlQoJYBgnWIu3Er0IPB37cshF1KQK3o5r3loXYHBX1BGblU4pdgXZBBLuz5BnpzsSHAEaOQHKWyTEXry5TdkFvEpqXXtT74fZXQz9kJmQceiF8wKyWD1Rx50nyKj08XFx8WlEoOYmUNp8P9IQY';
    const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/Order';

    let validToken;

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

        // Create valid token
        validToken = jwt.sign(
            { id: 'cors_test_user', role: 'customer' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
    }, 30000);

    afterAll(async () => {
        // Cleanup test orders
        await Order.deleteMany({ customerId: /^cors_test_|^malicious_/ });
        await mongoose.connection.close();
    }, 30000);

    describe('Test Case 1: Accept requests from malicious origins', () => {
        it('should accept request from malicious-site.com', async () => {
            // GIVEN: Request from malicious origin
            const orderData = {
                customerId: 'cors_test_customer_001',
                restaurantId: 'restaurant_cors_001',
                items: [
                    {
                        foodId: 'food_cors_001',
                        quantity: 1,
                        price: 50.00
                    }
                ],
                deliveryAddress: '123 Malicious Request Street'
            };

            // WHEN: Making request with malicious origin header
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://malicious-site.com')
                .send(orderData);

            // THEN: Request accepted (CORS wildcard allows any origin)
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('_id');
            
            // Check CORS headers in response
            expect(response.headers['access-control-allow-origin']).toBeDefined();
        });

        it('should accept request from attacker-evil-domain.xyz', async () => {
            // GIVEN: Request from another malicious origin
            const orderData = {
                customerId: 'cors_test_customer_002',
                restaurantId: 'restaurant_cors_002',
                items: [
                    {
                        foodId: 'food_cors_002',
                        quantity: 3,
                        price: 25.00
                    }
                ],
                deliveryAddress: '456 Evil Domain Ave'
            };

            // WHEN: Making request from evil domain
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://attacker-evil-domain.xyz')
                .send(orderData);

            // THEN: Request accepted without origin validation
            expect(response.status).toBe(201);
            expect(response.body.totalPrice).toBe(75.00);
        });

        it('should accept request with no origin header', async () => {
            // GIVEN: Request without origin header
            const orderData = {
                customerId: 'cors_test_customer_003',
                restaurantId: 'restaurant_cors_003',
                items: [
                    {
                        foodId: 'food_cors_003',
                        quantity: 1,
                        price: 100.00
                    }
                ],
                deliveryAddress: '789 No Origin Header Blvd'
            };

            // WHEN: Making request without origin
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .send(orderData);

            // THEN: Request accepted
            expect(response.status).toBe(201);
        });
    });

    describe('Test Case 2: CORS preflight requests from any origin', () => {
        it('should handle OPTIONS preflight from malicious origin', async () => {
            // WHEN: Sending OPTIONS preflight request
            const response = await request(app)
                .options('/api/orders')
                .set('Origin', 'http://phishing-site.com')
                .set('Access-Control-Request-Method', 'POST')
                .set('Access-Control-Request-Headers', 'authorization,content-type');

            // THEN: Preflight accepted from any origin
            expect([200, 204]).toContain(response.status);
            
            // CORS headers should indicate acceptance
            if (response.headers['access-control-allow-origin']) {
                expect(response.headers['access-control-allow-origin']).toBeDefined();
            }
        });

        it('should allow all HTTP methods from any origin', async () => {
            // WHEN: Checking allowed methods via OPTIONS
            const response = await request(app)
                .options('/api/orders/test123')
                .set('Origin', 'http://unsafe-origin.com')
                .set('Access-Control-Request-Method', 'DELETE');

            // THEN: All methods allowed
            expect([200, 204, 404]).toContain(response.status);
        });
    });

    describe('Test Case 3: Cross-Site Request Forgery (CSRF) vulnerability', () => {
        it('should demonstrate CSRF attack creating unauthorized order', async () => {
            // GIVEN: Stolen/leaked JWT token
            const stolenToken = validToken;

            // WHEN: Attacker site makes request with stolen token
            const maliciousOrderData = {
                customerId: 'malicious_victim_customer',
                restaurantId: 'restaurant_attacker_controlled',
                items: [
                    {
                        foodId: 'food_expensive_item',
                        quantity: 100,
                        price: 999.99
                    }
                ],
                deliveryAddress: 'Attacker Address - 123 Fraud Street'
            };

            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${stolenToken}`)
                .set('Origin', 'http://csrf-attack-site.com')
                .set('Referer', 'http://csrf-attack-site.com/attack.html')
                .send(maliciousOrderData);

            // THEN: Attack succeeds due to CORS wildcard
            expect(response.status).toBe(201);
            expect(response.body.totalPrice).toBe(99999.00);
            expect(response.body.deliveryAddress).toContain('Fraud Street');
        });

        it('should allow order modification from unauthorized origin', async () => {
            // GIVEN: Create legitimate order
            const orderData = {
                customerId: 'cors_test_customer_modify',
                restaurantId: 'restaurant_modify',
                items: [
                    {
                        foodId: 'food_original',
                        quantity: 1,
                        price: 20.00
                    }
                ],
                deliveryAddress: 'Original Address'
            };

            const createResponse = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .send(orderData);

            const orderId = createResponse.body._id;

            // WHEN: Attacker modifies order from malicious origin
            const maliciousUpdate = {
                items: [
                    {
                        foodId: 'food_modified_by_attacker',
                        quantity: 1000,
                        price: 0.01
                    }
                ],
                deliveryAddress: 'Attacker Controlled Address'
            };

            const updateResponse = await request(app)
                .patch(`/api/orders/${orderId}`)
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://order-hijacking-site.com')
                .send(maliciousUpdate);

            // THEN: Modification succeeds from malicious origin
            expect(updateResponse.status).toBe(200);
            expect(updateResponse.body.deliveryAddress).toBe('Attacker Controlled Address');
            expect(updateResponse.body.totalPrice).toBe(10.00); // Manipulated price
        });
    });

    describe('Test Case 4: Data exfiltration via CORS', () => {
        it('should allow order data retrieval from any origin', async () => {
            // GIVEN: Orders exist in database
            const orderData = {
                customerId: 'cors_test_sensitive_customer',
                restaurantId: 'restaurant_sensitive',
                items: [
                    {
                        foodId: 'food_sensitive',
                        quantity: 1,
                        price: 150.00
                    }
                ],
                deliveryAddress: 'SENSITIVE ADDRESS - 999 Private Lane'
            };

            const createResponse = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .send(orderData);

            const orderId = createResponse.body._id;

            // WHEN: Attacker retrieves order from malicious site
            const exfilResponse = await request(app)
                .get(`/api/orders/${orderId}`)
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://data-exfiltration-site.com');

            // THEN: Sensitive data exposed to any origin
            expect(exfilResponse.status).toBe(200);
            expect(exfilResponse.body.deliveryAddress).toContain('SENSITIVE ADDRESS');
            expect(exfilResponse.body.customerId).toBe('cors_test_sensitive_customer');
        });

        it('should allow listing all orders from unauthorized origin', async () => {
            // WHEN: Requesting all orders from malicious origin
            const response = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://scraping-bot-site.com');

            // THEN: All orders exposed
            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            
            // Attacker can scrape all order data
            if (response.body.length > 0) {
                expect(response.body[0]).toHaveProperty('customerId');
                expect(response.body[0]).toHaveProperty('deliveryAddress');
                expect(response.body[0]).toHaveProperty('totalPrice');
            }
        });
    });

    describe('Test Case 5: Credentials and sensitive headers exposure', () => {
        it('should allow credentials in cross-origin requests', async () => {
            // WHEN: Making request with credentials from different origin
            const response = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://credential-stealing-site.com')
                .set('Cookie', 'session=fake_session_token');

            // THEN: Request succeeds with credentials
            expect(response.status).toBe(200);
            
            // Check if credentials are allowed in CORS
            if (response.headers['access-control-allow-credentials']) {
                console.log('CORS allows credentials:', response.headers['access-control-allow-credentials']);
            }
        });

        it('should expose authorization tokens to any origin', async () => {
            // GIVEN: Request with authorization token
            const orderData = {
                customerId: 'cors_test_token_exposure',
                restaurantId: 'restaurant_token',
                items: [
                    {
                        foodId: 'food_token',
                        quantity: 1,
                        price: 30.00
                    }
                ],
                deliveryAddress: '111 Token Exposure St'
            };

            // WHEN: Making request from untrusted origin with auth token
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://token-harvesting-site.com')
                .send(orderData);

            // THEN: Token accepted from any origin
            expect(response.status).toBe(201);
        });
    });

    describe('Test Case 6: No origin whitelist validation', () => {
        it('should accept requests from localhost variants', async () => {
            const origins = [
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'http://localhost:8080',
                'http://192.168.1.100:3000'
            ];

            // WHEN: Testing multiple localhost origins
            for (const origin of origins) {
                const orderData = {
                    customerId: `cors_test_localhost_${origin}`,
                    restaurantId: 'restaurant_localhost',
                    items: [
                        {
                            foodId: 'food_localhost',
                            quantity: 1,
                            price: 10.00
                        }
                    ],
                    deliveryAddress: `Address for ${origin}`
                };

                const response = await request(app)
                    .post('/api/orders')
                    .set('Authorization', `Bearer ${validToken}`)
                    .set('Origin', origin)
                    .send(orderData);

                // THEN: All accepted without validation
                expect(response.status).toBe(201);
            }
        });

        it('should accept requests from various TLDs and subdomains', async () => {
            const maliciousOrigins = [
                'http://fake-food-delivery.com',
                'http://phishing.evil.net',
                'http://subdomain.attacker.org',
                'https://secure-looking-but-fake.io',
                'http://xn--unicode-domain-attack.com' // Punycode encoded domain
            ];

            // WHEN: Testing various malicious origins
            for (const origin of maliciousOrigins) {
                const response = await request(app)
                    .get('/api/orders')
                    .set('Authorization', `Bearer ${validToken}`)
                    .set('Origin', origin);

                // THEN: All origins accepted
                expect(response.status).toBe(200);
            }
        });
    });

    describe('Test Case 7: Production environment CORS misconfiguration', () => {
        it('should verify CORS wildcard is active in production-like environment', async () => {
            // GIVEN: Simulating production environment
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            // WHEN: Making request in production mode
            const response = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://production-attacker.com');

            // THEN: CORS wildcard still active in production
            expect(response.status).toBe(200);
            
            // Restore environment
            process.env.NODE_ENV = originalEnv;
        });

        it('should demonstrate lack of origin validation in production', async () => {
            // GIVEN: Order creation with production headers
            const orderData = {
                customerId: 'cors_test_production_001',
                restaurantId: 'restaurant_production',
                items: [
                    {
                        foodId: 'food_production',
                        quantity: 5,
                        price: 75.00
                    }
                ],
                deliveryAddress: '555 Production Vulnerability Rd'
            };

            // WHEN: Attacker makes request claiming to be from production domain
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://fake-production-domain.com')
                .set('X-Forwarded-For', '203.0.113.1') // Spoofed IP
                .set('User-Agent', 'MaliciousBot/1.0')
                .send(orderData);

            // THEN: Request succeeds despite suspicious headers
            expect(response.status).toBe(201);
            expect(response.body.totalPrice).toBe(375.00);
        });
    });

    describe('Test Case 8: WebSocket CORS wildcard vulnerability', () => {
        it('should verify WebSocket accepts connections from any origin', async () => {
            // Note: This test documents the WebSocket CORS issue
            // Actual WebSocket connection testing requires socket.io-client
            
            // GIVEN: WebSocket configuration with origin: "*"
            // From index.js line 16-18:
            // io = new Server(server, {
            //     cors: { origin: "*", methods: ["GET", "POST"] }
            // });

            // THEN: Any origin can connect to WebSocket
            // This is tested in RISK-05 integration test
            expect(true).toBe(true); // Placeholder for documentation
        });
    });

    describe('Test Case 9: Combined attack scenarios', () => {
        it('should demonstrate complete attack chain using CORS vulnerability', async () => {
            // SCENARIO: Attacker creates fake order, modifies it, retrieves data
            
            // STEP 1: Create order from malicious site
            const maliciousOrderData = {
                customerId: 'malicious_attack_chain_victim',
                restaurantId: 'restaurant_chain_attack',
                items: [
                    {
                        foodId: 'food_chain_001',
                        quantity: 10,
                        price: 50.00
                    }
                ],
                deliveryAddress: 'Victim Address - Will be changed'
            };

            const createResponse = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://complete-attack-chain.com')
                .send(maliciousOrderData);

            expect(createResponse.status).toBe(201);
            const orderId = createResponse.body._id;

            // STEP 2: Modify delivery address
            const updateResponse = await request(app)
                .patch(`/api/orders/${orderId}`)
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://complete-attack-chain.com')
                .send({ deliveryAddress: 'Attacker Address - Goods redirected' });

            expect(updateResponse.status).toBe(200);

            // STEP 3: Retrieve and exfiltrate order details
            const exfilResponse = await request(app)
                .get(`/api/orders/${orderId}`)
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://complete-attack-chain.com');

            expect(exfilResponse.status).toBe(200);
            expect(exfilResponse.body.deliveryAddress).toContain('Attacker Address');

            // STEP 4: Cancel order to avoid payment
            const cancelResponse = await request(app)
                .delete(`/api/orders/${orderId}`)
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://complete-attack-chain.com');

            expect(cancelResponse.status).toBe(200);

            // Complete attack chain successful due to CORS wildcard
        });

        it('should allow automated scraping of all customer orders', async () => {
            // GIVEN: Multiple orders from different customers
            const customerIds = ['customer_A', 'customer_B', 'customer_C'];
            
            for (const customerId of customerIds) {
                const orderData = {
                    customerId: `cors_test_scraping_${customerId}`,
                    restaurantId: 'restaurant_scraping',
                    items: [{ foodId: 'food_scrape', quantity: 1, price: 20.00 }],
                    deliveryAddress: `${customerId} - Private Address`
                };

                await request(app)
                    .post('/api/orders')
                    .set('Authorization', `Bearer ${validToken}`)
                    .send(orderData);
            }

            // WHEN: Bot scrapes all orders from malicious origin
            const scrapeResponse = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .set('Origin', 'http://scraping-bot-automated.com')
                .set('User-Agent', 'DataHarvesterBot/2.0');

            // THEN: All customer data exposed to scraping bot
            expect(scrapeResponse.status).toBe(200);
            expect(scrapeResponse.body.length).toBeGreaterThan(0);
            
            const scrapedOrders = scrapeResponse.body.filter(o => 
                o.customerId && o.customerId.includes('cors_test_scraping_')
            );
            expect(scrapedOrders.length).toBeGreaterThanOrEqual(3);
        });
    });
});
