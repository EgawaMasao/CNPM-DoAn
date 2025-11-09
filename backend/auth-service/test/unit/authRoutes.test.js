// backend/auth-service/test/unit/authRoutes.test.js
const express = require('express');
const request = require('supertest');

// Create mock functions that can be reconfigured per test
const mockRegister = jest.fn();
const mockLogin = jest.fn();
const mockGetProfile = jest.fn();
const mockUpdateProfile = jest.fn();
const mockProtect = jest.fn();

// Mock dependencies BEFORE importing routes
jest.mock('../../controllers/customerController', () => ({
    register: mockRegister,
    login: mockLogin,
    getProfile: mockGetProfile,
    updateProfile: mockUpdateProfile
}));

jest.mock('../../middlewares/auth', () => ({
    protect: mockProtect
}));

// NOW import routes with mocked dependencies
const authRoutes = require('../../routes/authRoutes');
const authController = require('../../controllers/customerController');
const { protect } = require('../../middlewares/auth');

describe('AuthRoutes Unit Tests - Shopee QA Standards', () => {
    let app;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Create a fresh Express app for each test
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);

        // Setup DEFAULT mock implementations (can be overridden in tests)
        mockRegister.mockImplementation((req, res) => {
            return res.status(201).json({ status: 'success', message: 'Registration successful' });
        });

        mockLogin.mockImplementation((req, res) => {
            return res.status(200).json({ status: 'success', message: 'Login successful' });
        });

        mockGetProfile.mockImplementation((req, res) => {
            return res.status(200).json({ status: 'success', message: 'Profile retrieved' });
        });

        mockUpdateProfile.mockImplementation((req, res) => {
            return res.status(200).json({ status: 'success', message: 'Profile updated' });
        });

        mockProtect.mockImplementation((req, res, next) => {
            req.userId = 'mock-user-id-123';
            req.userRole = 'customer';
            return next();
        });
    });

    // ============================================================================
    // Test 1: POST /register/customer - Routes to register controller (Happy Path)
    // ============================================================================
    describe('Test 1: POST /register/customer - Validates Router Correctly Routes to Register Controller', () => {
        it('should route POST /register/customer to authController.register', async () => {
            // GIVEN: Valid registration request data
            const registrationData = {
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@customer.com',
                phone: '+1234567890',
                password: 'SecurePass123!'
            };

            // WHEN: POST request is made to /api/auth/register/customer
            const response = await request(app)
                .post('/api/auth/register/customer')
                .send(registrationData)
                .expect(201);

            // THEN: Should call authController.register with request data
            expect(authController.register).toHaveBeenCalledTimes(1);
            expect(authController.register).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: registrationData
                }),
                expect.any(Object),
                expect.any(Function)
            );
            expect(response.body).toEqual({
                status: 'success',
                message: 'Registration successful'
            });
        });

        it('should pass request body to register controller', async () => {
            // GIVEN: Registration data with all fields
            const fullRegistrationData = {
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob@customer.com',
                phone: '+9876543210',
                password: 'Password456!',
                location: '123 Main Street'
            };

            // WHEN: POST request is made with complete data
            await request(app)
                .post('/api/auth/register/customer')
                .send(fullRegistrationData)
                .expect(201);

            // THEN: Should pass all fields to controller
            expect(authController.register).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: expect.objectContaining({
                        firstName: 'Bob',
                        lastName: 'Johnson',
                        email: 'bob@customer.com',
                        phone: '+9876543210',
                        password: 'Password456!',
                        location: '123 Main Street'
                    })
                }),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should handle JSON content type for registration', async () => {
            // GIVEN: Registration request with JSON content type
            const registrationData = {
                firstName: 'Charlie',
                lastName: 'Brown',
                email: 'charlie@customer.com',
                phone: '+1111111111',
                password: 'Password789!'
            };

            // WHEN: POST request is made with Content-Type: application/json
            const response = await request(app)
                .post('/api/auth/register/customer')
                .set('Content-Type', 'application/json')
                .send(registrationData)
                .expect(201);

            // THEN: Should process JSON data correctly
            expect(authController.register).toHaveBeenCalled();
            expect(response.headers['content-type']).toMatch(/json/);
        });

        it('should not call protect middleware for registration route', async () => {
            // GIVEN: Registration request (public route)
            const registrationData = {
                firstName: 'David',
                lastName: 'Wilson',
                email: 'david@customer.com',
                phone: '+2222222222',
                password: 'SecurePass!'
            };

            // WHEN: POST request is made to registration endpoint
            await request(app)
                .post('/api/auth/register/customer')
                .send(registrationData)
                .expect(201);

            // THEN: Should not call protect middleware (public route)
            expect(protect).not.toHaveBeenCalled();
            expect(authController.register).toHaveBeenCalled();
        });

        it('should handle empty request body to register route', async () => {
            // GIVEN: Empty registration request body
            mockRegister.mockImplementation((req, res) => {
                return res.status(400).json({ message: 'Please provide all required fields.' });
            });

            // WHEN: POST request is made with empty body
            const response = await request(app)
                .post('/api/auth/register/customer')
                .send({})
                .expect(400);

            // THEN: Should pass empty body to controller for validation
            expect(authController.register).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: {}
                }),
                expect.any(Object),
                expect.any(Function)
            );
            expect(response.body.message).toBe('Please provide all required fields.');
        });

        it('should support POST method only for registration route', async () => {
            // GIVEN: Registration endpoint that only supports POST
            const registrationData = {
                firstName: 'Eve',
                lastName: 'Martinez',
                email: 'eve@customer.com',
                phone: '+3333333333',
                password: 'Password123!'
            };

            // WHEN: GET request is made to registration endpoint (wrong method)
            await request(app)
                .get('/api/auth/register/customer')
                .send(registrationData)
                .expect(404);

            // THEN: Should not call register controller for wrong HTTP method
            expect(authController.register).not.toHaveBeenCalled();
        });

        it('should pass next function to register controller for error handling', async () => {
            // GIVEN: Registration data and mock error in controller
            const registrationData = {
                firstName: 'Frank',
                lastName: 'Garcia',
                email: 'frank@customer.com',
                phone: '+4444444444',
                password: 'Password456!'
            };

            mockRegister.mockImplementation((req, res, next) => {
                const error = new Error('Database connection failed');
                return next(error);
            });

            // Add error handler to app
            app.use((err, req, res, next) => {
                res.status(500).json({ error: err.message });
            });

            // WHEN: POST request is made and controller throws error
            await request(app)
                .post('/api/auth/register/customer')
                .send(registrationData)
                .expect(500);

            // THEN: Should call register with next function for error handling
            expect(authController.register).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(Object),
                expect.any(Function)
            );
        });
    });

    // ============================================================================
    // Test 2: POST /login - Routes to login controller (Happy Path)
    // ============================================================================
    describe('Test 2: POST /login - Validates Router Correctly Routes to Login Controller', () => {
        it('should route POST /login to authController.login', async () => {
            // GIVEN: Valid login credentials
            const loginCredentials = {
                email: 'alice@customer.com',
                password: 'CorrectPassword123!'
            };

            // WHEN: POST request is made to /api/auth/login
            const response = await request(app)
                .post('/api/auth/login')
                .send(loginCredentials)
                .expect(200);

            // THEN: Should call authController.login with credentials
            expect(authController.login).toHaveBeenCalledTimes(1);
            expect(authController.login).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: loginCredentials
                }),
                expect.any(Object),
                expect.any(Function)
            );
            expect(response.body).toEqual({
                status: 'success',
                message: 'Login successful'
            });
        });

        it('should pass email and password to login controller', async () => {
            // GIVEN: Login credentials
            const loginData = {
                email: 'bob@customer.com',
                password: 'MySecurePassword456!'
            };

            // WHEN: POST request is made with credentials
            await request(app)
                .post('/api/auth/login')
                .send(loginData)
                .expect(200);

            // THEN: Should pass both email and password to controller
            expect(authController.login).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: expect.objectContaining({
                        email: 'bob@customer.com',
                        password: 'MySecurePassword456!'
                    })
                }),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should handle JSON content type for login', async () => {
            // GIVEN: Login request with JSON content type
            const loginCredentials = {
                email: 'charlie@customer.com',
                password: 'Password789!'
            };

            // WHEN: POST request is made with Content-Type: application/json
            const response = await request(app)
                .post('/api/auth/login')
                .set('Content-Type', 'application/json')
                .send(loginCredentials)
                .expect(200);

            // THEN: Should process JSON credentials correctly
            expect(authController.login).toHaveBeenCalled();
            expect(response.headers['content-type']).toMatch(/json/);
        });

        it('should not call protect middleware for login route', async () => {
            // GIVEN: Login request (public route)
            const loginCredentials = {
                email: 'david@customer.com',
                password: 'SecurePass!'
            };

            // WHEN: POST request is made to login endpoint
            await request(app)
                .post('/api/auth/login')
                .send(loginCredentials)
                .expect(200);

            // THEN: Should not call protect middleware (public route)
            expect(protect).not.toHaveBeenCalled();
            expect(authController.login).toHaveBeenCalled();
        });

        it('should handle empty request body to login route', async () => {
            // GIVEN: Empty login request body
            mockLogin.mockImplementation((req, res) => {
                return res.status(400).json({ message: 'Email and password are required.' });
            });

            // WHEN: POST request is made with empty body
            const response = await request(app)
                .post('/api/auth/login')
                .send({})
                .expect(400);

            // THEN: Should pass empty body to controller for validation
            expect(authController.login).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: {}
                }),
                expect.any(Object),
                expect.any(Function)
            );
            expect(response.body.message).toBe('Email and password are required.');
        });

        it('should handle invalid credentials through controller', async () => {
            // GIVEN: Invalid login credentials
            const invalidCredentials = {
                email: 'invalid@customer.com',
                password: 'WrongPassword!'
            };

            mockLogin.mockImplementation((req, res) => {
                return res.status(401).json({ message: 'Invalid credentials.' });
            });

            // WHEN: POST request is made with invalid credentials
            const response = await request(app)
                .post('/api/auth/login')
                .send(invalidCredentials)
                .expect(401);

            // THEN: Should route to controller which handles validation
            expect(authController.login).toHaveBeenCalled();
            expect(response.body.message).toBe('Invalid credentials.');
        });

        it('should support POST method only for login route', async () => {
            // GIVEN: Login endpoint that only supports POST
            const loginCredentials = {
                email: 'eve@customer.com',
                password: 'Password123!'
            };

            // WHEN: GET request is made to login endpoint (wrong method)
            await request(app)
                .get('/api/auth/login')
                .send(loginCredentials)
                .expect(404);

            // THEN: Should not call login controller for wrong HTTP method
            expect(authController.login).not.toHaveBeenCalled();
        });

        it('should pass next function to login controller for error handling', async () => {
            // GIVEN: Login data and mock error in controller
            const loginCredentials = {
                email: 'frank@customer.com',
                password: 'Password456!'
            };

            mockLogin.mockImplementation((req, res, next) => {
                const error = new Error('Authentication service unavailable');
                return next(error);
            });

            // Add error handler
            app.use((err, req, res, next) => {
                res.status(500).json({ error: err.message });
            });

            // WHEN: POST request is made and controller throws error
            await request(app)
                .post('/api/auth/login')
                .send(loginCredentials)
                .expect(500);

            // THEN: Should call login with next function for error handling
            expect(authController.login).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(Object),
                expect.any(Function)
            );
        });
    });

    // ============================================================================
    // Test 3: GET /customer/profile - Protect middleware before getProfile (Happy Path)
    // ============================================================================
    describe('Test 3: GET /customer/profile - Validates Protect Middleware Called Before getProfile', () => {
        it('should call protect middleware before getProfile controller', async () => {
            // GIVEN: Valid JWT token in authorization header
            const token = 'Bearer valid-jwt-token-xyz';

            // WHEN: GET request is made to /api/auth/customer/profile with token
            const response = await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', token)
                .expect(200);

            // THEN: Should call protect middleware before controller
            expect(protect).toHaveBeenCalledTimes(1);
            expect(authController.getProfile).toHaveBeenCalledTimes(1);
            expect(response.body).toEqual({
                status: 'success',
                message: 'Profile retrieved'
            });
        });

        it('should populate req.userId in protect middleware before getProfile', async () => {
            // GIVEN: Valid authentication token
            const token = 'Bearer valid-token-123';

            mockProtect.mockImplementation((req, res, next) => {
                req.userId = 'authenticated-user-id-456';
                req.userRole = 'customer';
                return next();
            });

            mockGetProfile.mockImplementation((req, res) => {
                // Verify req.userId is set by protect middleware
                return res.status(200).json({ 
                    status: 'success', 
                    userId: req.userId,
                    userRole: req.userRole
                });
            });

            // WHEN: GET request is made to profile endpoint
            const response = await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', token)
                .expect(200);

            // THEN: Should have userId populated by protect middleware
            expect(protect).toHaveBeenCalled();
            expect(authController.getProfile).toHaveBeenCalled();
            expect(response.body.userId).toBe('authenticated-user-id-456');
            expect(response.body.userRole).toBe('customer');
        });

        it('should execute middleware chain in correct order for GET profile', async () => {
            // GIVEN: Valid token and middleware execution tracker
            const executionOrder = [];
            const token = 'Bearer test-token';

            mockProtect.mockImplementation((req, res, next) => {
                executionOrder.push('protect');
                req.userId = 'user-123';
                return next();
            });

            mockGetProfile.mockImplementation((req, res) => {
                executionOrder.push('getProfile');
                return res.status(200).json({ status: 'success' });
            });

            // WHEN: GET request is made to profile endpoint
            await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', token)
                .expect(200);

            // THEN: Should execute protect before getProfile
            expect(executionOrder).toEqual(['protect', 'getProfile']);
            expect(protect).toHaveBeenCalled();
            expect(authController.getProfile).toHaveBeenCalled();
        });

        it('should pass authorization header to protect middleware', async () => {
            // GIVEN: Authorization header with Bearer token
            const authHeader = 'Bearer user-specific-token-789';

            // WHEN: GET request is made with authorization header
            await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', authHeader)
                .expect(200);

            // THEN: Should pass request with authorization header to protect
            expect(protect).toHaveBeenCalledWith(
                expect.objectContaining({
                    headers: expect.objectContaining({
                        authorization: authHeader
                    })
                }),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should support GET method only for profile retrieval', async () => {
            // GIVEN: Profile endpoint that supports GET
            const token = 'Bearer valid-token';

            // WHEN: DELETE request is made to GET-only endpoint (wrong method)
            await request(app)
                .delete('/api/auth/customer/profile')
                .set('Authorization', token)
                .expect(404); // Route doesn't support DELETE

            // THEN: Should not call getProfile for DELETE method
            expect(authController.getProfile).not.toHaveBeenCalled();
        });

        it('should handle multiple header fields in profile request', async () => {
            // GIVEN: Request with multiple headers including authorization
            const token = 'Bearer multi-header-token';

            // WHEN: GET request is made with multiple headers
            await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', token)
                .set('Accept', 'application/json')
                .set('User-Agent', 'TestAgent/1.0')
                .expect(200);

            // THEN: Should pass all headers to middleware
            expect(protect).toHaveBeenCalledWith(
                expect.objectContaining({
                    headers: expect.objectContaining({
                        authorization: token,
                        accept: 'application/json'
                    })
                }),
                expect.any(Object),
                expect.any(Function)
            );
        });
    });

    // ============================================================================
    // Test 4: PATCH /customer/profile - Protect middleware before updateProfile (Happy Path)
    // ============================================================================
    describe('Test 4: PATCH /customer/profile - Validates Protect Middleware Called Before updateProfile', () => {
        it('should call protect middleware before updateProfile controller', async () => {
            // GIVEN: Valid JWT token and profile update data
            const token = 'Bearer valid-jwt-token-xyz';
            const updateData = {
                firstName: 'UpdatedFirstName',
                phone: '+9999999999'
            };

            // WHEN: PATCH request is made to /api/auth/customer/profile with token
            const response = await request(app)
                .patch('/api/auth/customer/profile')
                .set('Authorization', token)
                .send(updateData)
                .expect(200);

            // THEN: Should call protect middleware before updateProfile controller
            expect(protect).toHaveBeenCalledTimes(1);
            expect(authController.updateProfile).toHaveBeenCalledTimes(1);
            expect(response.body).toEqual({
                status: 'success',
                message: 'Profile updated'
            });
        });

        it('should populate req.userId in protect middleware before updateProfile', async () => {
            // GIVEN: Valid authentication token and update data
            const token = 'Bearer update-token-456';
            const updateData = {
                lastName: 'NewLastName',
                location: '456 New Address'
            };

            mockProtect.mockImplementation((req, res, next) => {
                req.userId = 'user-to-update-789';
                req.userRole = 'customer';
                return next();
            });

            mockUpdateProfile.mockImplementation((req, res) => {
                return res.status(200).json({ 
                    status: 'success',
                    userId: req.userId,
                    updates: req.body
                });
            });

            // WHEN: PATCH request is made to update profile
            const response = await request(app)
                .patch('/api/auth/customer/profile')
                .set('Authorization', token)
                .send(updateData)
                .expect(200);

            // THEN: Should have userId populated and pass update data
            expect(protect).toHaveBeenCalled();
            expect(authController.updateProfile).toHaveBeenCalled();
            expect(response.body.userId).toBe('user-to-update-789');
            expect(response.body.updates).toEqual(updateData);
        });

        it('should execute middleware chain in correct order for PATCH profile', async () => {
            // GIVEN: Valid token and middleware execution tracker
            const executionOrder = [];
            const token = 'Bearer patch-token';
            const updateData = { phone: '+1234567890' };

            mockProtect.mockImplementation((req, res, next) => {
                executionOrder.push('protect');
                req.userId = 'user-patch-123';
                return next();
            });

            mockUpdateProfile.mockImplementation((req, res) => {
                executionOrder.push('updateProfile');
                return res.status(200).json({ status: 'success' });
            });

            // WHEN: PATCH request is made to profile endpoint
            await request(app)
                .patch('/api/auth/customer/profile')
                .set('Authorization', token)
                .send(updateData)
                .expect(200);

            // THEN: Should execute protect before updateProfile
            expect(executionOrder).toEqual(['protect', 'updateProfile']);
            expect(protect).toHaveBeenCalled();
            expect(authController.updateProfile).toHaveBeenCalled();
        });

        it('should pass update data to updateProfile controller after authentication', async () => {
            // GIVEN: Valid token and comprehensive update data
            const token = 'Bearer auth-token-update';
            const updateData = {
                firstName: 'Alice',
                lastName: 'Updated',
                phone: '+1111111111',
                location: '789 Updated Street'
            };

            // WHEN: PATCH request is made with update data
            await request(app)
                .patch('/api/auth/customer/profile')
                .set('Authorization', token)
                .send(updateData)
                .expect(200);

            // THEN: Should pass all update fields to controller after protect
            expect(protect).toHaveBeenCalled();
            expect(authController.updateProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: updateData
                }),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should support PATCH method for profile update', async () => {
            // GIVEN: Profile update endpoint that supports PATCH
            const token = 'Bearer patch-method-token';
            const updateData = { firstName: 'PatchTest' };

            // WHEN: PATCH request is made
            await request(app)
                .patch('/api/auth/customer/profile')
                .set('Authorization', token)
                .send(updateData)
                .expect(200);

            // THEN: Should call updateProfile for PATCH method
            expect(authController.updateProfile).toHaveBeenCalled();
            expect(authController.getProfile).not.toHaveBeenCalled();
        });

        it('should pass authorization header to protect middleware for PATCH', async () => {
            // GIVEN: Authorization header with Bearer token
            const authHeader = 'Bearer patch-auth-token';
            const updateData = { phone: '+2222222222' };

            // WHEN: PATCH request is made with authorization header
            await request(app)
                .patch('/api/auth/customer/profile')
                .set('Authorization', authHeader)
                .send(updateData)
                .expect(200);

            // THEN: Should pass request with authorization header to protect
            expect(protect).toHaveBeenCalledWith(
                expect.objectContaining({
                    headers: expect.objectContaining({
                        authorization: authHeader
                    })
                }),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should handle empty update data after authentication', async () => {
            // GIVEN: Valid token but empty update data
            const token = 'Bearer empty-update-token';

            mockUpdateProfile.mockImplementation((req, res) => {
                return res.status(200).json({ 
                    status: 'success',
                    message: 'No changes made'
                });
            });

            // WHEN: PATCH request is made with empty body
            await request(app)
                .patch('/api/auth/customer/profile')
                .set('Authorization', token)
                .send({})
                .expect(200);

            // THEN: Should still call protect and updateProfile
            expect(protect).toHaveBeenCalled();
            expect(authController.updateProfile).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 5: GET /customer/profile - Protect middleware rejects unauthorized (Error Path)
    // ============================================================================
    describe('Test 5: GET /customer/profile - Protect Middleware Rejects Unauthorized Request', () => {
        it('should reject request when authorization header is missing', async () => {
            // GIVEN: Protect middleware that rejects missing authorization
            protect.mockImplementation((req, res, next) => {
                return res.status(401).json({ 
                    message: 'You are not logged in. Please log in first.' 
                });
            });

            // WHEN: GET request is made without authorization header
            const response = await request(app)
                .get('/api/auth/customer/profile')
                .expect(401);

            // THEN: Should call protect and stop before getProfile
            expect(protect).toHaveBeenCalled();
            expect(authController.getProfile).not.toHaveBeenCalled();
            expect(response.body.message).toBe('You are not logged in. Please log in first.');
        });

        it('should reject request when token is invalid', async () => {
            // GIVEN: Protect middleware that rejects invalid token
            const invalidToken = 'Bearer invalid-malformed-token';

            protect.mockImplementation((req, res, next) => {
                return res.status(401).json({ 
                    message: 'Token is invalid or expired.' 
                });
            });

            // WHEN: GET request is made with invalid token
            const response = await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', invalidToken)
                .expect(401);

            // THEN: Should reject at protect middleware level
            expect(protect).toHaveBeenCalled();
            expect(authController.getProfile).not.toHaveBeenCalled();
            expect(response.body.message).toBe('Token is invalid or expired.');
        });

        it('should reject request when token is expired', async () => {
            // GIVEN: Protect middleware that detects expired token
            const expiredToken = 'Bearer expired-jwt-token';

            protect.mockImplementation((req, res, next) => {
                return res.status(401).json({ 
                    message: 'Token is invalid or expired.' 
                });
            });

            // WHEN: GET request is made with expired token
            const response = await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', expiredToken)
                .expect(401);

            // THEN: Should reject expired token and prevent controller execution
            expect(protect).toHaveBeenCalled();
            expect(authController.getProfile).not.toHaveBeenCalled();
            expect(response.body.message).toBe('Token is invalid or expired.');
        });

        it('should reject request when authorization header lacks Bearer prefix', async () => {
            // GIVEN: Protect middleware that validates Bearer prefix
            const noBearerToken = 'just-a-token-without-bearer';

            protect.mockImplementation((req, res, next) => {
                if (!req.headers.authorization?.startsWith('Bearer ')) {
                    return res.status(401).json({ 
                        message: 'You are not logged in. Please log in first.' 
                    });
                }
                next();
            });

            // WHEN: GET request is made without Bearer prefix
            const response = await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', noBearerToken)
                .expect(401);

            // THEN: Should reject malformed authorization header
            expect(protect).toHaveBeenCalled();
            expect(authController.getProfile).not.toHaveBeenCalled();
            expect(response.body.message).toBe('You are not logged in. Please log in first.');
        });

        it('should reject request when user no longer exists', async () => {
            // GIVEN: Protect middleware that checks user existence
            const validButDeletedUserToken = 'Bearer valid-token-deleted-user';

            protect.mockImplementation((req, res, next) => {
                // Simulate valid token but user not found in database
                return res.status(401).json({ 
                    message: 'The user belonging to this token no longer exists.' 
                });
            });

            // WHEN: GET request is made with token of deleted user
            const response = await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', validButDeletedUserToken)
                .expect(401);

            // THEN: Should reject when user not found
            expect(protect).toHaveBeenCalled();
            expect(authController.getProfile).not.toHaveBeenCalled();
            expect(response.body.message).toBe('The user belonging to this token no longer exists.');
        });

        it('should not populate req.userId when authentication fails', async () => {
            // GIVEN: Protect middleware that fails authentication
            protect.mockImplementation((req, res, next) => {
                // Do not set req.userId on failure
                return res.status(401).json({ 
                    message: 'Token is invalid or expired.' 
                });
            });

            authController.getProfile = jest.fn((req, res) => {
                // Should never be called, but check if userId would be undefined
                res.status(200).json({ 
                    userId: req.userId 
                });
            });

            // WHEN: GET request is made with invalid token
            const response = await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', 'Bearer bad-token')
                .expect(401);

            // THEN: Should not call getProfile and not populate userId
            expect(protect).toHaveBeenCalled();
            expect(authController.getProfile).not.toHaveBeenCalled();
            expect(response.body).not.toHaveProperty('userId');
        });

        it('should handle null authorization header gracefully', async () => {
            // GIVEN: Protect middleware that handles null authorization
            protect.mockImplementation((req, res, next) => {
                if (!req.headers.authorization) {
                    return res.status(401).json({ 
                        message: 'You are not logged in. Please log in first.' 
                    });
                }
                next();
            });

            // WHEN: GET request is made without any authorization header
            const response = await request(app)
                .get('/api/auth/customer/profile')
                .expect(401);

            // THEN: Should handle null pointer risk safely
            expect(protect).toHaveBeenCalled();
            expect(authController.getProfile).not.toHaveBeenCalled();
            expect(response.body.message).toBe('You are not logged in. Please log in first.');
        });

        it('should reject PATCH request with invalid authorization', async () => {
            // GIVEN: Protect middleware that rejects unauthorized PATCH
            const invalidToken = 'Bearer invalid-token-for-patch';
            const updateData = { firstName: 'ShouldNotUpdate' };

            protect.mockImplementation((req, res, next) => {
                return res.status(401).json({ 
                    message: 'Token is invalid or expired.' 
                });
            });

            // WHEN: PATCH request is made with invalid token
            const response = await request(app)
                .patch('/api/auth/customer/profile')
                .set('Authorization', invalidToken)
                .send(updateData)
                .expect(401);

            // THEN: Should reject at middleware and not update profile
            expect(protect).toHaveBeenCalled();
            expect(authController.updateProfile).not.toHaveBeenCalled();
            expect(response.body.message).toBe('Token is invalid or expired.');
        });

        it('should prevent controller execution when middleware returns early', async () => {
            // GIVEN: Protect middleware that returns error response
            protect.mockImplementation((req, res, next) => {
                // Return early without calling next()
                return res.status(401).json({ 
                    message: 'Authentication failed.' 
                });
            });

            // WHEN: GET request is made to protected route
            await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', 'Bearer test-token')
                .expect(401);

            // THEN: Should not proceed to controller when middleware returns early
            expect(protect).toHaveBeenCalled();
            expect(authController.getProfile).not.toHaveBeenCalled();
        });

        it('should maintain security by not exposing internal errors', async () => {
            // GIVEN: Protect middleware that handles internal errors securely
            protect.mockImplementation((req, res, next) => {
                // Simulate internal error but return generic message
                return res.status(401).json({ 
                    message: 'Token is invalid or expired.' 
                });
            });

            // WHEN: GET request is made with problematic token
            const response = await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', 'Bearer problematic-token')
                .expect(401);

            // THEN: Should return generic error without exposing details
            expect(response.body.message).toBe('Token is invalid or expired.');
            expect(response.body).not.toHaveProperty('stack');
            expect(response.body).not.toHaveProperty('error');
        });
    });

    // ============================================================================
    // Additional Edge Cases and Route Configuration Tests
    // ============================================================================
    describe('Additional Edge Cases - Route Configuration and Error Handling', () => {
        it('should handle 404 for non-existent routes', async () => {
            // GIVEN: Request to non-existent route
            // WHEN: GET request is made to invalid endpoint
            await request(app)
                .get('/api/auth/nonexistent')
                .expect(404);

            // THEN: Should return 404 and not call any controller
            expect(authController.register).not.toHaveBeenCalled();
            expect(authController.login).not.toHaveBeenCalled();
            expect(authController.getProfile).not.toHaveBeenCalled();
            expect(authController.updateProfile).not.toHaveBeenCalled();
        });

        it('should handle malformed JSON in request body', async () => {
            // GIVEN: Request with malformed JSON
            // WHEN: POST request is made with invalid JSON
            await request(app)
                .post('/api/auth/register/customer')
                .set('Content-Type', 'application/json')
                .send('{ invalid json }')
                .expect(400);

            // THEN: Should return 400 for malformed JSON
            expect(authController.register).not.toHaveBeenCalled();
        });

        it('should verify router is properly exported as Express router', async () => {
            // GIVEN: authRoutes module
            // WHEN: Module is imported
            const Router = require('express').Router;
            
            // THEN: Should be an instance of Express Router
            expect(authRoutes).toBeDefined();
            expect(typeof authRoutes).toBe('function');
            expect(authRoutes.name).toBe('router');
        });

        it('should handle concurrent requests to different routes', async () => {
            // GIVEN: Multiple simultaneous requests
            const registerData = {
                firstName: 'Concurrent',
                lastName: 'User1',
                email: 'user1@test.com',
                phone: '+1111111111',
                password: 'Pass123!'
            };

            const loginData = {
                email: 'user2@test.com',
                password: 'Pass456!'
            };

            // WHEN: Multiple requests are made concurrently
            const [registerResponse, loginResponse] = await Promise.all([
                request(app).post('/api/auth/register/customer').send(registerData),
                request(app).post('/api/auth/login').send(loginData)
            ]);

            // THEN: Should handle all requests correctly
            expect(registerResponse.status).toBe(201);
            expect(loginResponse.status).toBe(200);
            expect(authController.register).toHaveBeenCalled();
            expect(authController.login).toHaveBeenCalled();
        });

        it('should preserve request context through middleware chain', async () => {
            // GIVEN: Request with custom headers and auth token
            const token = 'Bearer context-test-token';
            const customHeader = 'CustomValue';

            mockProtect.mockImplementation((req, res, next) => {
                req.userId = 'context-user-id';
                req.customData = req.headers['x-custom-header'];
                return next();
            });

            mockGetProfile.mockImplementation((req, res) => {
                return res.status(200).json({ 
                    userId: req.userId,
                    customData: req.customData
                });
            });

            // WHEN: GET request is made with custom headers
            const response = await request(app)
                .get('/api/auth/customer/profile')
                .set('Authorization', token)
                .set('X-Custom-Header', customHeader)
                .expect(200);

            // THEN: Should preserve request context through chain
            expect(response.body.userId).toBe('context-user-id');
            expect(response.body.customData).toBe(customHeader);
        });
    });
});
