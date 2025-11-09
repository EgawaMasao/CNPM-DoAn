import { jest } from '@jest/globals';

// Mock Order model before importing controller
const mockOrder = {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    save: jest.fn(),
    deleteMany: jest.fn()
};

const mockOrderConstructor = jest.fn().mockImplementation((data) => {
    return {
        ...data,
        save: jest.fn().mockResolvedValue({
            _id: 'mock_order_id_123',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        })
    };
});

// Assign static methods to constructor
Object.assign(mockOrderConstructor, mockOrder);

jest.unstable_mockModule('../../models/orderModel.js', () => ({
    default: mockOrderConstructor
}));

// Import controller after mocking
const { createOrder, updateOrderDetails } = await import('../../controllers/orderController.js');

describe('OrderController Unit Tests - Shopee QA Standards', () => {
    let req, res, mockOrderInstance;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Setup standard request and response mocks
        req = {
            body: {},
            params: {},
            user: { id: 'user_123', role: 'customer' }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        // Setup mock order instance
        mockOrderInstance = {
            _id: 'mock_order_id_123',
            save: jest.fn(),
            items: [],
            totalPrice: 0
        };

        // Console.log and console.error mocks to suppress output during tests
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        console.log.mockRestore();
        console.error.mockRestore();
    });

    // ============================================================================
    // Test 1: createOrder | error | Missing customerId validation
    // ============================================================================
    describe('Test 1: createOrder - Missing customerId Validation (Error Path)', () => {
        it('should return 400 error when customerId is missing', async () => {
            // GIVEN: A request body without customerId
            req.body = {
                // customerId is missing
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called with missing customerId
            await createOrder(req, res);

            // THEN: Should return 400 status with appropriate error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Customer ID is required'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });

        it('should return 400 error when customerId is null', async () => {
            // GIVEN: A request body with null customerId
            req.body = {
                customerId: null,
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called with null customerId
            await createOrder(req, res);

            // THEN: Should return 400 status with appropriate error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Customer ID is required'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });

        it('should return 400 error when customerId is undefined', async () => {
            // GIVEN: A request body with undefined customerId
            req.body = {
                customerId: undefined,
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called with undefined customerId
            await createOrder(req, res);

            // THEN: Should return 400 status with appropriate error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Customer ID is required'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });

        it('should return 400 error when customerId is empty string', async () => {
            // GIVEN: A request body with empty string customerId
            req.body = {
                customerId: '',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called with empty customerId
            await createOrder(req, res);

            // THEN: Should return 400 status with appropriate error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Customer ID is required'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 2: createOrder | error | Invalid items array validation
    // ============================================================================
    describe('Test 2: createOrder - Invalid Items Array Validation (Error Path)', () => {
        it('should return 400 error when items is not provided', async () => {
            // GIVEN: A request body without items
            req.body = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                // items is missing
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called without items
            await createOrder(req, res);

            // THEN: Should return 400 status with appropriate error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Items are required and must be a non-empty array'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });

        it('should return 400 error when items is null', async () => {
            // GIVEN: A request body with null items
            req.body = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: null,
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called with null items
            await createOrder(req, res);

            // THEN: Should return 400 status with appropriate error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Items are required and must be a non-empty array'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });

        it('should return 400 error when items is empty array', async () => {
            // GIVEN: A request body with empty items array
            req.body = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [],
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called with empty items
            await createOrder(req, res);

            // THEN: Should return 400 status with appropriate error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Items are required and must be a non-empty array'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });

        it('should return 400 error when items is not an array', async () => {
            // GIVEN: A request body with items as a non-array type
            req.body = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: 'invalid_string',
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called with non-array items
            await createOrder(req, res);

            // THEN: Should return 400 status with appropriate error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Items are required and must be a non-empty array'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });

        it('should return 400 error when item is missing foodId', async () => {
            // GIVEN: A request body with item missing foodId
            req.body = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        // foodId is missing
                        quantity: 2,
                        price: 15.99
                    }
                ],
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called with invalid item structure
            await createOrder(req, res);

            // THEN: Should return 400 status with appropriate error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Item at index 0 is missing required fields (foodId, quantity, price)'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });

        it('should return 400 error when item is missing quantity', async () => {
            // GIVEN: A request body with item missing quantity
            req.body = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        // quantity is missing
                        price: 15.99
                    }
                ],
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called with invalid item structure
            await createOrder(req, res);

            // THEN: Should return 400 status with appropriate error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Item at index 0 is missing required fields (foodId, quantity, price)'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });

        it('should return 400 error when item is missing price', async () => {
            // GIVEN: A request body with item missing price
            req.body = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2
                        // price is missing
                    }
                ],
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called with invalid item structure
            await createOrder(req, res);

            // THEN: Should return 400 status with appropriate error message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Item at index 0 is missing required fields (foodId, quantity, price)'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });

        it('should return 400 error when multiple items have missing fields', async () => {
            // GIVEN: A request body with first item valid but second item missing fields
            req.body = {
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
                        // quantity and price missing
                    }
                ],
                deliveryAddress: '123 Main Street, City, Country'
            };

            // WHEN: createOrder is called with invalid second item
            await createOrder(req, res);

            // THEN: Should return 400 status with error for second item
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Item at index 1 is missing required fields (foodId, quantity, price)'
            });
            expect(mockOrderConstructor).not.toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 3: createOrder | happy | Valid order creation with price calculation
    // ============================================================================
    describe('Test 3: createOrder - Valid Order Creation with Price Calculation (Happy Path)', () => {
        it('should create order successfully with correct price calculation for single item', async () => {
            // GIVEN: A valid request body with single item
            req.body = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_789',
                        quantity: 2,
                        price: 15.99
                    }
                ],
                deliveryAddress: '123 Main Street, City, Country'
            };

            const expectedTotalPrice = 2 * 15.99; // 31.98

            // Setup mock to return saved order
            const mockSavedOrder = {
                _id: 'mock_order_id_123',
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: req.body.items,
                totalPrice: expectedTotalPrice,
                deliveryAddress: '123 Main Street, City, Country',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockOrderConstructor.mockImplementationOnce((data) => ({
                ...data,
                save: jest.fn().mockResolvedValue(mockSavedOrder)
            }));

            // WHEN: createOrder is called with valid data
            await createOrder(req, res);

            // THEN: Should create order with correct price calculation
            expect(mockOrderConstructor).toHaveBeenCalledWith({
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: req.body.items,
                totalPrice: expectedTotalPrice,
                deliveryAddress: '123 Main Street, City, Country'
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(mockSavedOrder);
        });

        it('should create order successfully with correct price calculation for multiple items', async () => {
            // GIVEN: A valid request body with multiple items
            req.body = {
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
                        quantity: 3,
                        price: 8.50
                    },
                    {
                        foodId: 'food_791',
                        quantity: 1,
                        price: 12.75
                    }
                ],
                deliveryAddress: '456 Oak Avenue, Downtown, Country'
            };

            // Calculate expected total: (2 * 15.99) + (3 * 8.50) + (1 * 12.75) = 31.98 + 25.50 + 12.75 = 70.23
            const expectedTotalPrice = (2 * 15.99) + (3 * 8.50) + (1 * 12.75);

            // Setup mock to return saved order
            const mockSavedOrder = {
                _id: 'mock_order_id_456',
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: req.body.items,
                totalPrice: expectedTotalPrice,
                deliveryAddress: '456 Oak Avenue, Downtown, Country',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockOrderConstructor.mockImplementationOnce((data) => ({
                ...data,
                save: jest.fn().mockResolvedValue(mockSavedOrder)
            }));

            // WHEN: createOrder is called with multiple items
            await createOrder(req, res);

            // THEN: Should create order with correctly calculated total price
            expect(mockOrderConstructor).toHaveBeenCalledWith({
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: req.body.items,
                totalPrice: expectedTotalPrice,
                deliveryAddress: '456 Oak Avenue, Downtown, Country'
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(mockSavedOrder);
        });

        it('should create order successfully with decimal price calculations', async () => {
            // GIVEN: A valid request body with decimal prices
            req.body = {
                customerId: 'customer_789',
                restaurantId: 'restaurant_999',
                items: [
                    {
                        foodId: 'food_001',
                        quantity: 5,
                        price: 7.49
                    },
                    {
                        foodId: 'food_002',
                        quantity: 2,
                        price: 13.99
                    }
                ],
                deliveryAddress: '789 Pine Street, Suburb, Country'
            };

            // Calculate expected total: (5 * 7.49) + (2 * 13.99) = 37.45 + 27.98 = 65.43
            const expectedTotalPrice = (5 * 7.49) + (2 * 13.99);

            // Setup mock to return saved order
            const mockSavedOrder = {
                _id: 'mock_order_id_789',
                customerId: 'customer_789',
                restaurantId: 'restaurant_999',
                items: req.body.items,
                totalPrice: expectedTotalPrice,
                deliveryAddress: '789 Pine Street, Suburb, Country',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockOrderConstructor.mockImplementationOnce((data) => ({
                ...data,
                save: jest.fn().mockResolvedValue(mockSavedOrder)
            }));

            // WHEN: createOrder is called with decimal prices
            await createOrder(req, res);

            // THEN: Should handle decimal calculations correctly
            expect(mockOrderConstructor).toHaveBeenCalledWith({
                customerId: 'customer_789',
                restaurantId: 'restaurant_999',
                items: req.body.items,
                totalPrice: expectedTotalPrice,
                deliveryAddress: '789 Pine Street, Suburb, Country'
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(mockSavedOrder);
        });

        it('should create order successfully and verify all required fields are passed', async () => {
            // GIVEN: A complete valid request body
            req.body = {
                customerId: 'customer_complete',
                restaurantId: 'restaurant_complete',
                items: [
                    {
                        foodId: 'food_complete',
                        quantity: 1,
                        price: 20.00
                    }
                ],
                deliveryAddress: 'Complete Address, Full City, Country Code'
            };

            const expectedTotalPrice = 1 * 20.00;

            // Setup mock to return saved order
            const mockSavedOrder = {
                _id: 'mock_order_complete',
                customerId: 'customer_complete',
                restaurantId: 'restaurant_complete',
                items: req.body.items,
                totalPrice: expectedTotalPrice,
                deliveryAddress: 'Complete Address, Full City, Country Code',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            mockOrderConstructor.mockImplementationOnce((data) => ({
                ...data,
                save: jest.fn().mockResolvedValue(mockSavedOrder)
            }));

            // WHEN: createOrder is called with complete data
            await createOrder(req, res);

            // THEN: Should create order with all fields correctly passed
            const callArgs = mockOrderConstructor.mock.calls[0][0];
            expect(callArgs).toHaveProperty('customerId', 'customer_complete');
            expect(callArgs).toHaveProperty('restaurantId', 'restaurant_complete');
            expect(callArgs).toHaveProperty('items');
            expect(callArgs).toHaveProperty('totalPrice', expectedTotalPrice);
            expect(callArgs).toHaveProperty('deliveryAddress', 'Complete Address, Full City, Country Code');
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(mockSavedOrder);
        });
    });

    // ============================================================================
    // Test 4: updateOrderDetails | happy | Update items with price recalculation
    // ============================================================================
    describe('Test 4: updateOrderDetails - Update Items with Price Recalculation (Happy Path)', () => {
        it('should update order items and recalculate total price correctly', async () => {
            // GIVEN: An existing order and new items to update
            req.params = { id: 'order_123' };
            req.body = {
                items: [
                    {
                        foodId: 'food_new_001',
                        quantity: 3,
                        price: 12.50
                    },
                    {
                        foodId: 'food_new_002',
                        quantity: 2,
                        price: 18.75
                    }
                ]
            };

            // Expected total: (3 * 12.50) + (2 * 18.75) = 37.50 + 37.50 = 75.00
            const expectedTotalPrice = (3 * 12.50) + (2 * 18.75);

            // Mock existing order
            const mockExistingOrder = {
                _id: 'order_123',
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [
                    {
                        foodId: 'food_old_001',
                        quantity: 1,
                        price: 10.00
                    }
                ],
                totalPrice: 10.00,
                deliveryAddress: 'Old Address',
                save: jest.fn().mockResolvedValue({
                    _id: 'order_123',
                    customerId: 'customer_123',
                    restaurantId: 'restaurant_456',
                    items: req.body.items,
                    totalPrice: expectedTotalPrice,
                    deliveryAddress: 'Old Address'
                })
            };

            mockOrderConstructor.findById = jest.fn().mockResolvedValue(mockExistingOrder);

            // WHEN: updateOrderDetails is called with new items
            await updateOrderDetails(req, res);

            // THEN: Should update items and recalculate total price
            expect(mockOrderConstructor.findById).toHaveBeenCalledWith('order_123');
            expect(mockExistingOrder.items).toEqual(req.body.items);
            expect(mockExistingOrder.totalPrice).toBe(expectedTotalPrice);
            expect(mockExistingOrder.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should update only items without changing delivery address', async () => {
            // GIVEN: An existing order and only items update
            req.params = { id: 'order_456' };
            req.body = {
                items: [
                    {
                        foodId: 'food_updated',
                        quantity: 5,
                        price: 9.99
                    }
                ]
            };

            const expectedTotalPrice = 5 * 9.99; // 49.95
            const originalAddress = 'Original Delivery Address';

            // Mock existing order
            const mockExistingOrder = {
                _id: 'order_456',
                customerId: 'customer_456',
                restaurantId: 'restaurant_789',
                items: [
                    {
                        foodId: 'food_original',
                        quantity: 2,
                        price: 15.00
                    }
                ],
                totalPrice: 30.00,
                deliveryAddress: originalAddress,
                save: jest.fn().mockResolvedValue({
                    _id: 'order_456',
                    customerId: 'customer_456',
                    restaurantId: 'restaurant_789',
                    items: req.body.items,
                    totalPrice: expectedTotalPrice,
                    deliveryAddress: originalAddress
                })
            };

            mockOrderConstructor.findById = jest.fn().mockResolvedValue(mockExistingOrder);

            // WHEN: updateOrderDetails is called with only items
            await updateOrderDetails(req, res);

            // THEN: Should update items but preserve delivery address
            expect(mockExistingOrder.items).toEqual(req.body.items);
            expect(mockExistingOrder.totalPrice).toBe(expectedTotalPrice);
            expect(mockExistingOrder.deliveryAddress).toBe(originalAddress);
            expect(mockExistingOrder.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should update delivery address without changing items or price', async () => {
            // GIVEN: An existing order and only delivery address update
            req.params = { id: 'order_789' };
            req.body = {
                deliveryAddress: 'New Updated Delivery Address'
            };

            const originalItems = [
                {
                    foodId: 'food_original',
                    quantity: 2,
                    price: 15.00
                }
            ];
            const originalTotalPrice = 30.00;

            // Mock existing order
            const mockExistingOrder = {
                _id: 'order_789',
                customerId: 'customer_789',
                restaurantId: 'restaurant_999',
                items: originalItems,
                totalPrice: originalTotalPrice,
                deliveryAddress: 'Old Address',
                save: jest.fn().mockResolvedValue({
                    _id: 'order_789',
                    customerId: 'customer_789',
                    restaurantId: 'restaurant_999',
                    items: originalItems,
                    totalPrice: originalTotalPrice,
                    deliveryAddress: 'New Updated Delivery Address'
                })
            };

            mockOrderConstructor.findById = jest.fn().mockResolvedValue(mockExistingOrder);

            // WHEN: updateOrderDetails is called with only delivery address
            await updateOrderDetails(req, res);

            // THEN: Should update delivery address but preserve items and price
            expect(mockExistingOrder.deliveryAddress).toBe('New Updated Delivery Address');
            expect(mockExistingOrder.items).toEqual(originalItems);
            expect(mockExistingOrder.totalPrice).toBe(originalTotalPrice);
            expect(mockExistingOrder.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should update both items and delivery address with price recalculation', async () => {
            // GIVEN: An existing order and both items and delivery address to update
            req.params = { id: 'order_complete' };
            req.body = {
                items: [
                    {
                        foodId: 'food_001',
                        quantity: 4,
                        price: 11.25
                    },
                    {
                        foodId: 'food_002',
                        quantity: 1,
                        price: 22.50
                    }
                ],
                deliveryAddress: 'Completely New Address, New City, New Country'
            };

            // Expected total: (4 * 11.25) + (1 * 22.50) = 45.00 + 22.50 = 67.50
            const expectedTotalPrice = (4 * 11.25) + (1 * 22.50);

            // Mock existing order
            const mockExistingOrder = {
                _id: 'order_complete',
                customerId: 'customer_complete',
                restaurantId: 'restaurant_complete',
                items: [
                    {
                        foodId: 'food_old',
                        quantity: 1,
                        price: 10.00
                    }
                ],
                totalPrice: 10.00,
                deliveryAddress: 'Old Address',
                save: jest.fn().mockResolvedValue({
                    _id: 'order_complete',
                    customerId: 'customer_complete',
                    restaurantId: 'restaurant_complete',
                    items: req.body.items,
                    totalPrice: expectedTotalPrice,
                    deliveryAddress: req.body.deliveryAddress
                })
            };

            mockOrderConstructor.findById = jest.fn().mockResolvedValue(mockExistingOrder);

            // WHEN: updateOrderDetails is called with both items and delivery address
            await updateOrderDetails(req, res);

            // THEN: Should update both fields and recalculate price
            expect(mockExistingOrder.items).toEqual(req.body.items);
            expect(mockExistingOrder.totalPrice).toBe(expectedTotalPrice);
            expect(mockExistingOrder.deliveryAddress).toBe('Completely New Address, New City, New Country');
            expect(mockExistingOrder.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should handle complex price recalculation with multiple items and decimal values', async () => {
            // GIVEN: An order update with complex pricing scenarios
            req.params = { id: 'order_complex' };
            req.body = {
                items: [
                    {
                        foodId: 'food_001',
                        quantity: 7,
                        price: 6.49
                    },
                    {
                        foodId: 'food_002',
                        quantity: 3,
                        price: 14.99
                    },
                    {
                        foodId: 'food_003',
                        quantity: 2,
                        price: 8.75
                    },
                    {
                        foodId: 'food_004',
                        quantity: 1,
                        price: 25.00
                    }
                ]
            };

            // Expected total: (7 * 6.49) + (3 * 14.99) + (2 * 8.75) + (1 * 25.00)
            //               = 45.43 + 44.97 + 17.50 + 25.00 = 132.90
            const expectedTotalPrice = (7 * 6.49) + (3 * 14.99) + (2 * 8.75) + (1 * 25.00);

            // Mock existing order
            const mockExistingOrder = {
                _id: 'order_complex',
                customerId: 'customer_complex',
                restaurantId: 'restaurant_complex',
                items: [],
                totalPrice: 0,
                deliveryAddress: 'Complex Address',
                save: jest.fn().mockResolvedValue({
                    _id: 'order_complex',
                    customerId: 'customer_complex',
                    restaurantId: 'restaurant_complex',
                    items: req.body.items,
                    totalPrice: expectedTotalPrice,
                    deliveryAddress: 'Complex Address'
                })
            };

            mockOrderConstructor.findById = jest.fn().mockResolvedValue(mockExistingOrder);

            // WHEN: updateOrderDetails is called with complex items
            await updateOrderDetails(req, res);

            // THEN: Should correctly calculate total with decimal precision
            expect(mockExistingOrder.items).toEqual(req.body.items);
            expect(mockExistingOrder.totalPrice).toBe(expectedTotalPrice);
            expect(mockExistingOrder.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should return 404 when order is not found', async () => {
            // GIVEN: A non-existent order ID
            req.params = { id: 'non_existent_order' };
            req.body = {
                items: [
                    {
                        foodId: 'food_001',
                        quantity: 1,
                        price: 10.00
                    }
                ]
            };

            // Mock Order.findById to return null (order not found)
            mockOrderConstructor.findById = jest.fn().mockResolvedValue(null);

            // WHEN: updateOrderDetails is called with non-existent order
            await updateOrderDetails(req, res);

            // THEN: Should return 404 error
            expect(mockOrderConstructor.findById).toHaveBeenCalledWith('non_existent_order');
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Order not found'
            });
        });

        it('should handle database save exceptions gracefully', async () => {
            // GIVEN: An existing order but save operation fails
            req.params = { id: 'order_error' };
            req.body = {
                items: [
                    {
                        foodId: 'food_001',
                        quantity: 1,
                        price: 10.00
                    }
                ]
            };

            const mockError = new Error('Database connection failed');

            // Mock existing order with save that throws error
            const mockExistingOrder = {
                _id: 'order_error',
                customerId: 'customer_error',
                restaurantId: 'restaurant_error',
                items: [],
                totalPrice: 0,
                deliveryAddress: 'Error Address',
                save: jest.fn().mockRejectedValue(mockError)
            };

            mockOrderConstructor.findById = jest.fn().mockResolvedValue(mockExistingOrder);

            // WHEN: updateOrderDetails is called and save fails
            await updateOrderDetails(req, res);

            // THEN: Should return 500 error
            expect(mockExistingOrder.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Server Error'
            });
        });
    });
});
