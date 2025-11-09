// backend/auth-service/test/unit/restaurantAdminController.test.js
const jwt = require('jsonwebtoken');
const RestaurantAdmin = require('../../models/RestaurantAdmin');
const restaurantAdminController = require('../../controllers/restaurantAdminController');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../models/RestaurantAdmin');

describe('RestaurantAdminController Unit Tests - Shopee QA Standards', () => {
    let req, res, next;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Setup mock request object
        req = {
            body: {},
            params: {},
            user: {}
        };

        // Setup mock response object
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        // Setup mock next function
        next = jest.fn();

        // Setup default environment variables
        process.env.JWT_SECRET = 'test-secret-key';
        process.env.JWT_EXPIRES_IN = '7d';
    });

    // ============================================================================
    // Test 1: register - Successful registration with JWT token (Happy Path)
    // ============================================================================
    describe('Test 1: register - Successful Registration with JWT Token (Happy Path)', () => {
        it('should create new restaurant admin and return JWT token', async () => {
            // GIVEN: Valid registration data
            req.body = {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@restaurant.com',
                phone: '+1234567890',
                password: 'SecurePass123!',
                businessLicense: 'BL-2024-001'
            };

            const mockRestaurantAdmin = {
                _id: 'mock-restaurant-admin-id-123',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@restaurant.com',
                phone: '+1234567890',
                businessLicense: 'BL-2024-001',
                isApproved: false
            };

            RestaurantAdmin.findOne.mockResolvedValue(null); // No existing email
            RestaurantAdmin.create.mockResolvedValue(mockRestaurantAdmin);
            jwt.sign.mockReturnValue('mock-jwt-token-xyz');

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should create restaurant admin and return success response with JWT
            expect(RestaurantAdmin.findOne).toHaveBeenCalledTimes(2);
            expect(RestaurantAdmin.findOne).toHaveBeenNthCalledWith(1, { email: req.body.email });
            expect(RestaurantAdmin.findOne).toHaveBeenNthCalledWith(2, { businessLicense: req.body.businessLicense });
            expect(RestaurantAdmin.create).toHaveBeenCalledWith({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@restaurant.com',
                phone: '+1234567890',
                password: 'SecurePass123!',
                businessLicense: 'BL-2024-001'
            });
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: mockRestaurantAdmin._id, role: 'restaurant-admin' },
                'test-secret-key',
                { expiresIn: '7d' }
            );
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'mock-jwt-token-xyz',
                data: {
                    restaurantAdmin: {
                        id: mockRestaurantAdmin._id,
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john.doe@restaurant.com',
                        phone: '+1234567890',
                        businessLicense: 'BL-2024-001',
                        isApproved: false
                    }
                }
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should sign JWT with correct role and expiration', async () => {
            // GIVEN: Valid registration data
            req.body = {
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@restaurant.com',
                phone: '+9876543210',
                password: 'Password123!',
                businessLicense: 'BL-2024-002'
            };

            const mockRestaurantAdmin = {
                _id: 'admin-id-456',
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@restaurant.com',
                phone: '+9876543210',
                businessLicense: 'BL-2024-002',
                isApproved: false
            };

            RestaurantAdmin.findOne.mockResolvedValue(null);
            RestaurantAdmin.create.mockResolvedValue(mockRestaurantAdmin);
            jwt.sign.mockReturnValue('jwt-token-abc');

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should sign JWT with restaurant-admin role
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 'admin-id-456', role: 'restaurant-admin' },
                'test-secret-key',
                { expiresIn: '7d' }
            );
        });

        it('should set isApproved to false by default for new registration', async () => {
            // GIVEN: Valid registration data
            req.body = {
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob@restaurant.com',
                phone: '+1111111111',
                password: 'MyPass456!',
                businessLicense: 'BL-2024-003'
            };

            const mockRestaurantAdmin = {
                _id: 'admin-id-789',
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob@restaurant.com',
                phone: '+1111111111',
                businessLicense: 'BL-2024-003',
                isApproved: false
            };

            RestaurantAdmin.findOne.mockResolvedValue(null);
            RestaurantAdmin.create.mockResolvedValue(mockRestaurantAdmin);
            jwt.sign.mockReturnValue('jwt-token-def');

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Response should include isApproved: false
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: {
                        restaurantAdmin: expect.objectContaining({
                            isApproved: false
                        })
                    }
                })
            );
        });
    });

    // ============================================================================
    // Test 2: register - Duplicate email returns 409 (Error Path)
    // ============================================================================
    describe('Test 2: register - Duplicate Email Returns 409 (Error Path)', () => {
        it('should return 409 when email already exists', async () => {
            // GIVEN: Registration data with existing email
            req.body = {
                firstName: 'Charlie',
                lastName: 'Brown',
                email: 'existing@restaurant.com',
                phone: '+2222222222',
                password: 'Password789!',
                businessLicense: 'BL-2024-004'
            };

            const existingAdmin = {
                _id: 'existing-admin-id',
                email: 'existing@restaurant.com'
            };

            RestaurantAdmin.findOne.mockResolvedValueOnce(existingAdmin); // Email exists

            // WHEN: register is called with duplicate email
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 409 conflict error
            expect(RestaurantAdmin.findOne).toHaveBeenCalledWith({ email: 'existing@restaurant.com' });
            expect(RestaurantAdmin.create).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Email already registered.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should prevent registration when email is taken', async () => {
            // GIVEN: Duplicate email scenario
            req.body = {
                firstName: 'David',
                lastName: 'Wilson',
                email: 'duplicate@restaurant.com',
                phone: '+3333333333',
                password: 'SecurePass!',
                businessLicense: 'BL-2024-005'
            };

            RestaurantAdmin.findOne.mockResolvedValueOnce({ _id: 'other-admin-id' });

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should not create new admin
            expect(RestaurantAdmin.create).not.toHaveBeenCalled();
            expect(jwt.sign).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(409);
        });

        it('should handle null pointer risk when checking existing email', async () => {
            // GIVEN: Valid data but email check returns null
            req.body = {
                firstName: 'Eve',
                lastName: 'Martinez',
                email: 'eve@restaurant.com',
                phone: '+4444444444',
                password: 'Password123!',
                businessLicense: 'BL-2024-006'
            };

            RestaurantAdmin.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
            RestaurantAdmin.create.mockResolvedValue({
                _id: 'new-admin-id',
                firstName: 'Eve',
                lastName: 'Martinez',
                email: 'eve@restaurant.com',
                phone: '+4444444444',
                businessLicense: 'BL-2024-006',
                isApproved: false
            });
            jwt.sign.mockReturnValue('token-eve');

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should proceed with registration when no existing email
            expect(RestaurantAdmin.create).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    // ============================================================================
    // Test 3: register - Missing required fields returns 400 (Error Path)
    // ============================================================================
    describe('Test 3: register - Missing Required Fields Returns 400 (Error Path)', () => {
        it('should return 400 when firstName is missing', async () => {
            // GIVEN: Registration data without firstName
            req.body = {
                lastName: 'Garcia',
                email: 'garcia@restaurant.com',
                phone: '+5555555555',
                password: 'Password123!',
                businessLicense: 'BL-2024-007'
            };

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(RestaurantAdmin.findOne).not.toHaveBeenCalled();
            expect(RestaurantAdmin.create).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when lastName is missing', async () => {
            // GIVEN: Registration data without lastName
            req.body = {
                firstName: 'Frank',
                email: 'frank@restaurant.com',
                phone: '+6666666666',
                password: 'Password123!',
                businessLicense: 'BL-2024-008'
            };

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when email is missing', async () => {
            // GIVEN: Registration data without email
            req.body = {
                firstName: 'Grace',
                lastName: 'Lee',
                phone: '+7777777777',
                password: 'Password123!',
                businessLicense: 'BL-2024-009'
            };

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when phone is missing', async () => {
            // GIVEN: Registration data without phone
            req.body = {
                firstName: 'Henry',
                lastName: 'Taylor',
                email: 'henry@restaurant.com',
                password: 'Password123!',
                businessLicense: 'BL-2024-010'
            };

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when password is missing', async () => {
            // GIVEN: Registration data without password
            req.body = {
                firstName: 'Isabel',
                lastName: 'Anderson',
                email: 'isabel@restaurant.com',
                phone: '+8888888888',
                businessLicense: 'BL-2024-011'
            };

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when businessLicense is missing', async () => {
            // GIVEN: Registration data without businessLicense
            req.body = {
                firstName: 'Jack',
                lastName: 'White',
                email: 'jack@restaurant.com',
                phone: '+9999999999',
                password: 'Password123!'
            };

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when multiple fields are missing', async () => {
            // GIVEN: Registration data with only firstName and email
            req.body = {
                firstName: 'Karen',
                email: 'karen@restaurant.com'
            };

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should handle null values for required fields', async () => {
            // GIVEN: Registration data with null values
            req.body = {
                firstName: null,
                lastName: null,
                email: null,
                phone: null,
                password: null,
                businessLicense: null
            };

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 400 validation error for null pointer risk
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should handle undefined values for required fields', async () => {
            // GIVEN: Registration data with undefined values
            req.body = {
                firstName: undefined,
                lastName: undefined,
                email: undefined,
                phone: undefined,
                password: undefined,
                businessLicense: undefined
            };

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle empty strings for required fields', async () => {
            // GIVEN: Registration data with empty strings
            req.body = {
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                password: '',
                businessLicense: ''
            };

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });
    });

    // ============================================================================
    // Test 4: login - Successful login with valid credentials (Happy Path)
    // ============================================================================
    describe('Test 4: login - Successful Login with Valid Credentials (Happy Path)', () => {
        it('should authenticate approved restaurant admin and return JWT token', async () => {
            // GIVEN: Valid login credentials for approved admin
            req.body = {
                email: 'approved@restaurant.com',
                password: 'CorrectPassword123!'
            };

            const mockRestaurantAdmin = {
                _id: 'admin-approved-id',
                firstName: 'Larry',
                lastName: 'Green',
                email: 'approved@restaurant.com',
                phone: '+1010101010',
                businessLicense: 'BL-2024-012',
                restaurantId: 'restaurant-id-001',
                isApproved: true,
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            RestaurantAdmin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockRestaurantAdmin)
            });
            jwt.sign.mockReturnValue('login-jwt-token');

            // WHEN: login is called
            await restaurantAdminController.login(req, res, next);

            // THEN: Should authenticate and return success with JWT
            expect(RestaurantAdmin.findOne).toHaveBeenCalledWith({ email: 'approved@restaurant.com' });
            expect(mockRestaurantAdmin.comparePassword).toHaveBeenCalledWith('CorrectPassword123!');
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 'admin-approved-id', role: 'restaurant-admin' },
                'test-secret-key',
                { expiresIn: '7d' }
            );
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'login-jwt-token',
                data: {
                    restaurantAdmin: {
                        id: 'admin-approved-id',
                        firstName: 'Larry',
                        lastName: 'Green',
                        email: 'approved@restaurant.com',
                        phone: '+1010101010',
                        businessLicense: 'BL-2024-012',
                        restaurantId: 'restaurant-id-001',
                        isApproved: true
                    }
                }
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should select password field explicitly when querying', async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: 'monica@restaurant.com',
                password: 'Password456!'
            };

            const mockRestaurantAdmin = {
                _id: 'admin-monica-id',
                firstName: 'Monica',
                lastName: 'Blue',
                email: 'monica@restaurant.com',
                phone: '+1212121212',
                businessLicense: 'BL-2024-013',
                restaurantId: null,
                isApproved: true,
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            const mockSelect = jest.fn().mockResolvedValue(mockRestaurantAdmin);
            RestaurantAdmin.findOne.mockReturnValue({
                select: mockSelect
            });
            jwt.sign.mockReturnValue('token-monica');

            // WHEN: login is called
            await restaurantAdminController.login(req, res, next);

            // THEN: Should call select with '+password' to explicitly include password field
            expect(mockSelect).toHaveBeenCalledWith('+password');
        });

        it('should return complete restaurant admin data on successful login', async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: 'nancy@restaurant.com',
                password: 'SecurePass789!'
            };

            const mockRestaurantAdmin = {
                _id: 'admin-nancy-id',
                firstName: 'Nancy',
                lastName: 'Yellow',
                email: 'nancy@restaurant.com',
                phone: '+1313131313',
                businessLicense: 'BL-2024-014',
                restaurantId: 'restaurant-id-002',
                isApproved: true,
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            RestaurantAdmin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockRestaurantAdmin)
            });
            jwt.sign.mockReturnValue('token-nancy');

            // WHEN: login is called
            await restaurantAdminController.login(req, res, next);

            // THEN: Should return all restaurant admin fields
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'token-nancy',
                data: {
                    restaurantAdmin: expect.objectContaining({
                        id: 'admin-nancy-id',
                        firstName: 'Nancy',
                        lastName: 'Yellow',
                        email: 'nancy@restaurant.com',
                        phone: '+1313131313',
                        businessLicense: 'BL-2024-014',
                        restaurantId: 'restaurant-id-002',
                        isApproved: true
                    })
                }
            });
        });
    });

    // ============================================================================
    // Test 5: login - Unapproved account returns 403 (Error Path)
    // ============================================================================
    describe('Test 5: login - Unapproved Account Returns 403 (Error Path)', () => {
        it('should return 403 when account is not approved', async () => {
            // GIVEN: Valid credentials but unapproved account
            req.body = {
                email: 'pending@restaurant.com',
                password: 'Password123!'
            };

            const mockUnapprovedAdmin = {
                _id: 'admin-pending-id',
                firstName: 'Oscar',
                lastName: 'Red',
                email: 'pending@restaurant.com',
                phone: '+1414141414',
                businessLicense: 'BL-2024-015',
                isApproved: false,
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            RestaurantAdmin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUnapprovedAdmin)
            });

            // WHEN: login is called for unapproved account
            await restaurantAdminController.login(req, res, next);

            // THEN: Should return 403 forbidden error
            expect(RestaurantAdmin.findOne).toHaveBeenCalledWith({ email: 'pending@restaurant.com' });
            expect(mockUnapprovedAdmin.comparePassword).not.toHaveBeenCalled();
            expect(jwt.sign).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Account is pending approval by an administrator.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should prevent login before admin approval', async () => {
            // GIVEN: Unapproved restaurant admin attempts login
            req.body = {
                email: 'waiting@restaurant.com',
                password: 'ValidPassword456!'
            };

            const mockUnapprovedAdmin = {
                _id: 'admin-waiting-id',
                email: 'waiting@restaurant.com',
                isApproved: false,
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            RestaurantAdmin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUnapprovedAdmin)
            });

            // WHEN: login is called
            await restaurantAdminController.login(req, res, next);

            // THEN: Should block access and not generate token
            expect(jwt.sign).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should enforce business rule that only approved admins can login', async () => {
            // GIVEN: Newly registered admin not yet approved
            req.body = {
                email: 'newadmin@restaurant.com',
                password: 'NewPass789!'
            };

            const mockNewAdmin = {
                _id: 'admin-new-id',
                firstName: 'Peter',
                lastName: 'Purple',
                email: 'newadmin@restaurant.com',
                phone: '+1515151515',
                businessLicense: 'BL-2024-016',
                isApproved: false,
                comparePassword: jest.fn()
            };

            RestaurantAdmin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockNewAdmin)
            });

            // WHEN: login is called
            await restaurantAdminController.login(req, res, next);

            // THEN: Should enforce approval requirement
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Account is pending approval by an administrator.'
            });
            // Password should not even be checked for unapproved accounts
            expect(mockNewAdmin.comparePassword).not.toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 6: login - Invalid credentials returns 401 (Error Path)
    // ============================================================================
    describe('Test 6: login - Invalid Credentials Returns 401 (Error Path)', () => {
        it('should return 401 when email does not exist', async () => {
            // GIVEN: Non-existent email
            req.body = {
                email: 'nonexistent@restaurant.com',
                password: 'AnyPassword123!'
            };

            RestaurantAdmin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(null)
            });

            // WHEN: login is called with non-existent email
            await restaurantAdminController.login(req, res, next);

            // THEN: Should return 401 unauthorized error
            expect(RestaurantAdmin.findOne).toHaveBeenCalledWith({ email: 'nonexistent@restaurant.com' });
            expect(jwt.sign).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Invalid credentials.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when password is incorrect', async () => {
            // GIVEN: Valid email but wrong password
            req.body = {
                email: 'quinn@restaurant.com',
                password: 'WrongPassword123!'
            };

            const mockRestaurantAdmin = {
                _id: 'admin-quinn-id',
                email: 'quinn@restaurant.com',
                isApproved: true,
                comparePassword: jest.fn().mockResolvedValue(false)
            };

            RestaurantAdmin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockRestaurantAdmin)
            });

            // WHEN: login is called with wrong password
            await restaurantAdminController.login(req, res, next);

            // THEN: Should return 401 unauthorized error
            expect(mockRestaurantAdmin.comparePassword).toHaveBeenCalledWith('WrongPassword123!');
            expect(jwt.sign).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Invalid credentials.'
            });
        });

        it('should return 400 when email is missing', async () => {
            // GIVEN: Login request without email
            req.body = {
                password: 'Password123!'
            };

            // WHEN: login is called
            await restaurantAdminController.login(req, res, next);

            // THEN: Should return 400 bad request
            expect(RestaurantAdmin.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Email and password are required.'
            });
        });

        it('should return 400 when password is missing', async () => {
            // GIVEN: Login request without password
            req.body = {
                email: 'rachel@restaurant.com'
            };

            // WHEN: login is called
            await restaurantAdminController.login(req, res, next);

            // THEN: Should return 400 bad request
            expect(RestaurantAdmin.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Email and password are required.'
            });
        });

        it('should return 400 when both email and password are missing', async () => {
            // GIVEN: Empty login request
            req.body = {};

            // WHEN: login is called
            await restaurantAdminController.login(req, res, next);

            // THEN: Should return 400 bad request
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Email and password are required.'
            });
        });

        it('should handle null email', async () => {
            // GIVEN: Login with null email
            req.body = {
                email: null,
                password: 'Password123!'
            };

            // WHEN: login is called
            await restaurantAdminController.login(req, res, next);

            // THEN: Should return 400 for null pointer risk
            expect(RestaurantAdmin.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle null password', async () => {
            // GIVEN: Login with null password
            req.body = {
                email: 'samuel@restaurant.com',
                password: null
            };

            // WHEN: login is called
            await restaurantAdminController.login(req, res, next);

            // THEN: Should return 400 for null pointer risk
            expect(RestaurantAdmin.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should prevent brute force by not revealing if email exists', async () => {
            // GIVEN: Two scenarios - non-existent email and wrong password
            req.body = {
                email: 'test@restaurant.com',
                password: 'TestPassword!'
            };

            RestaurantAdmin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(null)
            });

            // WHEN: login is called with non-existent email
            await restaurantAdminController.login(req, res, next);

            // THEN: Should return same error message as wrong password
            expect(res.json).toHaveBeenCalledWith({
                message: 'Invalid credentials.'
            });

            // Reset mocks
            jest.clearAllMocks();

            // GIVEN: Valid email but wrong password
            const mockAdmin = {
                _id: 'admin-id',
                email: 'test@restaurant.com',
                isApproved: true,
                comparePassword: jest.fn().mockResolvedValue(false)
            };

            RestaurantAdmin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockAdmin)
            });

            // WHEN: login is called with wrong password
            await restaurantAdminController.login(req, res, next);

            // THEN: Should return same error message
            expect(res.json).toHaveBeenCalledWith({
                message: 'Invalid credentials.'
            });
        });
    });

    // ============================================================================
    // Test 7: register - Duplicate business license returns 409 (Error Path)
    // ============================================================================
    describe('Test 7: register - Duplicate Business License Returns 409 (Error Path)', () => {
        it('should return 409 when business license already exists', async () => {
            // GIVEN: Registration with existing business license
            req.body = {
                firstName: 'Tom',
                lastName: 'Silver',
                email: 'tom@restaurant.com',
                phone: '+1616161616',
                password: 'Password123!',
                businessLicense: 'BL-EXISTING-001'
            };

            const existingLicense = {
                _id: 'other-admin-id',
                businessLicense: 'BL-EXISTING-001'
            };

            RestaurantAdmin.findOne
                .mockResolvedValueOnce(null) // Email doesn't exist
                .mockResolvedValueOnce(existingLicense); // Business license exists

            // WHEN: register is called with duplicate business license
            await restaurantAdminController.register(req, res, next);

            // THEN: Should return 409 conflict error
            expect(RestaurantAdmin.findOne).toHaveBeenCalledTimes(2);
            expect(RestaurantAdmin.findOne).toHaveBeenNthCalledWith(1, { email: 'tom@restaurant.com' });
            expect(RestaurantAdmin.findOne).toHaveBeenNthCalledWith(2, { businessLicense: 'BL-EXISTING-001' });
            expect(RestaurantAdmin.create).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Business license already registered.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should prevent multiple registrations with same business license', async () => {
            // GIVEN: Duplicate business license scenario
            req.body = {
                firstName: 'Uma',
                lastName: 'Gold',
                email: 'uma@restaurant.com',
                phone: '+1717171717',
                password: 'SecurePass!',
                businessLicense: 'BL-DUPLICATE-002'
            };

            RestaurantAdmin.findOne
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ _id: 'existing-id' });

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should not create new admin
            expect(RestaurantAdmin.create).not.toHaveBeenCalled();
            expect(jwt.sign).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(409);
        });

        it('should enforce unique business license constraint', async () => {
            // GIVEN: Valid email but duplicate business license
            req.body = {
                firstName: 'Victor',
                lastName: 'Bronze',
                email: 'victor.new@restaurant.com',
                phone: '+1818181818',
                password: 'Password456!',
                businessLicense: 'BL-TAKEN-003'
            };

            RestaurantAdmin.findOne
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({
                    _id: 'another-admin',
                    businessLicense: 'BL-TAKEN-003'
                });

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should enforce uniqueness business rule
            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Business license already registered.'
            });
        });

        it('should check business license after email validation passes', async () => {
            // GIVEN: Unique email but duplicate business license
            req.body = {
                firstName: 'Wendy',
                lastName: 'Copper',
                email: 'wendy.unique@restaurant.com',
                phone: '+1919191919',
                password: 'UniquePass!',
                businessLicense: 'BL-CONFLICT-004'
            };

            RestaurantAdmin.findOne
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ _id: 'conflict-admin' });

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should check email first, then business license
            expect(RestaurantAdmin.findOne).toHaveBeenCalledTimes(2);
            const firstCall = RestaurantAdmin.findOne.mock.calls[0][0];
            const secondCall = RestaurantAdmin.findOne.mock.calls[1][0];
            expect(firstCall).toEqual({ email: 'wendy.unique@restaurant.com' });
            expect(secondCall).toEqual({ businessLicense: 'BL-CONFLICT-004' });
            expect(res.status).toHaveBeenCalledWith(409);
        });

        it('should handle null pointer risk when checking business license', async () => {
            // GIVEN: Valid data with no existing business license
            req.body = {
                firstName: 'Xavier',
                lastName: 'Diamond',
                email: 'xavier@restaurant.com',
                phone: '+2020202020',
                password: 'Password789!',
                businessLicense: 'BL-NEW-005'
            };

            RestaurantAdmin.findOne
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);
            RestaurantAdmin.create.mockResolvedValue({
                _id: 'xavier-admin-id',
                firstName: 'Xavier',
                lastName: 'Diamond',
                email: 'xavier@restaurant.com',
                phone: '+2020202020',
                businessLicense: 'BL-NEW-005',
                isApproved: false
            });
            jwt.sign.mockReturnValue('token-xavier');

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should proceed when business license is available
            expect(RestaurantAdmin.create).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    // ============================================================================
    // Exception Handling Tests
    // ============================================================================
    describe('Exception Handling Tests', () => {
        it('should call next with error when register throws exception', async () => {
            // GIVEN: Valid registration data but database throws error
            req.body = {
                firstName: 'Yvonne',
                lastName: 'Pearl',
                email: 'yvonne@restaurant.com',
                phone: '+2121212121',
                password: 'Password123!',
                businessLicense: 'BL-2024-017'
            };

            const dbError = new Error('Database connection failed');
            RestaurantAdmin.findOne.mockRejectedValue(dbError);

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should pass error to next middleware
            expect(next).toHaveBeenCalledWith(dbError);
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should call next with error when login throws exception', async () => {
            // GIVEN: Valid login data but database throws error
            req.body = {
                email: 'error@restaurant.com',
                password: 'Password123!'
            };

            const dbError = new Error('Database query failed');
            RestaurantAdmin.findOne.mockReturnValue({
                select: jest.fn().mockRejectedValue(dbError)
            });

            // WHEN: login is called
            await restaurantAdminController.login(req, res, next);

            // THEN: Should pass error to next middleware
            expect(next).toHaveBeenCalledWith(dbError);
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should handle JWT signing errors in register', async () => {
            // GIVEN: Valid registration but JWT signing fails
            req.body = {
                firstName: 'Zoe',
                lastName: 'Pink',
                email: 'zoe@restaurant.com',
                phone: '+2222222222',
                password: 'Password123!',
                businessLicense: 'BL-2024-018'
            };

            RestaurantAdmin.findOne.mockResolvedValue(null);
            RestaurantAdmin.create.mockResolvedValue({
                _id: 'zoe-admin-id',
                firstName: 'Zoe',
                lastName: 'Pink',
                email: 'zoe@restaurant.com',
                phone: '+2222222222',
                businessLicense: 'BL-2024-018',
                isApproved: false
            });

            const jwtError = new Error('JWT secret not configured');
            jwt.sign.mockImplementation(() => {
                throw jwtError;
            });

            // WHEN: register is called
            await restaurantAdminController.register(req, res, next);

            // THEN: Should pass error to next middleware
            expect(next).toHaveBeenCalledWith(jwtError);
        });
    });
});
