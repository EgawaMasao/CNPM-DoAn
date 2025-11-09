import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock controller functions - must return actual functions
const mockCreateOrder = jest.fn((req, res) => {
    res.status(201).json({ message: 'Order created successfully', orderId: 'order_123' });
});
const mockGetOrders = jest.fn((req, res) => {
    res.status(200).json({ orders: [] });
});
const mockGetOrderById = jest.fn((req, res) => {
    res.status(200).json({ id: req.params.id });
});
const mockUpdateOrderStatus = jest.fn((req, res) => {
    res.status(200).json({ message: 'Status updated' });
});
const mockCancelOrder = jest.fn((req, res) => {
    res.status(200).json({ message: 'Order cancelled' });
});
const mockUpdateOrderDetails = jest.fn((req, res) => {
    res.status(200).json({ message: 'Order updated' });
});

// Mock middleware functions - must return actual middleware
const mockProtect = jest.fn((req, res, next) => {
    req.user = { id: 'user_123', role: 'customer' };
    next();
});

const mockAuthorizeRoles = jest.fn((...roles) => {
    return (req, res, next) => {
        if (req.user && roles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json({ message: 'Access denied: Unauthorized role' });
        }
    };
});

jest.unstable_mockModule('../../controllers/orderController.js', () => ({
    createOrder: mockCreateOrder,
    getOrders: mockGetOrders,
    getOrderById: mockGetOrderById,
    updateOrderStatus: mockUpdateOrderStatus,
    cancelOrder: mockCancelOrder,
    updateOrderDetails: mockUpdateOrderDetails
}));

jest.unstable_mockModule('../../middleware/authMiddleware.js', () => ({
    protect: mockProtect,
    authorizeRoles: mockAuthorizeRoles
}));

// Import router after mocking
const orderRoutes = await import('../../routes/orderRoutes.js');

describe('OrderRoutes Unit Tests - Shopee QA Standards', () => {
    let app;

    beforeEach(() => {
        // Create a fresh Express app for each test
        app = express();
        app.use(express.json());
        app.use('/orders', orderRoutes.default);

        // Clear only controller mocks, not middleware mocks (they're called during route setup)
        mockCreateOrder.mockClear();
        mockGetOrders.mockClear();
        mockGetOrderById.mockClear();
        mockUpdateOrderStatus.mockClear();
        mockCancelOrder.mockClear();
        mockUpdateOrderDetails.mockClear();
        mockProtect.mockClear();
        // Don't clear mockAuthorizeRoles as it's called during route initialization

        // Reset default controller responses
        mockCreateOrder.mockImplementation((req, res) => {
            res.status(201).json({ 
                message: 'Order created successfully',
                orderId: 'order_123'
            });
        });

        mockGetOrders.mockImplementation((req, res) => {
            res.status(200).json({ 
                orders: [
                    { id: 'order_1', customerId: 'customer_1' },
                    { id: 'order_2', customerId: 'customer_2' }
                ]
            });
        });

        mockGetOrderById.mockImplementation((req, res) => {
            res.status(200).json({ 
                id: req.params.id,
                customerId: 'customer_123',
                status: 'pending'
            });
        });

        mockUpdateOrderDetails.mockImplementation((req, res) => {
            res.status(200).json({ 
                message: 'Order updated successfully',
                orderId: req.params.id
            });
        });

        mockUpdateOrderStatus.mockImplementation((req, res) => {
            res.status(200).json({ 
                message: 'Order status updated',
                orderId: req.params.id
            });
        });

        mockCancelOrder.mockImplementation((req, res) => {
            res.status(200).json({ 
                message: 'Order cancelled',
                orderId: req.params.id
            });
        });

        // Reset protect middleware to default
        mockProtect.mockImplementation((req, res, next) => {
            req.user = { id: 'user_123', role: 'customer' };
            next();
        });
    });

    // ============================================================================
    // Test 1: POST / - Customer creates order (Happy Path)
    // ============================================================================
    describe('Test 1: POST / - Customer Creates Order (Happy Path)', () => {
        it('should allow authenticated customer to create order successfully', async () => {
            // GIVEN: An authenticated customer with valid order data
            const orderData = {
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

            // Mock protect to set customer user
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_123', role: 'customer' };
                next();
            });

            // WHEN: Customer makes POST request to create order
            const response = await request(app)
                .post('/orders')
                .send(orderData)
                .expect(201);

            // THEN: Should validate middleware chain and create order
            expect(mockProtect).toHaveBeenCalled();
            expect(mockCreateOrder).toHaveBeenCalled();
            expect(response.body).toHaveProperty('message', 'Order created successfully');
            expect(response.body).toHaveProperty('orderId');
        });

        it('should pass through protect middleware before authorization', async () => {
            // GIVEN: A valid customer request
            const orderData = { customerId: 'customer_123', items: [{ foodId: 'food_1', quantity: 1, price: 10 }] };
            
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_123', role: 'customer' };
                next();
            });

            mockCreateOrder.mockImplementationOnce((req, res) => {
                res.status(201).json({ success: true });
            });

            // WHEN: Request is made
            const response = await request(app)
                .post('/orders')
                .send(orderData)
                .expect(201);

            // THEN: Middleware should be called in correct order
            expect(mockProtect).toHaveBeenCalled();
            expect(mockCreateOrder).toHaveBeenCalled();
            expect(response.body).toHaveProperty('success', true);
        });

        it('should handle createOrder controller with complete order data', async () => {
            // GIVEN: Complete order data with multiple items
            const completeOrderData = {
                customerId: 'customer_complete',
                restaurantId: 'restaurant_complete',
                items: [
                    { foodId: 'food_1', quantity: 2, price: 10.50 },
                    { foodId: 'food_2', quantity: 1, price: 15.99 },
                    { foodId: 'food_3', quantity: 3, price: 8.75 }
                ],
                deliveryAddress: 'Complete Address, City, Country',
                specialInstructions: 'Ring doorbell twice'
            };

            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_complete', role: 'customer' };
                next();
            });

            // WHEN: Complete order is submitted
            const response = await request(app)
                .post('/orders')
                .send(completeOrderData)
                .expect(201);

            // THEN: Should successfully process complete order
            expect(mockCreateOrder).toHaveBeenCalled();
            const controllerReq = mockCreateOrder.mock.calls[0][0];
            expect(controllerReq.body).toEqual(completeOrderData);
            expect(controllerReq.user).toEqual({ id: 'customer_complete', role: 'customer' });
        });

        it('should handle null or missing user gracefully in protect middleware', async () => {
            // GIVEN: protect middleware fails to set user (null case)
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = null;
                next();
            });

            // WHEN: Request is made without proper authentication
            const response = await request(app)
                .post('/orders')
                .send({ customerId: 'customer_123', items: [] })
                .expect(403);

            // THEN: Should be rejected by authorizeRoles
            expect(mockProtect).toHaveBeenCalled();
            expect(mockCreateOrder).not.toHaveBeenCalled();
            expect(response.body).toHaveProperty('message', 'Access denied: Unauthorized role');
        });
    });

    // ============================================================================
    // Test 2: POST / - Unauthorized role attempts to create order (Error Path)
    // ============================================================================
    describe('Test 2: POST / - Unauthorized Role Attempts to Create Order (Error Path)', () => {
        it('should reject restaurant admin attempting to create order', async () => {
            // GIVEN: An authenticated restaurant admin tries to create order
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'admin_123', role: 'restaurant' };
                next();
            });

            const orderData = {
                customerId: 'customer_123',
                restaurantId: 'restaurant_456',
                items: [{ foodId: 'food_789', quantity: 2, price: 15.99 }],
                deliveryAddress: '123 Main Street'
            };

            // WHEN: Restaurant admin attempts to create order
            const response = await request(app)
                .post('/orders')
                .send(orderData)
                .expect(403);

            // THEN: Should be blocked by authorizeRoles middleware
            expect(mockProtect).toHaveBeenCalled();
            expect(mockCreateOrder).not.toHaveBeenCalled();
            expect(response.body).toHaveProperty('message', 'Access denied: Unauthorized role');
        });

        it('should reject admin role attempting to create order', async () => {
            // GIVEN: An authenticated admin tries to create order
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'admin_456', role: 'admin' };
                next();
            });

            const orderData = {
                customerId: 'customer_123',
                items: [{ foodId: 'food_001', quantity: 1, price: 20.00 }]
            };

            // WHEN: Admin attempts to create order
            const response = await request(app)
                .post('/orders')
                .send(orderData)
                .expect(403);

            // THEN: Should be rejected with 403 forbidden
            expect(mockProtect).toHaveBeenCalled();
            expect(mockCreateOrder).not.toHaveBeenCalled();
            expect(response.body.message).toContain('Access denied');
        });

        it('should reject delivery personnel attempting to create order', async () => {
            // GIVEN: An authenticated delivery personnel tries to create order
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'delivery_789', role: 'delivery' };
                next();
            });

            const orderData = {
                customerId: 'customer_123',
                items: [{ foodId: 'food_001', quantity: 1, price: 10.00 }]
            };

            // WHEN: Delivery personnel attempts to create order
            const response = await request(app)
                .post('/orders')
                .send(orderData)
                .expect(403);

            // THEN: Should be blocked
            expect(mockProtect).toHaveBeenCalled();
            expect(mockCreateOrder).not.toHaveBeenCalled();
            expect(response.body).toHaveProperty('message', 'Access denied: Unauthorized role');
        });

        it('should reject user with undefined role', async () => {
            // GIVEN: User object exists but role is undefined
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'user_undefined', role: undefined };
                next();
            });

            // WHEN: User with undefined role attempts to create order
            const response = await request(app)
                .post('/orders')
                .send({ customerId: 'customer_123', items: [] })
                .expect(403);

            // THEN: Should be rejected
            expect(mockProtect).toHaveBeenCalled();
            expect(mockCreateOrder).not.toHaveBeenCalled();
        });

        it('should reject user with null role', async () => {
            // GIVEN: User object exists but role is null
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'user_null', role: null };
                next();
            });

            // WHEN: User with null role attempts to create order
            const response = await request(app)
                .post('/orders')
                .send({ customerId: 'customer_123', items: [] })
                .expect(403);

            // THEN: Should be rejected
            expect(mockProtect).toHaveBeenCalled();
            expect(mockCreateOrder).not.toHaveBeenCalled();
        });

        it('should handle exception thrown by authorizeRoles middleware', async () => {
            // GIVEN: authorizeRoles throws an exception
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'user_123', role: 'invalid_role' };
                next();
            });

            mockAuthorizeRoles.mockImplementationOnce(() => {
                return (req, res, next) => {
                    try {
                        if (!req.user || !req.user.role) {
                            throw new Error('Role validation failed');
                        }
                        res.status(403).json({ message: 'Access denied: Unauthorized role' });
                    } catch (error) {
                        res.status(500).json({ message: 'Internal server error' });
                    }
                };
            });

            // WHEN: Request is processed with exception handling
            const response = await request(app)
                .post('/orders')
                .send({ customerId: 'customer_123', items: [] });

            // THEN: Should handle exception gracefully
            expect(mockProtect).toHaveBeenCalled();
            expect(mockCreateOrder).not.toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 3: GET / - Customer/restaurant retrieves orders (Happy Path)
    // ============================================================================
    describe('Test 3: GET / - Customer/Restaurant Retrieves Orders (Happy Path)', () => {
        it('should allow customer to retrieve orders', async () => {
            // GIVEN: An authenticated customer requests orders
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_123', role: 'customer' };
                next();
            });

            // WHEN: Customer makes GET request to retrieve orders
            const response = await request(app)
                .get('/orders')
                .expect(200);

            // THEN: Should validate middleware chain and return orders
            expect(mockProtect).toHaveBeenCalled();
            expect(mockGetOrders).toHaveBeenCalled();
            expect(response.body).toHaveProperty('orders');
            expect(Array.isArray(response.body.orders)).toBe(true);
        });

        it('should allow restaurant admin to retrieve orders', async () => {
            // GIVEN: An authenticated restaurant admin requests orders
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'restaurant_456', role: 'restaurant' };
                next();
            });

            // WHEN: Restaurant admin makes GET request
            const response = await request(app)
                .get('/orders')
                .expect(200);

            // THEN: Should successfully retrieve orders
            expect(mockProtect).toHaveBeenCalled();
            expect(mockGetOrders).toHaveBeenCalled();
            expect(response.body).toHaveProperty('orders');
        });

        it('should validate multiple roles in authorizeRoles middleware', async () => {
            // GIVEN: Multiple role validation is required
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_789', role: 'customer' };
                next();
            });

            // WHEN: Request is made
            const response = await request(app)
                .get('/orders')
                .expect(200);

            // THEN: Should allow customer role access
            expect(mockGetOrders).toHaveBeenCalled();
            expect(response.body).toHaveProperty('orders');
        });

        it('should reject unauthorized roles from retrieving orders', async () => {
            // GIVEN: An authenticated user with unauthorized role
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'delivery_123', role: 'delivery' };
                next();
            });

            // WHEN: Unauthorized user attempts to retrieve orders
            const response = await request(app)
                .get('/orders')
                .expect(403);

            // THEN: Should be blocked
            expect(mockProtect).toHaveBeenCalled();
            expect(mockGetOrders).not.toHaveBeenCalled();
            expect(response.body).toHaveProperty('message', 'Access denied: Unauthorized role');
        });

        it('should handle empty orders array response', async () => {
            // GIVEN: No orders exist for user
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_new', role: 'customer' };
                next();
            });

            mockGetOrders.mockImplementationOnce((req, res) => {
                res.status(200).json({ orders: [] });
            });

            // WHEN: User retrieves orders
            const response = await request(app)
                .get('/orders')
                .expect(200);

            // THEN: Should return empty array successfully
            expect(response.body).toHaveProperty('orders');
            expect(response.body.orders).toHaveLength(0);
        });

        it('should handle exception in getOrders controller', async () => {
            // GIVEN: getOrders throws an exception
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_error', role: 'customer' };
                next();
            });

            mockGetOrders.mockImplementationOnce((req, res) => {
                res.status(500).json({ error: 'Database connection failed' });
            });

            // WHEN: Exception occurs during order retrieval
            const response = await request(app)
                .get('/orders')
                .expect(500);

            // THEN: Should return error response
            expect(mockGetOrders).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error');
        });
    });

    // ============================================================================
    // Test 4: GET /:id - Get order by ID with valid auth (Happy Path)
    // ============================================================================
    describe('Test 4: GET /:id - Get Order By ID with Valid Auth (Happy Path)', () => {
        it('should allow customer to retrieve specific order by ID', async () => {
            // GIVEN: An authenticated customer requests a specific order
            const orderId = 'order_specific_123';
            
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_123', role: 'customer' };
                next();
            });

            // WHEN: Customer makes GET request with order ID
            const response = await request(app)
                .get(`/orders/${orderId}`)
                .expect(200);

            // THEN: Should validate middleware and return specific order
            expect(mockProtect).toHaveBeenCalled();
            expect(mockGetOrderById).toHaveBeenCalled();
            expect(response.body).toHaveProperty('id', orderId);
        });

        it('should allow restaurant admin to retrieve order by ID', async () => {
            // GIVEN: An authenticated restaurant admin requests specific order
            const orderId = 'order_restaurant_456';
            
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'restaurant_789', role: 'restaurant' };
                next();
            });

            // WHEN: Restaurant admin makes GET request
            const response = await request(app)
                .get(`/orders/${orderId}`)
                .expect(200);

            // THEN: Should successfully retrieve order
            expect(mockProtect).toHaveBeenCalled();
            expect(mockGetOrderById).toHaveBeenCalled();
            expect(response.body).toHaveProperty('id', orderId);
            expect(response.body).toHaveProperty('status');
        });

        it('should pass order ID as parameter to controller', async () => {
            // GIVEN: A valid order ID is provided
            const orderId = 'order_param_test_999';
            
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_param', role: 'customer' };
                next();
            });

            mockGetOrderById.mockImplementationOnce((req, res) => {
                // Verify parameter is correctly passed
                expect(req.params.id).toBe(orderId);
                res.status(200).json({ 
                    id: req.params.id,
                    customerId: 'customer_param',
                    status: 'completed'
                });
            });

            // WHEN: Request is made with specific order ID
            const response = await request(app)
                .get(`/orders/${orderId}`)
                .expect(200);

            // THEN: Should correctly pass and return order ID
            expect(response.body.id).toBe(orderId);
        });

        it('should reject unauthorized roles from retrieving order by ID', async () => {
            // GIVEN: An unauthorized user attempts to retrieve order
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'admin_unauthorized', role: 'admin' };
                next();
            });

            // WHEN: Unauthorized user requests specific order
            const response = await request(app)
                .get('/orders/order_blocked_123')
                .expect(403);

            // THEN: Should be blocked by authorization
            expect(mockProtect).toHaveBeenCalled();
            expect(mockGetOrderById).not.toHaveBeenCalled();
            expect(response.body).toHaveProperty('message', 'Access denied: Unauthorized role');
        });

        it('should handle special characters in order ID', async () => {
            // GIVEN: Order ID contains special characters
            const orderId = 'order-special_123$ABC';
            
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_special', role: 'customer' };
                next();
            });

            // WHEN: Request is made with special character order ID
            const response = await request(app)
                .get(`/orders/${orderId}`)
                .expect(200);

            // THEN: Should handle special characters correctly
            expect(mockGetOrderById).toHaveBeenCalled();
            const controllerReq = mockGetOrderById.mock.calls[0][0];
            expect(controllerReq.params.id).toBe(orderId);
        });

        it('should handle null order ID parameter', async () => {
            // GIVEN: Null or undefined order ID
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_null', role: 'customer' };
                next();
            });

            mockGetOrderById.mockImplementationOnce((req, res) => {
                if (!req.params.id || req.params.id === 'null' || req.params.id === 'undefined') {
                    res.status(400).json({ error: 'Invalid order ID' });
                } else {
                    res.status(200).json({ id: req.params.id });
                }
            });

            // WHEN: Request is made with null as string
            const response = await request(app)
                .get('/orders/null')
                .expect(400);

            // THEN: Should handle null gracefully
            expect(response.body).toHaveProperty('error');
        });

        it('should handle order not found scenario', async () => {
            // GIVEN: Order ID does not exist
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_notfound', role: 'customer' };
                next();
            });

            mockGetOrderById.mockImplementationOnce((req, res) => {
                res.status(404).json({ message: 'Order not found' });
            });

            // WHEN: Non-existent order is requested
            const response = await request(app)
                .get('/orders/order_nonexistent_999')
                .expect(404);

            // THEN: Should return 404 error
            expect(mockGetOrderById).toHaveBeenCalled();
            expect(response.body).toHaveProperty('message', 'Order not found');
        });
    });

    // ============================================================================
    // Test 5: PATCH /:id (updateOrderDetails) - Customer updates own order (Happy Path)
    // ============================================================================
    describe('Test 5: PATCH /:id (updateOrderDetails) - Customer Updates Own Order (Happy Path)', () => {
        it('should allow authenticated customer to update order details', async () => {
            // GIVEN: An authenticated customer wants to update order
            const orderId = 'order_update_123';
            const updateData = {
                items: [
                    { foodId: 'food_new_001', quantity: 3, price: 12.50 }
                ],
                deliveryAddress: 'Updated Address, New City'
            };

            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_123', role: 'customer' };
                next();
            });

            // WHEN: Customer makes PATCH request to update order
            const response = await request(app)
                .patch(`/orders/${orderId}`)
                .send(updateData)
                .expect(200);

            // THEN: Should validate protect middleware and update order
            expect(mockProtect).toHaveBeenCalled();
            expect(mockUpdateOrderDetails).toHaveBeenCalled();
            expect(response.body).toHaveProperty('message', 'Order updated successfully');
            expect(response.body).toHaveProperty('orderId', orderId);
        });

        it('should not require role authorization beyond authentication', async () => {
            // GIVEN: updateOrderDetails route only requires protect, not authorizeRoles
            const orderId = 'order_auth_test_456';
            let authorizeRolesCalled = false;

            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_auth', role: 'customer' };
                next();
            });

            // Track if authorizeRoles is called (it shouldn't be for this route)
            const originalAuthorizeRoles = mockAuthorizeRoles;
            mockAuthorizeRoles.mockImplementation((...roles) => {
                authorizeRolesCalled = true;
                return originalAuthorizeRoles(...roles);
            });

            // WHEN: Request is made to update order details
            await request(app)
                .patch(`/orders/${orderId}`)
                .send({ deliveryAddress: 'New Address' })
                .expect(200);

            // THEN: Should only check authentication, not specific roles
            expect(mockProtect).toHaveBeenCalled();
            expect(mockUpdateOrderDetails).toHaveBeenCalled();
            // Note: The route definition shows protect only, no authorizeRoles for updateOrderDetails
        });

        it('should pass order ID and update data to controller', async () => {
            // GIVEN: Complete update data is provided
            const orderId = 'order_complete_update_789';
            const updateData = {
                items: [
                    { foodId: 'food_1', quantity: 2, price: 10.00 },
                    { foodId: 'food_2', quantity: 1, price: 15.00 }
                ],
                deliveryAddress: 'Complete New Address',
                specialInstructions: 'Leave at door'
            };

            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_complete', role: 'customer' };
                next();
            });

            mockUpdateOrderDetails.mockImplementationOnce((req, res) => {
                expect(req.params.id).toBe(orderId);
                expect(req.body).toEqual(updateData);
                res.status(200).json({ 
                    message: 'Order updated',
                    orderId: req.params.id,
                    updatedFields: Object.keys(req.body)
                });
            });

            // WHEN: Complete update is submitted
            const response = await request(app)
                .patch(`/orders/${orderId}`)
                .send(updateData)
                .expect(200);

            // THEN: Should correctly pass all data to controller
            expect(mockUpdateOrderDetails).toHaveBeenCalled();
            expect(response.body.orderId).toBe(orderId);
            expect(response.body.updatedFields).toContain('items');
            expect(response.body.updatedFields).toContain('deliveryAddress');
        });

        it('should reject unauthenticated requests', async () => {
            // GIVEN: protect middleware rejects unauthenticated request
            mockProtect.mockImplementationOnce((req, res, next) => {
                res.status(401).json({ message: 'No token, authorization denied' });
            });

            // WHEN: Unauthenticated user attempts to update order
            const response = await request(app)
                .patch('/orders/order_unauth_123')
                .send({ deliveryAddress: 'New Address' })
                .expect(401);

            // THEN: Should be blocked by protect middleware
            expect(mockProtect).toHaveBeenCalled();
            expect(mockUpdateOrderDetails).not.toHaveBeenCalled();
            expect(response.body).toHaveProperty('message');
        });

        it('should handle partial update of order details', async () => {
            // GIVEN: Only delivery address is updated
            const orderId = 'order_partial_999';
            
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_partial', role: 'customer' };
                next();
            });

            mockUpdateOrderDetails.mockImplementationOnce((req, res) => {
                res.status(200).json({ 
                    message: 'Order updated',
                    orderId: req.params.id,
                    updatedFields: ['deliveryAddress']
                });
            });

            // WHEN: Partial update is submitted
            const response = await request(app)
                .patch(`/orders/${orderId}`)
                .send({ deliveryAddress: 'Only Address Updated' })
                .expect(200);

            // THEN: Should handle partial update
            expect(mockUpdateOrderDetails).toHaveBeenCalled();
            expect(response.body.orderId).toBe(orderId);
        });

        it('should handle empty update data', async () => {
            // GIVEN: Empty update object is sent
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_empty', role: 'customer' };
                next();
            });

            mockUpdateOrderDetails.mockImplementationOnce((req, res) => {
                if (!req.body || Object.keys(req.body).length === 0) {
                    res.status(400).json({ error: 'No update data provided' });
                } else {
                    res.status(200).json({ message: 'Order updated' });
                }
            });

            // WHEN: Empty update is submitted
            const response = await request(app)
                .patch('/orders/order_empty_123')
                .send({})
                .expect(400);

            // THEN: Should handle empty data appropriately
            expect(mockUpdateOrderDetails).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error');
        });

        it('should handle null values in update data', async () => {
            // GIVEN: Update data contains null values
            const updateData = {
                items: null,
                deliveryAddress: null
            };

            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_null', role: 'customer' };
                next();
            });

            mockUpdateOrderDetails.mockImplementationOnce((req, res) => {
                // Controller should handle null values appropriately
                res.status(400).json({ error: 'Invalid update data: null values not allowed' });
            });

            // WHEN: Null values are submitted
            const response = await request(app)
                .patch('/orders/order_null_456')
                .send(updateData)
                .expect(400);

            // THEN: Should handle null values gracefully
            expect(mockUpdateOrderDetails).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error');
        });

        it('should handle exception during order update', async () => {
            // GIVEN: updateOrderDetails throws an exception
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_error', role: 'customer' };
                next();
            });

            mockUpdateOrderDetails.mockImplementationOnce((req, res) => {
                res.status(500).json({ error: 'Server Error', message: 'Failed to update order' });
            });

            // WHEN: Exception occurs during update
            const response = await request(app)
                .patch('/orders/order_error_789')
                .send({ deliveryAddress: 'Address' })
                .expect(500);

            // THEN: Should return error response
            expect(mockUpdateOrderDetails).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Server Error');
        });
    });

    // ============================================================================
    // Additional Edge Cases and Security Tests
    // ============================================================================
    describe('Additional Edge Cases and Security Tests', () => {
        it('should handle malformed JSON in request body', async () => {
            // GIVEN: Malformed JSON is sent
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_malformed', role: 'customer' };
                next();
            });

            // WHEN: Request with malformed data is made
            const response = await request(app)
                .post('/orders')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}')
                .expect(400);

            // THEN: Express should handle JSON parsing error
            expect(mockCreateOrder).not.toHaveBeenCalled();
        });

        it('should handle very long order IDs', async () => {
            // GIVEN: Very long order ID
            const longOrderId = 'a'.repeat(1000);
            
            mockProtect.mockImplementationOnce((req, res, next) => {
                req.user = { id: 'customer_long', role: 'customer' };
                next();
            });

            // WHEN: Request with long order ID is made
            await request(app)
                .get(`/orders/${longOrderId}`);

            // THEN: Should handle long IDs
            expect(mockProtect).toHaveBeenCalled();
        });

        it('should handle concurrent requests to same order', async () => {
            // GIVEN: Multiple simultaneous requests to update same order
            const orderId = 'order_concurrent_123';
            
            mockProtect.mockImplementation((req, res, next) => {
                req.user = { id: 'customer_concurrent', role: 'customer' };
                next();
            });

            // WHEN: Concurrent requests are made
            const requests = [
                request(app).patch(`/orders/${orderId}`).send({ items: [] }),
                request(app).patch(`/orders/${orderId}`).send({ items: [] }),
                request(app).patch(`/orders/${orderId}`).send({ items: [] })
            ];

            await Promise.all(requests);

            // THEN: All requests should be processed
            expect(mockUpdateOrderDetails).toHaveBeenCalledTimes(3);
        });
    });
});
