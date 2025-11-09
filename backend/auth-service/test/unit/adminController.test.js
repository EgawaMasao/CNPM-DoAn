// backend/auth-service/test/unit/adminController.test.js
const jwt = require('jsonwebtoken');
const Admin = require('../../models/Admin');
const adminController = require('../../controllers/adminController');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../models/Admin');

describe('AdminController Unit Tests - Shopee QA Standards', () => {
    let req, res, next;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Setup mock request object
        req = {
            body: {},
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
        it('should create new admin with default permissions and return JWT token', async () => {
            // GIVEN: Valid registration data without role and permissions
            req.body = {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@admin.com',
                phone: '+1234567890',
                password: 'SecurePass123!'
            };

            const mockAdmin = {
                _id: 'mock-admin-id-123',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@admin.com',
                phone: '+1234567890',
                role: 'admin',
                permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
            };

            Admin.findOne.mockResolvedValue(null); // No existing email
            Admin.create.mockResolvedValue(mockAdmin);
            jwt.sign.mockReturnValue('mock-jwt-token-xyz');

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should create admin with default role and permissions
            expect(Admin.findOne).toHaveBeenCalledWith({ email: req.body.email });
            expect(Admin.create).toHaveBeenCalledWith({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@admin.com',
                phone: '+1234567890',
                password: 'SecurePass123!',
                role: 'admin',
                permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
            });
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: mockAdmin._id, role: 'admin' },
                'test-secret-key',
                { expiresIn: '7d' }
            );
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'mock-jwt-token-xyz',
                data: {
                    admin: {
                        id: mockAdmin._id,
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john.doe@admin.com',
                        phone: '+1234567890',
                        role: 'admin',
                        permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
                    }
                }
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should allow custom role when provided', async () => {
            // GIVEN: Valid registration data with custom role
            req.body = {
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@admin.com',
                phone: '+9876543210',
                password: 'Password123!',
                role: 'super-admin'
            };

            const mockAdmin = {
                _id: 'admin-id-456',
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@admin.com',
                phone: '+9876543210',
                role: 'super-admin',
                permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
            };

            Admin.findOne.mockResolvedValue(null);
            Admin.create.mockResolvedValue(mockAdmin);
            jwt.sign.mockReturnValue('jwt-token-abc');

            // WHEN: register is called with custom role
            await adminController.register(req, res, next);

            // THEN: Should create admin with provided role
            expect(Admin.create).toHaveBeenCalledWith({
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@admin.com',
                phone: '+9876543210',
                password: 'Password123!',
                role: 'super-admin',
                permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
            });
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: {
                        admin: expect.objectContaining({
                            role: 'super-admin'
                        })
                    }
                })
            );
        });

        it('should allow custom permissions when provided', async () => {
            // GIVEN: Valid registration data with custom permissions
            req.body = {
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob@admin.com',
                phone: '+1111111111',
                password: 'MyPass456!',
                permissions: ['manage-users', 'view-reports']
            };

            const mockAdmin = {
                _id: 'admin-id-789',
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob@admin.com',
                phone: '+1111111111',
                role: 'admin',
                permissions: ['manage-users', 'view-reports']
            };

            Admin.findOne.mockResolvedValue(null);
            Admin.create.mockResolvedValue(mockAdmin);
            jwt.sign.mockReturnValue('jwt-token-def');

            // WHEN: register is called with custom permissions
            await adminController.register(req, res, next);

            // THEN: Should create admin with provided permissions
            expect(Admin.create).toHaveBeenCalledWith({
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob@admin.com',
                phone: '+1111111111',
                password: 'MyPass456!',
                role: 'admin',
                permissions: ['manage-users', 'view-reports']
            });
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: {
                        admin: expect.objectContaining({
                            permissions: ['manage-users', 'view-reports']
                        })
                    }
                })
            );
        });

        it('should sign JWT with admin role', async () => {
            // GIVEN: Valid registration data
            req.body = {
                firstName: 'Charlie',
                lastName: 'Brown',
                email: 'charlie@admin.com',
                phone: '+2222222222',
                password: 'Password789!'
            };

            const mockAdmin = {
                _id: 'admin-charlie-id',
                firstName: 'Charlie',
                lastName: 'Brown',
                email: 'charlie@admin.com',
                phone: '+2222222222',
                role: 'admin',
                permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
            };

            Admin.findOne.mockResolvedValue(null);
            Admin.create.mockResolvedValue(mockAdmin);
            jwt.sign.mockReturnValue('jwt-token-ghi');

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should sign JWT with admin role
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 'admin-charlie-id', role: 'admin' },
                'test-secret-key',
                { expiresIn: '7d' }
            );
        });

        it('should return all admin fields in response', async () => {
            // GIVEN: Valid registration data
            req.body = {
                firstName: 'David',
                lastName: 'Wilson',
                email: 'david@admin.com',
                phone: '+3333333333',
                password: 'SecurePass!'
            };

            const mockAdmin = {
                _id: 'admin-david-id',
                firstName: 'David',
                lastName: 'Wilson',
                email: 'david@admin.com',
                phone: '+3333333333',
                role: 'admin',
                permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
            };

            Admin.findOne.mockResolvedValue(null);
            Admin.create.mockResolvedValue(mockAdmin);
            jwt.sign.mockReturnValue('token-david');

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should return complete admin data
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'token-david',
                data: {
                    admin: {
                        id: 'admin-david-id',
                        firstName: 'David',
                        lastName: 'Wilson',
                        email: 'david@admin.com',
                        phone: '+3333333333',
                        role: 'admin',
                        permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
                    }
                }
            });
        });
    });

    // ============================================================================
    // Test 2: register - Duplicate email returns 409 (Error Path)
    // ============================================================================
    describe('Test 2: register - Duplicate Email Returns 409 (Error Path)', () => {
        it('should return 409 when email already exists', async () => {
            // GIVEN: Registration data with existing email
            req.body = {
                firstName: 'Eve',
                lastName: 'Martinez',
                email: 'existing@admin.com',
                phone: '+4444444444',
                password: 'Password789!'
            };

            const existingAdmin = {
                _id: 'existing-admin-id',
                email: 'existing@admin.com'
            };

            Admin.findOne.mockResolvedValue(existingAdmin); // Email exists

            // WHEN: register is called with duplicate email
            await adminController.register(req, res, next);

            // THEN: Should return 409 conflict error
            expect(Admin.findOne).toHaveBeenCalledWith({ email: 'existing@admin.com' });
            expect(Admin.create).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Email already registered.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should prevent registration when email is taken', async () => {
            // GIVEN: Duplicate email scenario
            req.body = {
                firstName: 'Frank',
                lastName: 'Garcia',
                email: 'duplicate@admin.com',
                phone: '+5555555555',
                password: 'SecurePass!'
            };

            Admin.findOne.mockResolvedValue({ _id: 'other-admin-id' });

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should not create new admin
            expect(Admin.create).not.toHaveBeenCalled();
            expect(jwt.sign).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(409);
        });

        it('should handle null pointer risk when checking existing email', async () => {
            // GIVEN: Valid data but email check returns null
            req.body = {
                firstName: 'Grace',
                lastName: 'Lee',
                email: 'grace@admin.com',
                phone: '+6666666666',
                password: 'Password123!'
            };

            Admin.findOne.mockResolvedValue(null);
            Admin.create.mockResolvedValue({
                _id: 'new-admin-id',
                firstName: 'Grace',
                lastName: 'Lee',
                email: 'grace@admin.com',
                phone: '+6666666666',
                role: 'admin',
                permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
            });
            jwt.sign.mockReturnValue('token-grace');

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should proceed with registration when no existing email
            expect(Admin.create).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('should check email before creating admin', async () => {
            // GIVEN: Registration with duplicate email
            req.body = {
                firstName: 'Henry',
                lastName: 'Taylor',
                email: 'taken@admin.com',
                phone: '+7777777777',
                password: 'Password456!'
            };

            Admin.findOne.mockResolvedValue({ _id: 'existing-id' });

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should check email first before any creation
            expect(Admin.findOne).toHaveBeenCalledWith({ email: 'taken@admin.com' });
            expect(Admin.create).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(409);
        });
    });

    // ============================================================================
    // Test 3: register - Missing required fields returns 400 (Error Path)
    // ============================================================================
    describe('Test 3: register - Missing Required Fields Returns 400 (Error Path)', () => {
        it('should return 400 when firstName is missing', async () => {
            // GIVEN: Registration data without firstName
            req.body = {
                lastName: 'Anderson',
                email: 'anderson@admin.com',
                phone: '+8888888888',
                password: 'Password123!'
            };

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(Admin.findOne).not.toHaveBeenCalled();
            expect(Admin.create).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when lastName is missing', async () => {
            // GIVEN: Registration data without lastName
            req.body = {
                firstName: 'Isabel',
                email: 'isabel@admin.com',
                phone: '+9999999999',
                password: 'Password123!'
            };

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when email is missing', async () => {
            // GIVEN: Registration data without email
            req.body = {
                firstName: 'Jack',
                lastName: 'White',
                phone: '+1010101010',
                password: 'Password123!'
            };

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when phone is missing', async () => {
            // GIVEN: Registration data without phone
            req.body = {
                firstName: 'Karen',
                lastName: 'Black',
                email: 'karen@admin.com',
                password: 'Password123!'
            };

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when password is missing', async () => {
            // GIVEN: Registration data without password
            req.body = {
                firstName: 'Larry',
                lastName: 'Green',
                email: 'larry@admin.com',
                phone: '+1212121212'
            };

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when multiple fields are missing', async () => {
            // GIVEN: Registration data with only firstName and email
            req.body = {
                firstName: 'Monica',
                email: 'monica@admin.com'
            };

            // WHEN: register is called
            await adminController.register(req, res, next);

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
                password: null
            };

            // WHEN: register is called
            await adminController.register(req, res, next);

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
                password: undefined
            };

            // WHEN: register is called
            await adminController.register(req, res, next);

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
                password: ''
            };

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should validate fields before checking email uniqueness', async () => {
            // GIVEN: Registration with missing required field
            req.body = {
                firstName: 'Nancy',
                email: 'nancy@admin.com',
                phone: '+1313131313',
                password: 'Password123!'
                // Missing lastName
            };

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should validate required fields before database query
            expect(Admin.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    // ============================================================================
    // Test 4: login - Successful login with valid credentials (Happy Path)
    // ============================================================================
    describe('Test 4: login - Successful Login with Valid Credentials (Happy Path)', () => {
        it('should authenticate admin and return JWT token', async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: 'admin@admin.com',
                password: 'CorrectPassword123!'
            };

            const mockAdmin = {
                _id: 'admin-login-id',
                firstName: 'Oscar',
                lastName: 'Red',
                email: 'admin@admin.com',
                phone: '+1414141414',
                role: 'admin',
                permissions: ['manage-users', 'manage-restaurants', 'manage-orders'],
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            Admin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockAdmin)
            });
            jwt.sign.mockReturnValue('login-jwt-token');

            // WHEN: login is called
            await adminController.login(req, res, next);

            // THEN: Should authenticate and return success with JWT
            expect(Admin.findOne).toHaveBeenCalledWith({ email: 'admin@admin.com' });
            expect(mockAdmin.comparePassword).toHaveBeenCalledWith('CorrectPassword123!');
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 'admin-login-id', role: 'admin' },
                'test-secret-key',
                { expiresIn: '7d' }
            );
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'login-jwt-token',
                data: {
                    admin: {
                        id: 'admin-login-id',
                        firstName: 'Oscar',
                        lastName: 'Red',
                        email: 'admin@admin.com',
                        phone: '+1414141414',
                        role: 'admin',
                        permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
                    }
                }
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should select password field explicitly when querying', async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: 'peter@admin.com',
                password: 'Password456!'
            };

            const mockAdmin = {
                _id: 'admin-peter-id',
                firstName: 'Peter',
                lastName: 'Purple',
                email: 'peter@admin.com',
                phone: '+1515151515',
                role: 'admin',
                permissions: ['manage-users'],
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            const mockSelect = jest.fn().mockResolvedValue(mockAdmin);
            Admin.findOne.mockReturnValue({
                select: mockSelect
            });
            jwt.sign.mockReturnValue('token-peter');

            // WHEN: login is called
            await adminController.login(req, res, next);

            // THEN: Should call select with '+password' to explicitly include password field
            expect(mockSelect).toHaveBeenCalledWith('+password');
        });

        it('should return complete admin data on successful login', async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: 'quinn@admin.com',
                password: 'SecurePass789!'
            };

            const mockAdmin = {
                _id: 'admin-quinn-id',
                firstName: 'Quinn',
                lastName: 'Orange',
                email: 'quinn@admin.com',
                phone: '+1616161616',
                role: 'super-admin',
                permissions: ['manage-users', 'manage-restaurants', 'manage-orders', 'system-config'],
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            Admin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockAdmin)
            });
            jwt.sign.mockReturnValue('token-quinn');

            // WHEN: login is called
            await adminController.login(req, res, next);

            // THEN: Should return all admin fields including role and permissions
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'token-quinn',
                data: {
                    admin: expect.objectContaining({
                        id: 'admin-quinn-id',
                        firstName: 'Quinn',
                        lastName: 'Orange',
                        email: 'quinn@admin.com',
                        phone: '+1616161616',
                        role: 'super-admin',
                        permissions: ['manage-users', 'manage-restaurants', 'manage-orders', 'system-config']
                    })
                }
            });
        });

        it('should use signToken helper to generate JWT', async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: 'rachel@admin.com',
                password: 'Password999!'
            };

            const mockAdmin = {
                _id: 'admin-rachel-id',
                firstName: 'Rachel',
                lastName: 'Pink',
                email: 'rachel@admin.com',
                phone: '+1717171717',
                role: 'admin',
                permissions: ['manage-users', 'manage-restaurants', 'manage-orders'],
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            Admin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockAdmin)
            });
            jwt.sign.mockReturnValue('token-rachel');

            // WHEN: login is called
            await adminController.login(req, res, next);

            // THEN: Should call jwt.sign with correct parameters
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 'admin-rachel-id', role: 'admin' },
                'test-secret-key',
                { expiresIn: '7d' }
            );
        });
    });

    // ============================================================================
    // Test 5: login - Invalid credentials returns 401 (Error Path)
    // ============================================================================
    describe('Test 5: login - Invalid Credentials Returns 401 (Error Path)', () => {
        it('should return 401 when email does not exist', async () => {
            // GIVEN: Non-existent email
            req.body = {
                email: 'nonexistent@admin.com',
                password: 'AnyPassword123!'
            };

            Admin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(null)
            });

            // WHEN: login is called with non-existent email
            await adminController.login(req, res, next);

            // THEN: Should return 401 unauthorized error
            expect(Admin.findOne).toHaveBeenCalledWith({ email: 'nonexistent@admin.com' });
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
                email: 'samuel@admin.com',
                password: 'WrongPassword123!'
            };

            const mockAdmin = {
                _id: 'admin-samuel-id',
                email: 'samuel@admin.com',
                comparePassword: jest.fn().mockResolvedValue(false)
            };

            Admin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockAdmin)
            });

            // WHEN: login is called with wrong password
            await adminController.login(req, res, next);

            // THEN: Should return 401 unauthorized error
            expect(mockAdmin.comparePassword).toHaveBeenCalledWith('WrongPassword123!');
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
            await adminController.login(req, res, next);

            // THEN: Should return 400 bad request
            expect(Admin.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Email and password are required.'
            });
        });

        it('should return 400 when password is missing', async () => {
            // GIVEN: Login request without password
            req.body = {
                email: 'tom@admin.com'
            };

            // WHEN: login is called
            await adminController.login(req, res, next);

            // THEN: Should return 400 bad request
            expect(Admin.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Email and password are required.'
            });
        });

        it('should return 400 when both email and password are missing', async () => {
            // GIVEN: Empty login request
            req.body = {};

            // WHEN: login is called
            await adminController.login(req, res, next);

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
            await adminController.login(req, res, next);

            // THEN: Should return 400 for null pointer risk
            expect(Admin.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle null password', async () => {
            // GIVEN: Login with null password
            req.body = {
                email: 'uma@admin.com',
                password: null
            };

            // WHEN: login is called
            await adminController.login(req, res, next);

            // THEN: Should return 400 for null pointer risk
            expect(Admin.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle undefined email', async () => {
            // GIVEN: Login with undefined email
            req.body = {
                email: undefined,
                password: 'Password123!'
            };

            // WHEN: login is called
            await adminController.login(req, res, next);

            // THEN: Should return 400
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle empty string email', async () => {
            // GIVEN: Login with empty string email
            req.body = {
                email: '',
                password: 'Password123!'
            };

            // WHEN: login is called
            await adminController.login(req, res, next);

            // THEN: Should return 400
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should prevent brute force by not revealing if email exists', async () => {
            // GIVEN: Two scenarios - non-existent email and wrong password
            req.body = {
                email: 'test@admin.com',
                password: 'TestPassword!'
            };

            Admin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(null)
            });

            // WHEN: login is called with non-existent email
            await adminController.login(req, res, next);

            // THEN: Should return same error message as wrong password
            expect(res.json).toHaveBeenCalledWith({
                message: 'Invalid credentials.'
            });

            // Reset mocks
            jest.clearAllMocks();

            // GIVEN: Valid email but wrong password
            const mockAdmin = {
                _id: 'admin-id',
                email: 'test@admin.com',
                comparePassword: jest.fn().mockResolvedValue(false)
            };

            Admin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockAdmin)
            });

            // WHEN: login is called with wrong password
            await adminController.login(req, res, next);

            // THEN: Should return same error message
            expect(res.json).toHaveBeenCalledWith({
                message: 'Invalid credentials.'
            });
        });
    });

    // ============================================================================
    // Exception Handling Tests
    // ============================================================================
    describe('Exception Handling Tests', () => {
        it('should call next with error when register throws exception', async () => {
            // GIVEN: Valid registration data but database throws error
            req.body = {
                firstName: 'Victor',
                lastName: 'Bronze',
                email: 'victor@admin.com',
                phone: '+1818181818',
                password: 'Password123!'
            };

            const dbError = new Error('Database connection failed');
            Admin.findOne.mockRejectedValue(dbError);

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should pass error to next middleware
            expect(next).toHaveBeenCalledWith(dbError);
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should call next with error when login throws exception', async () => {
            // GIVEN: Valid login data but database throws error
            req.body = {
                email: 'error@admin.com',
                password: 'Password123!'
            };

            const dbError = new Error('Database query failed');
            Admin.findOne.mockReturnValue({
                select: jest.fn().mockRejectedValue(dbError)
            });

            // WHEN: login is called
            await adminController.login(req, res, next);

            // THEN: Should pass error to next middleware
            expect(next).toHaveBeenCalledWith(dbError);
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should handle JWT signing errors in register', async () => {
            // GIVEN: Valid registration but JWT signing fails
            req.body = {
                firstName: 'Wendy',
                lastName: 'Copper',
                email: 'wendy@admin.com',
                phone: '+1919191919',
                password: 'Password123!'
            };

            Admin.findOne.mockResolvedValue(null);
            Admin.create.mockResolvedValue({
                _id: 'wendy-admin-id',
                firstName: 'Wendy',
                lastName: 'Copper',
                email: 'wendy@admin.com',
                phone: '+1919191919',
                role: 'admin',
                permissions: ['manage-users', 'manage-restaurants', 'manage-orders']
            });

            const jwtError = new Error('JWT secret not configured');
            jwt.sign.mockImplementation(() => {
                throw jwtError;
            });

            // WHEN: register is called
            await adminController.register(req, res, next);

            // THEN: Should pass error to next middleware
            expect(next).toHaveBeenCalledWith(jwtError);
        });

        it('should handle comparePassword throwing error', async () => {
            // GIVEN: Valid login but comparePassword throws error
            req.body = {
                email: 'xavier@admin.com',
                password: 'Password123!'
            };

            const compareError = new Error('Bcrypt error');
            const mockAdmin = {
                _id: 'admin-xavier-id',
                email: 'xavier@admin.com',
                comparePassword: jest.fn().mockRejectedValue(compareError)
            };

            Admin.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockAdmin)
            });

            // WHEN: login is called
            await adminController.login(req, res, next);

            // THEN: Should pass error to next middleware
            expect(next).toHaveBeenCalledWith(compareError);
        });
    });
});
