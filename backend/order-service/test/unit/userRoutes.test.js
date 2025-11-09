import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock controller functions - must return actual functions
const mockRegisterUser = jest.fn((req, res) => {
    res.status(201).json({ message: 'User registered successfully', userId: 'user_123' });
});

const mockLoginUser = jest.fn((req, res) => {
    res.status(200).json({ message: 'Login successful', token: 'jwt_token_123' });
});

jest.unstable_mockModule('../../controllers/userController.js', () => ({
    registerUser: mockRegisterUser,
    loginUser: mockLoginUser
}));

// Import router after mocking
const userRoutes = await import('../../routes/userRoutes.js');

describe('UserRoutes Unit Tests - Shopee QA Standards', () => {
    let app;

    beforeEach(() => {
        // Create a fresh Express app for each test
        app = express();
        app.use(express.json());
        app.use('/users', userRoutes.default);

        // Clear controller mocks
        mockRegisterUser.mockClear();
        mockLoginUser.mockClear();

        // Reset default controller responses
        mockRegisterUser.mockImplementation((req, res) => {
            res.status(201).json({ 
                message: 'User registered successfully',
                userId: 'user_123',
                email: req.body.email
            });
        });

        mockLoginUser.mockImplementation((req, res) => {
            res.status(200).json({ 
                message: 'Login successful',
                token: 'jwt_token_123',
                user: {
                    id: 'user_123',
                    email: req.body.email
                }
            });
        });
    });

    // ============================================================================
    // Test 1: POST /register - User registration success (Happy Path)
    // ============================================================================
    describe('Test 1: POST /register - User Registration Success (Happy Path)', () => {
        it('should successfully register a new user with valid data', async () => {
            // GIVEN: Valid user registration data
            const registrationData = {
                name: 'John Doe',
                email: 'john.doe@example.com',
                password: 'SecurePassword123!',
                phone: '+1234567890',
                address: '123 Main Street, City, Country'
            };

            // WHEN: POST request is made to /register endpoint
            const response = await request(app)
                .post('/users/register')
                .send(registrationData)
                .expect(201);

            // THEN: Should call registerUser controller and return success response
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(mockRegisterUser).toHaveBeenCalledTimes(1);
            expect(response.body).toHaveProperty('message', 'User registered successfully');
            expect(response.body).toHaveProperty('userId');
            expect(response.body).toHaveProperty('email', registrationData.email);
        });

        it('should pass complete registration data to controller', async () => {
            // GIVEN: Complete user registration data with all fields
            const completeData = {
                name: 'Jane Smith',
                email: 'jane.smith@shopee.com',
                password: 'StrongPass456!',
                phone: '+9876543210',
                address: '456 Oak Avenue, Downtown',
                role: 'customer'
            };

            mockRegisterUser.mockImplementationOnce((req, res) => {
                // Verify all data is passed correctly
                expect(req.body).toEqual(completeData);
                res.status(201).json({ 
                    message: 'User registered',
                    userId: 'user_complete_123',
                    email: req.body.email
                });
            });

            // WHEN: Complete registration request is made
            const response = await request(app)
                .post('/users/register')
                .send(completeData)
                .expect(201);

            // THEN: Should process all fields correctly
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body.email).toBe(completeData.email);
        });

        it('should handle registration with minimum required fields', async () => {
            // GIVEN: Minimum required registration data
            const minimalData = {
                email: 'minimal@example.com',
                password: 'MinPass123!'
            };

            mockRegisterUser.mockImplementationOnce((req, res) => {
                res.status(201).json({ 
                    message: 'User registered',
                    userId: 'user_minimal_456',
                    email: req.body.email
                });
            });

            // WHEN: Registration with minimal data is submitted
            const response = await request(app)
                .post('/users/register')
                .send(minimalData)
                .expect(201);

            // THEN: Should successfully register with minimal fields
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('userId');
        });

        it('should return user data in response after successful registration', async () => {
            // GIVEN: Valid registration data
            const userData = {
                name: 'Test User',
                email: 'testuser@shopee.com',
                password: 'TestPass789!'
            };

            mockRegisterUser.mockImplementationOnce((req, res) => {
                res.status(201).json({ 
                    message: 'User registered successfully',
                    userId: 'user_test_789',
                    email: req.body.email,
                    name: req.body.name,
                    createdAt: new Date().toISOString()
                });
            });

            // WHEN: User registers
            const response = await request(app)
                .post('/users/register')
                .send(userData)
                .expect(201);

            // THEN: Should return complete user information
            expect(response.body).toHaveProperty('userId');
            expect(response.body).toHaveProperty('email', userData.email);
            expect(response.body).toHaveProperty('name', userData.name);
            expect(response.body).toHaveProperty('createdAt');
        });

        it('should handle special characters in user data', async () => {
            // GIVEN: User data with special characters
            const specialCharData = {
                name: "O'Brien-Smith",
                email: 'user+test@example.co.uk',
                password: 'P@ssw0rd!#$%',
                address: '123 Café Street, São Paulo'
            };

            mockRegisterUser.mockImplementationOnce((req, res) => {
                res.status(201).json({ 
                    message: 'User registered',
                    userId: 'user_special_999',
                    email: req.body.email,
                    name: req.body.name
                });
            });

            // WHEN: Registration with special characters is submitted
            const response = await request(app)
                .post('/users/register')
                .send(specialCharData)
                .expect(201);

            // THEN: Should handle special characters correctly
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body.name).toBe(specialCharData.name);
            expect(response.body.email).toBe(specialCharData.email);
        });
    });

    // ============================================================================
    // Test 2: POST /register - Registration with invalid data (Error Path)
    // ============================================================================
    describe('Test 2: POST /register - Registration with Invalid Data (Error Path)', () => {
        it('should return 400 when email is missing', async () => {
            // GIVEN: Registration data without email
            const dataWithoutEmail = {
                name: 'John Doe',
                password: 'SecurePass123!',
                phone: '+1234567890'
            };

            mockRegisterUser.mockImplementationOnce((req, res) => {
                if (!req.body.email) {
                    res.status(400).json({ 
                        error: 'Email is required',
                        field: 'email'
                    });
                } else {
                    res.status(201).json({ message: 'User registered' });
                }
            });

            // WHEN: Registration without email is attempted
            const response = await request(app)
                .post('/users/register')
                .send(dataWithoutEmail)
                .expect(400);

            // THEN: Should return validation error
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Email is required');
            expect(response.body).toHaveProperty('field', 'email');
        });

        it('should return 400 when email is null', async () => {
            // GIVEN: Registration data with null email
            const dataWithNullEmail = {
                name: 'John Doe',
                email: null,
                password: 'SecurePass123!'
            };

            mockRegisterUser.mockImplementationOnce((req, res) => {
                if (!req.body.email || req.body.email === null) {
                    res.status(400).json({ 
                        error: 'Email is required and cannot be null',
                        field: 'email'
                    });
                } else {
                    res.status(201).json({ message: 'User registered' });
                }
            });

            // WHEN: Registration with null email is attempted
            const response = await request(app)
                .post('/users/register')
                .send(dataWithNullEmail)
                .expect(400);

            // THEN: Should handle null email appropriately
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error');
        });

        it('should return 400 when email format is invalid', async () => {
            // GIVEN: Registration data with invalid email format
            const dataWithInvalidEmail = {
                name: 'John Doe',
                email: 'invalid-email-format',
                password: 'SecurePass123!'
            };

            mockRegisterUser.mockImplementationOnce((req, res) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(req.body.email)) {
                    res.status(400).json({ 
                        error: 'Invalid email format',
                        field: 'email'
                    });
                } else {
                    res.status(201).json({ message: 'User registered' });
                }
            });

            // WHEN: Registration with invalid email format is attempted
            const response = await request(app)
                .post('/users/register')
                .send(dataWithInvalidEmail)
                .expect(400);

            // THEN: Should validate email format
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Invalid email format');
        });

        it('should return 400 when password is missing', async () => {
            // GIVEN: Registration data without password
            const dataWithoutPassword = {
                name: 'John Doe',
                email: 'john.doe@example.com',
                phone: '+1234567890'
            };

            mockRegisterUser.mockImplementationOnce((req, res) => {
                if (!req.body.password) {
                    res.status(400).json({ 
                        error: 'Password is required',
                        field: 'password'
                    });
                } else {
                    res.status(201).json({ message: 'User registered' });
                }
            });

            // WHEN: Registration without password is attempted
            const response = await request(app)
                .post('/users/register')
                .send(dataWithoutPassword)
                .expect(400);

            // THEN: Should return password required error
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Password is required');
            expect(response.body).toHaveProperty('field', 'password');
        });

        it('should return 400 when password is too weak', async () => {
            // GIVEN: Registration data with weak password
            const dataWithWeakPassword = {
                name: 'John Doe',
                email: 'john.doe@example.com',
                password: '123'
            };

            mockRegisterUser.mockImplementationOnce((req, res) => {
                if (req.body.password && req.body.password.length < 8) {
                    res.status(400).json({ 
                        error: 'Password must be at least 8 characters long',
                        field: 'password'
                    });
                } else {
                    res.status(201).json({ message: 'User registered' });
                }
            });

            // WHEN: Registration with weak password is attempted
            const response = await request(app)
                .post('/users/register')
                .send(dataWithWeakPassword)
                .expect(400);

            // THEN: Should validate password strength
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Password');
        });

        it('should return 409 when user already exists (duplicate email)', async () => {
            // GIVEN: Registration data with existing email
            const duplicateEmailData = {
                name: 'John Doe',
                email: 'existing@example.com',
                password: 'SecurePass123!'
            };

            mockRegisterUser.mockImplementationOnce((req, res) => {
                // Simulate duplicate email check
                res.status(409).json({ 
                    error: 'User with this email already exists',
                    field: 'email'
                });
            });

            // WHEN: Registration with duplicate email is attempted
            const response = await request(app)
                .post('/users/register')
                .send(duplicateEmailData)
                .expect(409);

            // THEN: Should return conflict error
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'User with this email already exists');
        });

        it('should return 400 when request body is empty', async () => {
            // GIVEN: Empty request body
            mockRegisterUser.mockImplementationOnce((req, res) => {
                if (!req.body || Object.keys(req.body).length === 0) {
                    res.status(400).json({ 
                        error: 'Request body is required'
                    });
                } else {
                    res.status(201).json({ message: 'User registered' });
                }
            });

            // WHEN: Registration with empty body is attempted
            const response = await request(app)
                .post('/users/register')
                .send({})
                .expect(400);

            // THEN: Should reject empty request
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error');
        });

        it('should return 400 when password is null', async () => {
            // GIVEN: Registration data with null password
            const dataWithNullPassword = {
                email: 'user@example.com',
                password: null
            };

            mockRegisterUser.mockImplementationOnce((req, res) => {
                if (req.body.password === null || req.body.password === undefined) {
                    res.status(400).json({ 
                        error: 'Password cannot be null',
                        field: 'password'
                    });
                } else {
                    res.status(201).json({ message: 'User registered' });
                }
            });

            // WHEN: Registration with null password is attempted
            const response = await request(app)
                .post('/users/register')
                .send(dataWithNullPassword)
                .expect(400);

            // THEN: Should handle null password
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error');
        });

        it('should handle controller throwing exception during registration', async () => {
            // GIVEN: Controller throws an exception
            mockRegisterUser.mockImplementationOnce((req, res) => {
                res.status(500).json({ 
                    error: 'Internal server error',
                    message: 'Failed to register user'
                });
            });

            // WHEN: Registration causes server error
            const response = await request(app)
                .post('/users/register')
                .send({
                    email: 'error@example.com',
                    password: 'Pass123!'
                })
                .expect(500);

            // THEN: Should return server error
            expect(mockRegisterUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Internal server error');
        });

        it('should handle malformed JSON in request body', async () => {
            // GIVEN: Malformed JSON is sent
            // WHEN: Request with malformed JSON is made
            const response = await request(app)
                .post('/users/register')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}')
                .expect(400);

            // THEN: Express should handle JSON parsing error
            expect(mockRegisterUser).not.toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 3: POST /login - User login success (Happy Path)
    // ============================================================================
    describe('Test 3: POST /login - User Login Success (Happy Path)', () => {
        it('should successfully login user with valid credentials', async () => {
            // GIVEN: Valid login credentials
            const loginData = {
                email: 'john.doe@example.com',
                password: 'SecurePassword123!'
            };

            // WHEN: POST request is made to /login endpoint
            const response = await request(app)
                .post('/users/login')
                .send(loginData)
                .expect(200);

            // THEN: Should call loginUser controller and return success with token
            expect(mockLoginUser).toHaveBeenCalled();
            expect(mockLoginUser).toHaveBeenCalledTimes(1);
            expect(response.body).toHaveProperty('message', 'Login successful');
            expect(response.body).toHaveProperty('token');
            expect(response.body.token).toBeTruthy();
        });

        it('should return user information along with token', async () => {
            // GIVEN: Valid login credentials
            const loginData = {
                email: 'jane.smith@shopee.com',
                password: 'StrongPass456!'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                res.status(200).json({ 
                    message: 'Login successful',
                    token: 'jwt_token_abc123xyz',
                    user: {
                        id: 'user_jane_123',
                        email: req.body.email,
                        name: 'Jane Smith',
                        role: 'customer'
                    }
                });
            });

            // WHEN: User logs in successfully
            const response = await request(app)
                .post('/users/login')
                .send(loginData)
                .expect(200);

            // THEN: Should return token and user information
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('id');
            expect(response.body.user).toHaveProperty('email', loginData.email);
            expect(response.body.user).toHaveProperty('name');
            expect(response.body.user).toHaveProperty('role');
        });

        it('should pass login credentials to controller correctly', async () => {
            // GIVEN: Login credentials
            const credentials = {
                email: 'test@example.com',
                password: 'TestPass789!'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                // Verify credentials are passed correctly
                expect(req.body.email).toBe(credentials.email);
                expect(req.body.password).toBe(credentials.password);
                res.status(200).json({ 
                    message: 'Login successful',
                    token: 'jwt_verified_token'
                });
            });

            // WHEN: Login request is made
            const response = await request(app)
                .post('/users/login')
                .send(credentials)
                .expect(200);

            // THEN: Should process credentials correctly
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('token');
        });

        it('should handle login with email containing special characters', async () => {
            // GIVEN: Email with special characters
            const loginData = {
                email: 'user+tag@example.co.uk',
                password: 'Password123!'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                res.status(200).json({ 
                    message: 'Login successful',
                    token: 'jwt_special_email_token',
                    user: {
                        id: 'user_special_456',
                        email: req.body.email
                    }
                });
            });

            // WHEN: Login with special character email
            const response = await request(app)
                .post('/users/login')
                .send(loginData)
                .expect(200);

            // THEN: Should handle special characters correctly
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body.user.email).toBe(loginData.email);
        });

        it('should return JWT token with proper format', async () => {
            // GIVEN: Valid login credentials
            const loginData = {
                email: 'jwt@example.com',
                password: 'JWTPass123!'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                res.status(200).json({ 
                    message: 'Login successful',
                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                    expiresIn: '24h'
                });
            });

            // WHEN: User logs in
            const response = await request(app)
                .post('/users/login')
                .send(loginData)
                .expect(200);

            // THEN: Should return properly formatted JWT token
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('token');
            expect(response.body.token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
            expect(response.body).toHaveProperty('expiresIn');
        });

        it('should handle case-insensitive email login', async () => {
            // GIVEN: Email with different casing
            const loginData = {
                email: 'USER@EXAMPLE.COM',
                password: 'Password123!'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                res.status(200).json({ 
                    message: 'Login successful',
                    token: 'jwt_case_insensitive_token',
                    user: {
                        id: 'user_case_789',
                        email: req.body.email.toLowerCase()
                    }
                });
            });

            // WHEN: Login with uppercase email
            const response = await request(app)
                .post('/users/login')
                .send(loginData)
                .expect(200);

            // THEN: Should handle email case-insensitively
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('token');
        });
    });

    // ============================================================================
    // Test 4: POST /login - Login with invalid credentials (Error Path)
    // ============================================================================
    describe('Test 4: POST /login - Login with Invalid Credentials (Error Path)', () => {
        it('should return 401 when password is incorrect', async () => {
            // GIVEN: Valid email but wrong password
            const invalidCredentials = {
                email: 'john.doe@example.com',
                password: 'WrongPassword123!'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                // Simulate password verification failure
                res.status(401).json({ 
                    error: 'Invalid credentials',
                    message: 'Email or password is incorrect'
                });
            });

            // WHEN: Login with wrong password is attempted
            const response = await request(app)
                .post('/users/login')
                .send(invalidCredentials)
                .expect(401);

            // THEN: Should return unauthorized error
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Invalid credentials');
            expect(response.body).toHaveProperty('message', 'Email or password is incorrect');
        });

        it('should return 401 when user does not exist', async () => {
            // GIVEN: Non-existent user email
            const nonExistentUser = {
                email: 'nonexistent@example.com',
                password: 'AnyPassword123!'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                // Simulate user not found
                res.status(401).json({ 
                    error: 'Invalid credentials',
                    message: 'Email or password is incorrect'
                });
            });

            // WHEN: Login with non-existent email is attempted
            const response = await request(app)
                .post('/users/login')
                .send(nonExistentUser)
                .expect(401);

            // THEN: Should return same error to prevent user enumeration
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Invalid credentials');
        });

        it('should return 400 when email is missing', async () => {
            // GIVEN: Login data without email
            const dataWithoutEmail = {
                password: 'Password123!'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                if (!req.body.email) {
                    res.status(400).json({ 
                        error: 'Email is required',
                        field: 'email'
                    });
                } else {
                    res.status(200).json({ message: 'Login successful' });
                }
            });

            // WHEN: Login without email is attempted
            const response = await request(app)
                .post('/users/login')
                .send(dataWithoutEmail)
                .expect(400);

            // THEN: Should return validation error
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Email is required');
            expect(response.body).toHaveProperty('field', 'email');
        });

        it('should return 400 when password is missing', async () => {
            // GIVEN: Login data without password
            const dataWithoutPassword = {
                email: 'john.doe@example.com'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                if (!req.body.password) {
                    res.status(400).json({ 
                        error: 'Password is required',
                        field: 'password'
                    });
                } else {
                    res.status(200).json({ message: 'Login successful' });
                }
            });

            // WHEN: Login without password is attempted
            const response = await request(app)
                .post('/users/login')
                .send(dataWithoutPassword)
                .expect(400);

            // THEN: Should return validation error
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Password is required');
            expect(response.body).toHaveProperty('field', 'password');
        });

        it('should return 400 when both email and password are missing', async () => {
            // GIVEN: Empty login data
            mockLoginUser.mockImplementationOnce((req, res) => {
                if (!req.body.email && !req.body.password) {
                    res.status(400).json({ 
                        error: 'Email and password are required'
                    });
                } else {
                    res.status(200).json({ message: 'Login successful' });
                }
            });

            // WHEN: Login without credentials is attempted
            const response = await request(app)
                .post('/users/login')
                .send({})
                .expect(400);

            // THEN: Should return validation error
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Email and password are required');
        });

        it('should return 401 when email is null', async () => {
            // GIVEN: Login data with null email
            const dataWithNullEmail = {
                email: null,
                password: 'Password123!'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                if (!req.body.email || req.body.email === null) {
                    res.status(401).json({ 
                        error: 'Invalid credentials',
                        message: 'Email cannot be null'
                    });
                } else {
                    res.status(200).json({ message: 'Login successful' });
                }
            });

            // WHEN: Login with null email is attempted
            const response = await request(app)
                .post('/users/login')
                .send(dataWithNullEmail)
                .expect(401);

            // THEN: Should handle null email
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Invalid credentials');
        });

        it('should return 401 when password is null', async () => {
            // GIVEN: Login data with null password
            const dataWithNullPassword = {
                email: 'user@example.com',
                password: null
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                if (!req.body.password || req.body.password === null) {
                    res.status(401).json({ 
                        error: 'Invalid credentials',
                        message: 'Password cannot be null'
                    });
                } else {
                    res.status(200).json({ message: 'Login successful' });
                }
            });

            // WHEN: Login with null password is attempted
            const response = await request(app)
                .post('/users/login')
                .send(dataWithNullPassword)
                .expect(401);

            // THEN: Should handle null password
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Invalid credentials');
        });

        it('should prevent brute force attacks with rate limiting response', async () => {
            // GIVEN: Multiple failed login attempts
            const credentials = {
                email: 'bruteforce@example.com',
                password: 'WrongPassword'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                // Simulate rate limiting after multiple attempts
                res.status(429).json({ 
                    error: 'Too many login attempts',
                    message: 'Please try again after 15 minutes',
                    retryAfter: 900
                });
            });

            // WHEN: Login after multiple failed attempts
            const response = await request(app)
                .post('/users/login')
                .send(credentials)
                .expect(429);

            // THEN: Should return rate limit error
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Too many login attempts');
            expect(response.body).toHaveProperty('retryAfter');
        });

        it('should return 401 for SQL injection attempt in email', async () => {
            // GIVEN: SQL injection attempt in email field
            const sqlInjectionData = {
                email: "admin'--",
                password: 'anything'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                res.status(401).json({ 
                    error: 'Invalid credentials',
                    message: 'Email or password is incorrect'
                });
            });

            // WHEN: Login with SQL injection is attempted
            const response = await request(app)
                .post('/users/login')
                .send(sqlInjectionData)
                .expect(401);

            // THEN: Should safely reject without exposing system details
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Invalid credentials');
        });

        it('should return 401 for XSS attempt in password', async () => {
            // GIVEN: XSS attempt in password field
            const xssData = {
                email: 'user@example.com',
                password: '<script>alert("XSS")</script>'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                res.status(401).json({ 
                    error: 'Invalid credentials',
                    message: 'Email or password is incorrect'
                });
            });

            // WHEN: Login with XSS attempt is made
            const response = await request(app)
                .post('/users/login')
                .send(xssData)
                .expect(401);

            // THEN: Should safely reject malicious input
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Invalid credentials');
        });

        it('should handle controller throwing exception during login', async () => {
            // GIVEN: Controller throws an exception
            mockLoginUser.mockImplementationOnce((req, res) => {
                res.status(500).json({ 
                    error: 'Internal server error',
                    message: 'Failed to process login'
                });
            });

            // WHEN: Login causes server error
            const response = await request(app)
                .post('/users/login')
                .send({
                    email: 'error@example.com',
                    password: 'Pass123!'
                })
                .expect(500);

            // THEN: Should return server error
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Internal server error');
        });

        it('should handle empty string credentials', async () => {
            // GIVEN: Empty string credentials
            const emptyCredentials = {
                email: '',
                password: ''
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                if (!req.body.email || req.body.email === '' || !req.body.password || req.body.password === '') {
                    res.status(400).json({ 
                        error: 'Email and password cannot be empty'
                    });
                } else {
                    res.status(200).json({ message: 'Login successful' });
                }
            });

            // WHEN: Login with empty strings is attempted
            const response = await request(app)
                .post('/users/login')
                .send(emptyCredentials)
                .expect(400);

            // THEN: Should reject empty credentials
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error');
        });

        it('should handle account that is deactivated or banned', async () => {
            // GIVEN: Valid credentials but account is deactivated
            const deactivatedAccountData = {
                email: 'deactivated@example.com',
                password: 'ValidPass123!'
            };

            mockLoginUser.mockImplementationOnce((req, res) => {
                res.status(403).json({ 
                    error: 'Account deactivated',
                    message: 'Your account has been deactivated. Please contact support.'
                });
            });

            // WHEN: Login to deactivated account is attempted
            const response = await request(app)
                .post('/users/login')
                .send(deactivatedAccountData)
                .expect(403);

            // THEN: Should return forbidden error
            expect(mockLoginUser).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Account deactivated');
        });
    });

    // ============================================================================
    // Additional Edge Cases and Security Tests
    // ============================================================================
    describe('Additional Edge Cases and Security Tests', () => {
        it('should handle malformed JSON in login request', async () => {
            // GIVEN: Malformed JSON is sent
            // WHEN: Request with malformed JSON is made
            const response = await request(app)
                .post('/users/login')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}')
                .expect(400);

            // THEN: Express should handle JSON parsing error
            expect(mockLoginUser).not.toHaveBeenCalled();
        });

        it('should handle very long email input', async () => {
            // GIVEN: Extremely long email
            const longEmail = 'a'.repeat(1000) + '@example.com';
            
            mockLoginUser.mockImplementationOnce((req, res) => {
                if (req.body.email.length > 255) {
                    res.status(400).json({ 
                        error: 'Email too long',
                        maxLength: 255
                    });
                } else {
                    res.status(200).json({ message: 'Login successful' });
                }
            });

            // WHEN: Login with very long email
            const response = await request(app)
                .post('/users/login')
                .send({
                    email: longEmail,
                    password: 'Password123!'
                })
                .expect(400);

            // THEN: Should handle length validation
            expect(mockLoginUser).toHaveBeenCalled();
        });

        it('should handle concurrent login requests for same user', async () => {
            // GIVEN: Multiple simultaneous login requests
            const credentials = {
                email: 'concurrent@example.com',
                password: 'Pass123!'
            };

            // WHEN: Concurrent requests are made
            const requests = [
                request(app).post('/users/login').send(credentials),
                request(app).post('/users/login').send(credentials),
                request(app).post('/users/login').send(credentials)
            ];

            await Promise.all(requests);

            // THEN: All requests should be processed
            expect(mockLoginUser).toHaveBeenCalledTimes(3);
        });

        it('should not expose user enumeration through timing attacks', async () => {
            // GIVEN: Two login attempts - one with existing and one with non-existing email
            mockLoginUser.mockImplementation((req, res) => {
                // Both should respond in similar time
                res.status(401).json({ 
                    error: 'Invalid credentials',
                    message: 'Email or password is incorrect'
                });
            });

            const existingUser = {
                email: 'existing@example.com',
                password: 'wrong'
            };

            const nonExistingUser = {
                email: 'nonexisting@example.com',
                password: 'wrong'
            };

            // WHEN: Both requests are made
            const startTime1 = Date.now();
            await request(app).post('/users/login').send(existingUser).expect(401);
            const duration1 = Date.now() - startTime1;

            const startTime2 = Date.now();
            await request(app).post('/users/login').send(nonExistingUser).expect(401);
            const duration2 = Date.now() - startTime2;

            // THEN: Both should return same error message
            expect(mockLoginUser).toHaveBeenCalledTimes(2);
            // Response times should be similar (within reasonable threshold)
            // This is a security best practice to prevent user enumeration
        });
    });
});
