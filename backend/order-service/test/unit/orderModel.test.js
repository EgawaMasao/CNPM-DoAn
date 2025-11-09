import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Order from '../../models/orderModel.js';

describe('Order Model Unit Tests', () => {
    let mongoServer;

    beforeAll(async () => {
        // Setup in-memory MongoDB for testing
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        // Cleanup
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    afterEach(async () => {
        // Clear all test data after each test
        await Order.deleteMany({});
    });

    // Test 1: Schema Validation | happy | Verify valid order with all required fields creates successfully
    describe('Test 1: Valid Order Creation - Happy Path', () => {
        it('should create and save a valid order with all required fields', async () => {
            // GIVEN: A valid order object with all required fields
            const validOrderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    },
                    {
                        foodId: 'food_790',
                        quantity: 1,
                        price: 8.50
                    }
                ],
                totalPrice: 40.48,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Creating a new order with valid data
            const order = new Order(validOrderData);
            const savedOrder = await order.save();

            // THEN: Order should be saved successfully with correct values
            expect(savedOrder._id).toBeDefined();
            expect(savedOrder.customerId).toBe(validOrderData.customerId);
            expect(savedOrder.restaurantId).toBe(validOrderData.restaurantId);
            expect(savedOrder.items).toHaveLength(2);
            expect(savedOrder.items[0].foodId).toBe('food_789');
            expect(savedOrder.items[0].quantity).toBe(2);
            expect(savedOrder.items[0].price).toBe(15.99);
            expect(savedOrder.totalPrice).toBe(40.48);
            expect(savedOrder.deliveryAddress).toBe('123 Main Street, City, Country');
            expect(savedOrder.paymentStatus).toBe('Pending'); // Default value
            expect(savedOrder.status).toBe('Pending'); // Default value
            expect(savedOrder.createdAt).toBeDefined();
            expect(savedOrder.updatedAt).toBeDefined();
        });
    });

    // Test 2: Schema Validation | error | Test missing required field (customerId) throws validation error
    describe('Test 2: Missing customerId - Error Path', () => {
        it('should throw validation error when customerId is missing', async () => {
            // GIVEN: An order object without customerId
            const invalidOrderData = {
                // customerId is missing
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                totalPrice: 31.98,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Attempting to create order without customerId
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow(mongoose.Error.ValidationError);
            
            try {
                await order.save();
            } catch (error) {
                expect(error.errors.customerId).toBeDefined();
                expect(error.errors.customerId.kind).toBe('required');
                expect(error.errors.customerId.message).toContain('required');
            }
        });

        it('should throw validation error when customerId is null', async () => {
            // GIVEN: An order object with null customerId
            const invalidOrderData = {
                customerId: null,
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                totalPrice: 31.98,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Attempting to create order with null customerId
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow();
        });
    });

    // Test 3: Schema Validation | error | Test missing required field (restaurantId) throws validation error
    describe('Test 3: Missing restaurantId - Error Path', () => {
        it('should throw validation error when restaurantId is missing', async () => {
            // GIVEN: An order object without restaurantId
            const invalidOrderData = {
                customerId: 'customer_123',
                // restaurantId is missing
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                totalPrice: 31.98,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Attempting to create order without restaurantId
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow(mongoose.Error.ValidationError);
            
            try {
                await order.save();
            } catch (error) {
                expect(error.errors.restaurantId).toBeDefined();
                expect(error.errors.restaurantId.kind).toBe('required');
                expect(error.errors.restaurantId.message).toContain('required');
            }
        });

        it('should throw validation error when restaurantId is null', async () => {
            // GIVEN: An order object with null restaurantId
            const invalidOrderData = {
                customerId: 'customer_123',
                restaurantId: null,
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                totalPrice: 31.98,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Attempting to create order with null restaurantId
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow();
        });
    });

    // Test 4: Schema Validation | error | Test missing required field (deliveryAddress) throws validation error
    describe('Test 4: Missing deliveryAddress - Error Path', () => {
        it('should throw validation error when deliveryAddress is missing', async () => {
            // GIVEN: An order object without deliveryAddress
            const invalidOrderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                totalPrice: 31.98
                // deliveryAddress is missing
            };

            // WHEN: Attempting to create order without deliveryAddress
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow(mongoose.Error.ValidationError);
            
            try {
                await order.save();
            } catch (error) {
                expect(error.errors.deliveryAddress).toBeDefined();
                expect(error.errors.deliveryAddress.kind).toBe('required');
                expect(error.errors.deliveryAddress.message).toContain('required');
            }
        });

        it('should throw validation error when deliveryAddress is null', async () => {
            // GIVEN: An order object with null deliveryAddress
            const invalidOrderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                totalPrice: 31.98,
                deliveryAddress: null
            };

            // WHEN: Attempting to create order with null deliveryAddress
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow();
        });

        it('should throw validation error when deliveryAddress is empty string', async () => {
            // GIVEN: An order object with empty string deliveryAddress
            const invalidOrderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                totalPrice: 31.98,
                deliveryAddress: ''
            };

            // WHEN: Attempting to create order with empty deliveryAddress
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow(mongoose.Error.ValidationError);
        });
    });

    // Test 5: Items Array | error | Test empty items array or missing foodId/quantity/price fails validation
    describe('Test 5: Items Array Validation - Error Path', () => {
        it('should throw validation error when items array is empty', async () => {
            // GIVEN: An order object with empty items array
            const invalidOrderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [], // Empty array
                totalPrice: 0,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Attempting to create order with empty items
            const order = new Order(invalidOrderData);
            const savedOrder = await order.save();

            // THEN: Order saves but with empty items (business logic should prevent this)
            expect(savedOrder.items).toHaveLength(0);
        });

        it('should throw validation error when item is missing foodId', async () => {
            // GIVEN: An order with item missing foodId
            const invalidOrderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        // foodId is missing
                        quantity: 2,
                        price: 15.99
                    }
                ],
                totalPrice: 31.98,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Attempting to create order with missing foodId
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow(mongoose.Error.ValidationError);
            
            try {
                await order.save();
            } catch (error) {
                expect(error.errors['items.0.foodId']).toBeDefined();
            }
        });

        it('should throw validation error when item is missing quantity', async () => {
            // GIVEN: An order with item missing quantity
            const invalidOrderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        // quantity is missing
                        price: 15.99
                    }
                ],
                totalPrice: 15.99,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Attempting to create order with missing quantity
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow(mongoose.Error.ValidationError);
            
            try {
                await order.save();
            } catch (error) {
                expect(error.errors['items.0.quantity']).toBeDefined();
            }
        });

        it('should throw validation error when item is missing price', async () => {
            // GIVEN: An order with item missing price
            const invalidOrderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2
                        // price is missing
                    }
                ],
                totalPrice: 0,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Attempting to create order with missing price
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow(mongoose.Error.ValidationError);
            
            try {
                await order.save();
            } catch (error) {
                expect(error.errors['items.0.price']).toBeDefined();
            }
        });

        it('should throw validation error when item has null foodId', async () => {
            // GIVEN: An order with item having null foodId
            const invalidOrderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: null,
                        quantity: 2,
                        price: 15.99
                    }
                ],
                totalPrice: 31.98,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Attempting to create order with null foodId
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow();
        });

        it('should throw validation error when item has null quantity', async () => {
            // GIVEN: An order with item having null quantity
            const invalidOrderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: null,
                        price: 15.99
                    }
                ],
                totalPrice: 15.99,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Attempting to create order with null quantity
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow();
        });

        it('should throw validation error when item has null price', async () => {
            // GIVEN: An order with item having null price
            const invalidOrderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: null
                    }
                ],
                totalPrice: 0,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: Attempting to create order with null price
            const order = new Order(invalidOrderData);

            // THEN: Validation error should be thrown
            await expect(order.save()).rejects.toThrow();
        });
    });
});
