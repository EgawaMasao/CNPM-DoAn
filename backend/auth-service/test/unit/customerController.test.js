// backend/auth-service/test/unit/customerController.test.js
const jwt = require('jsonwebtoken');
const Customer = require('../../models/Customer');
const customerController = require('../../controllers/customerController');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../models/Customer');

describe('CustomerController Unit Tests - Shopee QA Standards', () => {
    let req, res, next;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Setup mock request object
        req = {
            body: {},
            userId: null
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
        it('should create new customer with optional location and return JWT token', async () => {
            // GIVEN: Valid registration data with location
            req.body = {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@customer.com',
                phone: '+1234567890',
                password: 'SecurePass123!',
                location: '123 Main Street, City'
            };

            const mockCustomer = {
                _id: 'mock-customer-id-123',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@customer.com',
                phone: '+1234567890',
                location: '123 Main Street, City'
            };

            Customer.findOne.mockResolvedValue(null); // No existing email
            Customer.create.mockResolvedValue(mockCustomer);
            jwt.sign.mockReturnValue('mock-jwt-token-xyz');

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should create customer with location and return JWT
            expect(Customer.findOne).toHaveBeenCalledWith({ email: req.body.email });
            expect(Customer.create).toHaveBeenCalledWith({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@customer.com',
                phone: '+1234567890',
                password: 'SecurePass123!',
                location: '123 Main Street, City'
            });
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: mockCustomer._id, role: 'customer' },
                'test-secret-key',
                { expiresIn: '7d' }
            );
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'mock-jwt-token-xyz',
                data: {
                    customer: {
                        id: mockCustomer._id,
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john.doe@customer.com',
                        phone: '+1234567890',
                        location: '123 Main Street, City'
                    }
                }
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should create customer without location when not provided', async () => {
            // GIVEN: Valid registration data without location
            req.body = {
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@customer.com',
                phone: '+9876543210',
                password: 'Password123!'
            };

            const mockCustomer = {
                _id: 'customer-id-456',
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@customer.com',
                phone: '+9876543210',
                location: undefined
            };

            Customer.findOne.mockResolvedValue(null);
            Customer.create.mockResolvedValue(mockCustomer);
            jwt.sign.mockReturnValue('jwt-token-abc');

            // WHEN: register is called without location
            await customerController.register(req, res, next);

            // THEN: Should create customer without location field
            expect(Customer.create).toHaveBeenCalledWith({
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@customer.com',
                phone: '+9876543210',
                password: 'Password123!',
                location: undefined
            });
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('should sign JWT with customer role', async () => {
            // GIVEN: Valid registration data
            req.body = {
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob@customer.com',
                phone: '+1111111111',
                password: 'MyPass456!'
            };

            const mockCustomer = {
                _id: 'customer-bob-id',
                firstName: 'Bob',
                lastName: 'Johnson',
                email: 'bob@customer.com',
                phone: '+1111111111',
                location: undefined
            };

            Customer.findOne.mockResolvedValue(null);
            Customer.create.mockResolvedValue(mockCustomer);
            jwt.sign.mockReturnValue('jwt-token-def');

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should sign JWT with customer role
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 'customer-bob-id', role: 'customer' },
                'test-secret-key',
                { expiresIn: '7d' }
            );
        });

        it('should return all customer fields in response', async () => {
            // GIVEN: Valid registration data
            req.body = {
                firstName: 'Charlie',
                lastName: 'Brown',
                email: 'charlie@customer.com',
                phone: '+2222222222',
                password: 'Password789!',
                location: '456 Oak Avenue'
            };

            const mockCustomer = {
                _id: 'customer-charlie-id',
                firstName: 'Charlie',
                lastName: 'Brown',
                email: 'charlie@customer.com',
                phone: '+2222222222',
                location: '456 Oak Avenue'
            };

            Customer.findOne.mockResolvedValue(null);
            Customer.create.mockResolvedValue(mockCustomer);
            jwt.sign.mockReturnValue('token-charlie');

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should return complete customer data including location
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'token-charlie',
                data: {
                    customer: {
                        id: 'customer-charlie-id',
                        firstName: 'Charlie',
                        lastName: 'Brown',
                        email: 'charlie@customer.com',
                        phone: '+2222222222',
                        location: '456 Oak Avenue'
                    }
                }
            });
        });

        it('should handle empty string location as optional', async () => {
            // GIVEN: Valid registration data with empty string location
            req.body = {
                firstName: 'David',
                lastName: 'Wilson',
                email: 'david@customer.com',
                phone: '+3333333333',
                password: 'SecurePass!',
                location: ''
            };

            const mockCustomer = {
                _id: 'customer-david-id',
                firstName: 'David',
                lastName: 'Wilson',
                email: 'david@customer.com',
                phone: '+3333333333',
                location: ''
            };

            Customer.findOne.mockResolvedValue(null);
            Customer.create.mockResolvedValue(mockCustomer);
            jwt.sign.mockReturnValue('token-david');

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should accept empty string location
            expect(Customer.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    location: ''
                })
            );
            expect(res.status).toHaveBeenCalledWith(201);
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
                email: 'existing@customer.com',
                phone: '+4444444444',
                password: 'Password789!'
            };

            const existingCustomer = {
                _id: 'existing-customer-id',
                email: 'existing@customer.com'
            };

            Customer.findOne.mockResolvedValue(existingCustomer); // Email exists

            // WHEN: register is called with duplicate email
            await customerController.register(req, res, next);

            // THEN: Should return 409 conflict error
            expect(Customer.findOne).toHaveBeenCalledWith({ email: 'existing@customer.com' });
            expect(Customer.create).not.toHaveBeenCalled();
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
                email: 'duplicate@customer.com',
                phone: '+5555555555',
                password: 'SecurePass!'
            };

            Customer.findOne.mockResolvedValue({ _id: 'other-customer-id' });

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should not create new customer
            expect(Customer.create).not.toHaveBeenCalled();
            expect(jwt.sign).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(409);
        });

        it('should handle null pointer risk when checking existing email', async () => {
            // GIVEN: Valid data but email check returns null
            req.body = {
                firstName: 'Grace',
                lastName: 'Lee',
                email: 'grace@customer.com',
                phone: '+6666666666',
                password: 'Password123!'
            };

            Customer.findOne.mockResolvedValue(null);
            Customer.create.mockResolvedValue({
                _id: 'new-customer-id',
                firstName: 'Grace',
                lastName: 'Lee',
                email: 'grace@customer.com',
                phone: '+6666666666',
                location: undefined
            });
            jwt.sign.mockReturnValue('token-grace');

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should proceed with registration when no existing email
            expect(Customer.create).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('should check email before creating customer', async () => {
            // GIVEN: Registration with duplicate email
            req.body = {
                firstName: 'Henry',
                lastName: 'Taylor',
                email: 'taken@customer.com',
                phone: '+7777777777',
                password: 'Password456!'
            };

            Customer.findOne.mockResolvedValue({ _id: 'existing-id' });

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should check email first before any creation
            expect(Customer.findOne).toHaveBeenCalledWith({ email: 'taken@customer.com' });
            expect(Customer.create).not.toHaveBeenCalled();
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
                email: 'anderson@customer.com',
                phone: '+8888888888',
                password: 'Password123!'
            };

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(Customer.findOne).not.toHaveBeenCalled();
            expect(Customer.create).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should return 400 when lastName is missing', async () => {
            // GIVEN: Registration data without lastName
            req.body = {
                firstName: 'Isabel',
                email: 'isabel@customer.com',
                phone: '+9999999999',
                password: 'Password123!'
            };

            // WHEN: register is called
            await customerController.register(req, res, next);

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
            await customerController.register(req, res, next);

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
                email: 'karen@customer.com',
                password: 'Password123!'
            };

            // WHEN: register is called
            await customerController.register(req, res, next);

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
                email: 'larry@customer.com',
                phone: '+1212121212'
            };

            // WHEN: register is called
            await customerController.register(req, res, next);

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
                email: 'monica@customer.com'
            };

            // WHEN: register is called
            await customerController.register(req, res, next);

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
            await customerController.register(req, res, next);

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
            await customerController.register(req, res, next);

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
            await customerController.register(req, res, next);

            // THEN: Should return 400 validation error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Please provide all required fields.'
            });
        });

        it('should allow missing location field', async () => {
            // GIVEN: Valid registration without location (optional field)
            req.body = {
                firstName: 'Nancy',
                lastName: 'Blue',
                email: 'nancy@customer.com',
                phone: '+1313131313',
                password: 'Password123!'
                // location is not provided (optional)
            };

            Customer.findOne.mockResolvedValue(null);
            Customer.create.mockResolvedValue({
                _id: 'customer-nancy-id',
                firstName: 'Nancy',
                lastName: 'Blue',
                email: 'nancy@customer.com',
                phone: '+1313131313',
                location: undefined
            });
            jwt.sign.mockReturnValue('token-nancy');

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should accept registration without location
            expect(res.status).toHaveBeenCalledWith(201);
            expect(Customer.create).toHaveBeenCalled();
        });

        it('should validate fields before checking email uniqueness', async () => {
            // GIVEN: Registration with missing required field
            req.body = {
                firstName: 'Oscar',
                email: 'oscar@customer.com',
                phone: '+1414141414',
                password: 'Password123!'
                // Missing lastName
            };

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should validate required fields before database query
            expect(Customer.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    // ============================================================================
    // Test 4: login - Successful login with valid credentials (Happy Path)
    // ============================================================================
    describe('Test 4: login - Successful Login with Valid Credentials (Happy Path)', () => {
        it('should authenticate customer and return JWT token with customer role', async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: 'customer@customer.com',
                password: 'CorrectPassword123!'
            };

            const mockCustomer = {
                _id: 'customer-login-id',
                firstName: 'Peter',
                lastName: 'Purple',
                email: 'customer@customer.com',
                phone: '+1515151515',
                location: '789 Pine Street',
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            Customer.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockCustomer)
            });
            jwt.sign.mockReturnValue('login-jwt-token');

            // WHEN: login is called
            await customerController.login(req, res, next);

            // THEN: Should authenticate and return success with JWT and customer role
            expect(Customer.findOne).toHaveBeenCalledWith({ email: 'customer@customer.com' });
            expect(mockCustomer.comparePassword).toHaveBeenCalledWith('CorrectPassword123!');
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 'customer-login-id', role: 'customer' },
                'test-secret-key',
                { expiresIn: '7d' }
            );
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'login-jwt-token',
                data: {
                    customer: {
                        id: 'customer-login-id',
                        firstName: 'Peter',
                        lastName: 'Purple',
                        email: 'customer@customer.com',
                        phone: '+1515151515',
                        location: '789 Pine Street'
                    }
                }
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should select password field explicitly when querying', async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: 'quinn@customer.com',
                password: 'Password456!'
            };

            const mockCustomer = {
                _id: 'customer-quinn-id',
                firstName: 'Quinn',
                lastName: 'Orange',
                email: 'quinn@customer.com',
                phone: '+1616161616',
                location: undefined,
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            const mockSelect = jest.fn().mockResolvedValue(mockCustomer);
            Customer.findOne.mockReturnValue({
                select: mockSelect
            });
            jwt.sign.mockReturnValue('token-quinn');

            // WHEN: login is called
            await customerController.login(req, res, next);

            // THEN: Should call select with '+password' to explicitly include password field
            expect(mockSelect).toHaveBeenCalledWith('+password');
        });

        it('should return complete customer data including location', async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: 'rachel@customer.com',
                password: 'SecurePass789!'
            };

            const mockCustomer = {
                _id: 'customer-rachel-id',
                firstName: 'Rachel',
                lastName: 'Pink',
                email: 'rachel@customer.com',
                phone: '+1717171717',
                location: '321 Elm Street',
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            Customer.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockCustomer)
            });
            jwt.sign.mockReturnValue('token-rachel');

            // WHEN: login is called
            await customerController.login(req, res, next);

            // THEN: Should return all customer fields including location
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'token-rachel',
                data: {
                    customer: expect.objectContaining({
                        id: 'customer-rachel-id',
                        firstName: 'Rachel',
                        lastName: 'Pink',
                        email: 'rachel@customer.com',
                        phone: '+1717171717',
                        location: '321 Elm Street'
                    })
                }
            });
        });

        it('should sign JWT with customer role not admin role', async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: 'samuel@customer.com',
                password: 'Password999!'
            };

            const mockCustomer = {
                _id: 'customer-samuel-id',
                firstName: 'Samuel',
                lastName: 'Silver',
                email: 'samuel@customer.com',
                phone: '+1818181818',
                location: null,
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            Customer.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockCustomer)
            });
            jwt.sign.mockReturnValue('token-samuel');

            // WHEN: login is called
            await customerController.login(req, res, next);

            // THEN: Should call jwt.sign with customer role, not admin
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 'customer-samuel-id', role: 'customer' },
                'test-secret-key',
                { expiresIn: '7d' }
            );
            expect(jwt.sign).not.toHaveBeenCalledWith(
                expect.objectContaining({ role: 'admin' }),
                expect.anything(),
                expect.anything()
            );
        });

        it('should handle customer without location in response', async () => {
            // GIVEN: Valid login for customer without location
            req.body = {
                email: 'tom@customer.com',
                password: 'Password111!'
            };

            const mockCustomer = {
                _id: 'customer-tom-id',
                firstName: 'Tom',
                lastName: 'Gold',
                email: 'tom@customer.com',
                phone: '+1919191919',
                location: undefined,
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            Customer.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockCustomer)
            });
            jwt.sign.mockReturnValue('token-tom');

            // WHEN: login is called
            await customerController.login(req, res, next);

            // THEN: Should return customer data with undefined location
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                token: 'token-tom',
                data: {
                    customer: expect.objectContaining({
                        location: undefined
                    })
                }
            });
        });
    });

    // ============================================================================
    // Test 5: login - Invalid credentials returns 401 (Error Path)
    // ============================================================================
    describe('Test 5: login - Invalid Credentials Returns 401 (Error Path)', () => {
        it('should return 401 when email does not exist', async () => {
            // GIVEN: Non-existent email
            req.body = {
                email: 'nonexistent@customer.com',
                password: 'AnyPassword123!'
            };

            Customer.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(null)
            });

            // WHEN: login is called with non-existent email
            await customerController.login(req, res, next);

            // THEN: Should return 401 unauthorized error
            expect(Customer.findOne).toHaveBeenCalledWith({ email: 'nonexistent@customer.com' });
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
                email: 'uma@customer.com',
                password: 'WrongPassword123!'
            };

            const mockCustomer = {
                _id: 'customer-uma-id',
                email: 'uma@customer.com',
                comparePassword: jest.fn().mockResolvedValue(false)
            };

            Customer.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockCustomer)
            });

            // WHEN: login is called with wrong password
            await customerController.login(req, res, next);

            // THEN: Should return 401 unauthorized error
            expect(mockCustomer.comparePassword).toHaveBeenCalledWith('WrongPassword123!');
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
            await customerController.login(req, res, next);

            // THEN: Should return 400 bad request
            expect(Customer.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Email and password are required.'
            });
        });

        it('should return 400 when password is missing', async () => {
            // GIVEN: Login request without password
            req.body = {
                email: 'victor@customer.com'
            };

            // WHEN: login is called
            await customerController.login(req, res, next);

            // THEN: Should return 400 bad request
            expect(Customer.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Email and password are required.'
            });
        });

        it('should return 400 when both email and password are missing', async () => {
            // GIVEN: Empty login request
            req.body = {};

            // WHEN: login is called
            await customerController.login(req, res, next);

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
            await customerController.login(req, res, next);

            // THEN: Should return 400 for null pointer risk
            expect(Customer.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle null password', async () => {
            // GIVEN: Login with null password
            req.body = {
                email: 'wendy@customer.com',
                password: null
            };

            // WHEN: login is called
            await customerController.login(req, res, next);

            // THEN: Should return 400 for null pointer risk
            expect(Customer.findOne).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle undefined email', async () => {
            // GIVEN: Login with undefined email
            req.body = {
                email: undefined,
                password: 'Password123!'
            };

            // WHEN: login is called
            await customerController.login(req, res, next);

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
            await customerController.login(req, res, next);

            // THEN: Should return 400
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle empty string password', async () => {
            // GIVEN: Login with empty string password
            req.body = {
                email: 'xavier@customer.com',
                password: ''
            };

            // WHEN: login is called
            await customerController.login(req, res, next);

            // THEN: Should return 400
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should prevent brute force by not revealing if email exists', async () => {
            // GIVEN: Two scenarios - non-existent email and wrong password
            req.body = {
                email: 'test@customer.com',
                password: 'TestPassword!'
            };

            Customer.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(null)
            });

            // WHEN: login is called with non-existent email
            await customerController.login(req, res, next);

            // THEN: Should return same error message as wrong password
            expect(res.json).toHaveBeenCalledWith({
                message: 'Invalid credentials.'
            });

            // Reset mocks
            jest.clearAllMocks();

            // GIVEN: Valid email but wrong password
            const mockCustomer = {
                _id: 'customer-id',
                email: 'test@customer.com',
                comparePassword: jest.fn().mockResolvedValue(false)
            };

            Customer.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockCustomer)
            });

            // WHEN: login is called with wrong password
            await customerController.login(req, res, next);

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
                firstName: 'Yvonne',
                lastName: 'Bronze',
                email: 'yvonne@customer.com',
                phone: '+2020202020',
                password: 'Password123!'
            };

            const dbError = new Error('Database connection failed');
            Customer.findOne.mockRejectedValue(dbError);

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should pass error to next middleware
            expect(next).toHaveBeenCalledWith(dbError);
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should call next with error when login throws exception', async () => {
            // GIVEN: Valid login data but database throws error
            req.body = {
                email: 'error@customer.com',
                password: 'Password123!'
            };

            const dbError = new Error('Database query failed');
            Customer.findOne.mockReturnValue({
                select: jest.fn().mockRejectedValue(dbError)
            });

            // WHEN: login is called
            await customerController.login(req, res, next);

            // THEN: Should pass error to next middleware
            expect(next).toHaveBeenCalledWith(dbError);
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should handle JWT signing errors in register', async () => {
            // GIVEN: Valid registration but JWT signing fails
            req.body = {
                firstName: 'Zoe',
                lastName: 'Copper',
                email: 'zoe@customer.com',
                phone: '+2121212121',
                password: 'Password123!'
            };

            Customer.findOne.mockResolvedValue(null);
            Customer.create.mockResolvedValue({
                _id: 'zoe-customer-id',
                firstName: 'Zoe',
                lastName: 'Copper',
                email: 'zoe@customer.com',
                phone: '+2121212121',
                location: undefined
            });

            const jwtError = new Error('JWT secret not configured');
            jwt.sign.mockImplementation(() => {
                throw jwtError;
            });

            // WHEN: register is called
            await customerController.register(req, res, next);

            // THEN: Should pass error to next middleware
            expect(next).toHaveBeenCalledWith(jwtError);
        });

        it('should handle comparePassword throwing error', async () => {
            // GIVEN: Valid login but comparePassword throws error
            req.body = {
                email: 'adam@customer.com',
                password: 'Password123!'
            };

            const compareError = new Error('Bcrypt error');
            const mockCustomer = {
                _id: 'customer-adam-id',
                email: 'adam@customer.com',
                comparePassword: jest.fn().mockRejectedValue(compareError)
            };

            Customer.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockCustomer)
            });

            // WHEN: login is called
            await customerController.login(req, res, next);

            // THEN: Should pass error to next middleware
            expect(next).toHaveBeenCalledWith(compareError);
        });
    });
});
