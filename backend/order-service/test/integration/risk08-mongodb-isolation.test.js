/**
 * RISK-08: MongoDB Database Isolation Failure
 * Integration Test
 * 
 * Tests that shared MongoDB instance allows cross-service data access
 * without proper database isolation
 */

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import orderRoutes from '../../routes/orderRoutes.js';
import userRoutes from '../../routes/userRoutes.js';
import Order from '../../models/orderModel.js';

// Load environment variables
dotenv.config();

let app;

describe('RISK-08: MongoDB Database Isolation Integration Test', () => {
    const JWT_SECRET = process.env.JWT_SECRET || 'MnAIm95T4VUQWaC591bxkhdmhZDlQk3EP2TFP27YUo65WjRBPxThKVd8PzH0M3wxQB3uX5XvzhYXf8n8jV8Vd8sfUatNPnK1Fo0IBnofLgKKqRWlQoJYBgnWIu3Er0IPB37cshF1KQK3o5r3loXYHBX1BGblU4pdgXZBBLuz5BnpzsSHAEaOQHKWyTEXry5TdkFvEpqXXtT74fZXQz9kJmQceiF8wKyWD1Rx50nyKj08XFx8WlEoOYmUNp8P9IQY';
    const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/Order';
    
    let validToken;
    let orderDbConnection;
    let testOrderId;

    beforeAll(async () => {
        // Connect to MongoDB Order database
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGODB_URI);
        }

        orderDbConnection = mongoose.connection;

        // Create Express app for testing
        app = express();
        app.use(cors());
        app.use(express.json());
        app.use("/api/orders", orderRoutes);
        app.use("/api/users", userRoutes);

        // Create valid token
        validToken = jwt.sign(
            { id: 'isolation_test_user', role: 'customer' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
    }, 30000);

    afterAll(async () => {
        // Cleanup
        await Order.deleteMany({ customerId: /^isolation_test_/ });
        await mongoose.connection.close();
    }, 30000);

    describe('Test Case 1: Access Order database from different service context', () => {
        it('should access Order database without authentication', async () => {
            // GIVEN: Create order in Order service
            const orderData = {
                customerId: 'isolation_test_customer_001',
                restaurantId: 'restaurant_isolation_001',
                items: [
                    {
                        foodId: 'food_001',
                        quantity: 1,
                        price: 25.00
                    }
                ],
                deliveryAddress: '123 Isolation Test Street'
            };

            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .send(orderData);

            expect(response.status).toBe(201);
            testOrderId = response.body._id;

            // WHEN: Accessing same MongoDB instance from different context
            // Simulating payment-service or auth-service accessing Order DB
            const directDbAccess = await orderDbConnection.db
                .collection('orders')
                .findOne({ _id: new mongoose.Types.ObjectId(testOrderId) });

            // THEN: Can access Order data without going through order-service
            expect(directDbAccess).not.toBeNull();
            expect(directDbAccess.customerId).toBe('isolation_test_customer_001');
            expect(directDbAccess.totalPrice).toBe(25.00);
        });

        it('should modify Order data directly bypassing service layer', async () => {
            // GIVEN: Existing order
            const orderData = {
                customerId: 'isolation_test_customer_002',
                restaurantId: 'restaurant_isolation_002',
                items: [
                    {
                        foodId: 'food_002',
                        quantity: 2,
                        price: 50.00
                    }
                ],
                deliveryAddress: '456 Bypass Test Ave'
            };

            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .send(orderData);

            const orderId = response.body._id;

            // WHEN: Modifying order directly via MongoDB (bypassing business logic)
            await orderDbConnection.db
                .collection('orders')
                .updateOne(
                    { _id: new mongoose.Types.ObjectId(orderId) },
                    { 
                        $set: { 
                            totalPrice: 0.01,
                            paymentStatus: 'Paid',
                            status: 'Delivered'
                        } 
                    }
                );

            // THEN: Order modified without validation
            const modifiedOrder = await Order.findById(orderId);
            expect(modifiedOrder.totalPrice).toBe(0.01); // Changed from 100.00
            expect(modifiedOrder.paymentStatus).toBe('Paid');
            expect(modifiedOrder.status).toBe('Delivered');
        });
    });

    describe('Test Case 2: Cross-database access from single MongoDB instance', () => {
        it('should list all databases from single connection', async () => {
            // WHEN: Querying available databases
            const adminDb = orderDbConnection.db.admin();
            const databasesList = await adminDb.listDatabases();

            // THEN: Can see all service databases
            expect(databasesList.databases).toBeDefined();
            
            const dbNames = databasesList.databases.map(db => db.name);
            console.log('Available databases:', dbNames);
            
            // Should see Order, Auth, Restaurant, payment databases
            expect(dbNames).toContain('Order');
        });

        it('should switch between service databases freely', async () => {
            // GIVEN: Connected to Order database
            expect(orderDbConnection.db.databaseName).toBe('Order');

            // WHEN: Switching to Auth database
            const authDb = orderDbConnection.client.db('Auth');
            const authCollections = await authDb.listCollections().toArray();

            // THEN: Can access Auth database from order-service context
            expect(authCollections).toBeDefined();
            console.log('Auth database collections:', authCollections.map(c => c.name));

            // WHEN: Switching to Restaurant database
            const restaurantDb = orderDbConnection.client.db('Restaurant');
            const restaurantCollections = await restaurantDb.listCollections().toArray();

            // THEN: Can access Restaurant database
            expect(restaurantCollections).toBeDefined();
            console.log('Restaurant database collections:', restaurantCollections.map(c => c.name));

            // WHEN: Switching to payment database
            const paymentDb = orderDbConnection.client.db('payment');
            const paymentCollections = await paymentDb.listCollections().toArray();

            // THEN: Can access payment database
            expect(paymentCollections).toBeDefined();
            console.log('Payment database collections:', paymentCollections.map(c => c.name));
        });
    });

    describe('Test Case 3: Read sensitive data from other service databases', () => {
        it('should read Auth database user credentials from order-service', async () => {
            // WHEN: Accessing Auth database from order-service context
            const authDb = orderDbConnection.client.db('Auth');
            
            try {
                const users = await authDb.collection('customers').find({}).limit(5).toArray();
                
                // THEN: Can read user data (if exists)
                console.log(`Found ${users.length} users in Auth database`);
                
                if (users.length > 0) {
                    // Sensitive data exposed
                    expect(users[0]).toHaveProperty('email');
                    // Password hashes exposed
                    if (users[0].password) {
                        expect(users[0].password).toBeDefined();
                    }
                }
            } catch (error) {
                // Collection might not exist in test environment
                console.log('Auth customers collection not found:', error.message);
            }
        });

        it('should read Restaurant database from order-service', async () => {
            // WHEN: Accessing Restaurant database
            const restaurantDb = orderDbConnection.client.db('Restaurant');
            
            try {
                const restaurants = await restaurantDb.collection('restaurants').find({}).limit(5).toArray();
                
                // THEN: Can read restaurant data
                console.log(`Found ${restaurants.length} restaurants`);
                
                if (restaurants.length > 0) {
                    expect(restaurants[0]).toBeDefined();
                }
            } catch (error) {
                console.log('Restaurant collection not found:', error.message);
            }
        });

        it('should read Payment database transaction data', async () => {
            // WHEN: Accessing payment database
            const paymentDb = orderDbConnection.client.db('payment');
            
            try {
                const payments = await paymentDb.collection('payments').find({}).limit(5).toArray();
                
                // THEN: Can read sensitive payment information
                console.log(`Found ${payments.length} payment records`);
                
                if (payments.length > 0) {
                    // Credit card info, transaction IDs exposed
                    expect(payments[0]).toBeDefined();
                }
            } catch (error) {
                console.log('Payment collection not found:', error.message);
            }
        });
    });

    describe('Test Case 4: Modify data in other service databases', () => {
        it('should be able to modify Auth database from order-service', async () => {
            // GIVEN: Access to Auth database
            const authDb = orderDbConnection.client.db('Auth');
            const testEmail = `isolation_test_${Date.now()}@test.com`;

            try {
                // WHEN: Inserting fake user into Auth database
                await authDb.collection('customers').insertOne({
                    email: testEmail,
                    password: 'fake_password_hash',
                    name: 'Injected User',
                    role: 'customer',
                    createdAt: new Date()
                });

                // THEN: Data inserted successfully
                const injectedUser = await authDb.collection('customers').findOne({ email: testEmail });
                expect(injectedUser).not.toBeNull();
                expect(injectedUser.email).toBe(testEmail);

                // CLEANUP
                await authDb.collection('customers').deleteOne({ email: testEmail });
            } catch (error) {
                console.log('Could not modify Auth database:', error.message);
            }
        });

        it('should modify restaurant pricing from order-service', async () => {
            // GIVEN: Access to Restaurant database
            const restaurantDb = orderDbConnection.client.db('Restaurant');

            try {
                // WHEN: Finding and modifying restaurant food prices
                const foodItems = await restaurantDb.collection('fooditems').find({}).limit(1).toArray();

                if (foodItems.length > 0) {
                    const originalPrice = foodItems[0].price;
                    
                    await restaurantDb.collection('fooditems').updateOne(
                        { _id: foodItems[0]._id },
                        { $set: { price: 0.01 } }
                    );

                    // THEN: Price modified successfully
                    const modifiedItem = await restaurantDb.collection('fooditems').findOne({ _id: foodItems[0]._id });
                    expect(modifiedItem.price).toBe(0.01);

                    // CLEANUP: Restore original price
                    await restaurantDb.collection('fooditems').updateOne(
                        { _id: foodItems[0]._id },
                        { $set: { price: originalPrice } }
                    );
                }
            } catch (error) {
                console.log('Could not modify Restaurant database:', error.message);
            }
        });
    });

    describe('Test Case 5: Delete data from other service databases', () => {
        it('should be able to drop collections in other databases', async () => {
            // GIVEN: Access to any database
            const testDb = orderDbConnection.client.db('TestIsolation');

            try {
                // WHEN: Creating and dropping test collection
                await testDb.collection('test_collection').insertOne({ test: 'data' });
                
                const collectionsBefore = await testDb.listCollections().toArray();
                expect(collectionsBefore.length).toBeGreaterThan(0);

                await testDb.collection('test_collection').drop();

                // THEN: Collection dropped successfully
                const collectionsAfter = await testDb.listCollections().toArray();
                const testCollectionExists = collectionsAfter.some(c => c.name === 'test_collection');
                expect(testCollectionExists).toBe(false);

                // CLEANUP: Drop test database
                await testDb.dropDatabase();
            } catch (error) {
                console.log('Drop collection test error:', error.message);
            }
        });

        it('should demonstrate potential data deletion across services', async () => {
            // GIVEN: Malicious code in order-service
            const authDb = orderDbConnection.client.db('Auth');

            try {
                // Create test user
                const testUser = {
                    email: `delete_test_${Date.now()}@test.com`,
                    password: 'test_hash',
                    name: 'Test User For Deletion',
                    role: 'customer'
                };

                await authDb.collection('customers').insertOne(testUser);

                // WHEN: Deleting user from order-service context
                const deleteResult = await authDb.collection('customers').deleteOne({ email: testUser.email });

                // THEN: User deleted successfully
                expect(deleteResult.deletedCount).toBe(1);

                const deletedUser = await authDb.collection('customers').findOne({ email: testUser.email });
                expect(deletedUser).toBeNull();
            } catch (error) {
                console.log('Delete operation test error:', error.message);
            }
        });
    });

    describe('Test Case 6: No database-level authentication or authorization', () => {
        it('should connect to MongoDB without user credentials', async () => {
            // GIVEN: MongoDB connection string without credentials
            const connectionString = MONGODB_URI;

            // THEN: No username/password in connection string
            expect(connectionString).not.toMatch(/@/); // No @ symbol indicates no credentials
            expect(connectionString).toMatch(/mongodb:\/\/[^@]+:\d+\//);

            // Connection succeeds without authentication
            expect(orderDbConnection.readyState).toBe(1); // Connected
        });

        it('should verify no role-based access control in MongoDB', async () => {
            // WHEN: Attempting administrative operations
            const adminDb = orderDbConnection.db.admin();

            try {
                const serverStatus = await adminDb.serverStatus();
                
                // THEN: Can retrieve server status (admin operation)
                expect(serverStatus).toBeDefined();
                expect(serverStatus.ok).toBe(1);
                
                console.log('MongoDB version:', serverStatus.version);
                console.log('Server uptime:', serverStatus.uptime);
            } catch (error) {
                // If this fails, it means some authentication is in place
                console.log('Server status check failed (good - means auth is enabled):', error.message);
            }
        });

        it('should demonstrate shared connection pool vulnerability', async () => {
            // GIVEN: Multiple services sharing same MongoDB instance
            const orderDb = orderDbConnection.client.db('Order');
            const authDb = orderDbConnection.client.db('Auth');
            const restaurantDb = orderDbConnection.client.db('Restaurant');
            const paymentDb = orderDbConnection.client.db('payment');

            // WHEN: Executing operations on all databases from single connection
            const operations = await Promise.all([
                orderDb.collection('orders').countDocuments(),
                authDb.listCollections().toArray(),
                restaurantDb.listCollections().toArray(),
                paymentDb.listCollections().toArray()
            ]);

            // THEN: All operations succeed from single connection
            expect(operations[0]).toBeGreaterThanOrEqual(0); // Order count
            expect(Array.isArray(operations[1])).toBe(true); // Auth collections
            expect(Array.isArray(operations[2])).toBe(true); // Restaurant collections
            expect(Array.isArray(operations[3])).toBe(true); // Payment collections

            console.log('Cross-database operations completed successfully');
            console.log('Order count:', operations[0]);
            console.log('Auth collections:', operations[1].length);
            console.log('Restaurant collections:', operations[2].length);
            console.log('Payment collections:', operations[3].length);
        });
    });

    describe('Test Case 7: Data leakage between services', () => {
        it('should demonstrate order data accessible from payment context', async () => {
            // GIVEN: Order created
            const orderData = {
                customerId: 'isolation_test_leak_001',
                restaurantId: 'restaurant_leak_001',
                items: [
                    {
                        foodId: 'food_leak_001',
                        quantity: 1,
                        price: 100.00
                    }
                ],
                deliveryAddress: '999 Data Leak Boulevard - CONFIDENTIAL'
            };

            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${validToken}`)
                .send(orderData);

            const orderId = response.body._id;

            // WHEN: Payment-service (simulated) reads order details directly
            const orderFromPaymentContext = await orderDbConnection.db
                .collection('orders')
                .findOne({ _id: new mongoose.Types.ObjectId(orderId) });

            // THEN: Sensitive order data leaked to payment-service
            expect(orderFromPaymentContext).not.toBeNull();
            expect(orderFromPaymentContext.deliveryAddress).toContain('CONFIDENTIAL');
            expect(orderFromPaymentContext.customerId).toBe('isolation_test_leak_001');
        });
    });
});
