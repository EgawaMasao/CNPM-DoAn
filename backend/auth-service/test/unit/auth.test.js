// backend/auth-service/test/unit/auth.test.js
const jwt = require('jsonwebtoken');
const Customer = require('../../models/Customer');
const { protect } = require('../../middlewares/auth');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../models/Customer');

describe('Auth Middleware Unit Tests - Shopee QA Standards', () => {
    let req, res, next;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Setup mock request object
        req = {
            headers: {},
            userId: null,
            userRole: null
        };

        // Setup mock response object
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        // Setup mock next function
        next = jest.fn();

        // Setup default environment variables
        process.env.JWT_SECRET = 'test-secret-key-for-jwt';
    });

    afterEach(() => {
        // Clear console.error mock to prevent interference
        jest.restoreAllMocks();
    });

    // ============================================================================
    // Test 1: protect() - Valid token with existing user (Happy Path)
    // ============================================================================
    describe('Test 1: protect() - Validates Core Authentication Flow with Valid Token and Existing User', () => {
        it('should authenticate successfully with valid Bearer token and existing user', async () => {
            // GIVEN: Valid Bearer token in authorization header
            req.headers.authorization = 'Bearer valid-jwt-token-xyz';

            const mockDecoded = {
                id: 'customer-id-123',
                role: 'customer',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockCustomer = {
                _id: 'customer-id-123',
                firstName: 'Alice',
                lastName: 'Johnson',
                email: 'alice@customer.com',
                phone: '+1234567890'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockCustomer);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should verify token, check user exists, populate req object, and call next()
            expect(jwt.verify).toHaveBeenCalledWith('valid-jwt-token-xyz', 'test-secret-key-for-jwt');
            expect(Customer.findById).toHaveBeenCalledWith('customer-id-123');
            expect(req.userId).toBe('customer-id-123');
            expect(req.userRole).toBe('customer');
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });

        it('should handle token with admin role', async () => {
            // GIVEN: Valid Bearer token with admin role
            req.headers.authorization = 'Bearer admin-token-abc';

            const mockDecoded = {
                id: 'admin-id-456',
                role: 'admin',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockAdmin = {
                _id: 'admin-id-456',
                firstName: 'Bob',
                lastName: 'Admin',
                email: 'bob@admin.com'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockAdmin);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should populate admin role correctly
            expect(req.userId).toBe('admin-id-456');
            expect(req.userRole).toBe('admin');
            expect(next).toHaveBeenCalled();
        });

        it('should handle token with delivery personnel role', async () => {
            // GIVEN: Valid Bearer token with delivery role
            req.headers.authorization = 'Bearer delivery-token-def';

            const mockDecoded = {
                id: 'delivery-id-789',
                role: 'delivery_personnel',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockDelivery = {
                _id: 'delivery-id-789',
                firstName: 'Charlie',
                lastName: 'Driver',
                email: 'charlie@delivery.com'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockDelivery);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should populate delivery role correctly
            expect(req.userId).toBe('delivery-id-789');
            expect(req.userRole).toBe('delivery_personnel');
            expect(next).toHaveBeenCalled();
        });

        it('should extract token correctly from Bearer scheme', async () => {
            // GIVEN: Bearer token with multiple spaces
            req.headers.authorization = 'Bearer token-with-special-chars-123!@#';

            const mockDecoded = {
                id: 'user-special-id',
                role: 'customer',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockUser = {
                _id: 'user-special-id',
                email: 'special@customer.com'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockUser);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should extract and verify token correctly
            expect(jwt.verify).toHaveBeenCalledWith('token-with-special-chars-123!@#', 'test-secret-key-for-jwt');
            expect(next).toHaveBeenCalled();
        });

        it('should use JWT_SECRET from environment variables', async () => {
            // GIVEN: Valid Bearer token and JWT_SECRET in env
            process.env.JWT_SECRET = 'production-secret-key-xyz';
            req.headers.authorization = 'Bearer production-token';

            const mockDecoded = {
                id: 'prod-user-id',
                role: 'customer',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockUser = {
                _id: 'prod-user-id',
                email: 'prod@customer.com'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockUser);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should use JWT_SECRET from environment
            expect(jwt.verify).toHaveBeenCalledWith('production-token', 'production-secret-key-xyz');
            expect(next).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 2: protect() - Missing authorization header (Error Path)
    // ============================================================================
    describe('Test 2: protect() - Missing Authorization Header Entirely (Null Pointer Risk #1)', () => {
        it('should return 401 when authorization header is completely missing', async () => {
            // GIVEN: Request without authorization header
            req.headers = {};

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 unauthorized error
            expect(jwt.verify).not.toHaveBeenCalled();
            expect(Customer.findById).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'You are not logged in. Please log in first.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when authorization header is undefined', async () => {
            // GIVEN: Request with undefined authorization header
            req.headers.authorization = undefined;

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 for null pointer risk
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'You are not logged in. Please log in first.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when authorization header is null', async () => {
            // GIVEN: Request with null authorization header
            req.headers.authorization = null;

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should handle null pointer risk safely
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'You are not logged in. Please log in first.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when authorization header is empty string', async () => {
            // GIVEN: Request with empty string authorization header
            req.headers.authorization = '';

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 error
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'You are not logged in. Please log in first.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should not populate req.userId or req.userRole when header missing', async () => {
            // GIVEN: Request without authorization header
            req.headers = {};

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should not set userId or userRole
            expect(req.userId).toBeNull();
            expect(req.userRole).toBeNull();
            expect(next).not.toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 3: protect() - Authorization header without 'Bearer ' prefix (Error Path)
    // ============================================================================
    describe('Test 3: protect() - Authorization Header Without Bearer Prefix (Null Pointer Risk #2)', () => {
        it('should return 401 when authorization header does not start with Bearer', async () => {
            // GIVEN: Authorization header without Bearer prefix
            req.headers.authorization = 'Basic some-token-xyz';

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 error
            expect(jwt.verify).not.toHaveBeenCalled();
            expect(Customer.findById).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'You are not logged in. Please log in first.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when authorization header is just the token without Bearer', async () => {
            // GIVEN: Authorization header with only token, no Bearer prefix
            req.headers.authorization = 'raw-token-without-bearer';

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 for malformed header
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'You are not logged in. Please log in first.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when Bearer keyword is lowercase', async () => {
            // GIVEN: Authorization header with lowercase bearer
            req.headers.authorization = 'bearer lowercase-token-xyz';

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 as it requires capital B Bearer
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'You are not logged in. Please log in first.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when authorization header has Bearer but no space', async () => {
            // GIVEN: Authorization header with Bearer but no space
            req.headers.authorization = 'Bearertoken-without-space';

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 for malformed format
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'You are not logged in. Please log in first.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when authorization header is Bearer with no token', async () => {
            // GIVEN: Authorization header with Bearer but no actual token
            req.headers.authorization = 'Bearer ';

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 for missing token
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'You are not logged in. Please log in first.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when authorization header has extra whitespace', async () => {
            // GIVEN: Authorization header with only Bearer and whitespace
            req.headers.authorization = 'Bearer    ';

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 for empty token
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'You are not logged in. Please log in first.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should handle Digest authentication scheme', async () => {
            // GIVEN: Authorization header with Digest scheme
            req.headers.authorization = 'Digest username="user", realm="realm"';

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 for unsupported auth scheme
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });
    });

    // ============================================================================
    // Test 4: protect() - Invalid/malformed JWT token (Error Path)
    // ============================================================================
    describe('Test 4: protect() - Invalid/Malformed JWT Token (Critical Security Path)', () => {
        it('should return 401 when JWT token is malformed', async () => {
            // GIVEN: Bearer token with malformed JWT
            req.headers.authorization = 'Bearer malformed.jwt.token';
            
            const jwtError = new Error('jwt malformed');
            jwtError.name = 'JsonWebTokenError';
            jwt.verify.mockImplementation(() => {
                throw jwtError;
            });

            // Mock console.error to prevent test output pollution
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should catch jwt.verify exception and return 401
            expect(jwt.verify).toHaveBeenCalledWith('malformed.jwt.token', 'test-secret-key-for-jwt');
            expect(Customer.findById).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });
            expect(next).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(jwtError);

            consoleErrorSpy.mockRestore();
        });

        it('should return 401 when JWT token has invalid signature', async () => {
            // GIVEN: Bearer token with invalid signature
            req.headers.authorization = 'Bearer token.with.invalid.signature';
            
            const jwtError = new Error('invalid signature');
            jwtError.name = 'JsonWebTokenError';
            jwt.verify.mockImplementation(() => {
                throw jwtError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 for invalid signature
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });
            expect(next).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should return 401 when JWT token has invalid format', async () => {
            // GIVEN: Bearer token with completely invalid format
            req.headers.authorization = 'Bearer not-a-jwt-at-all';
            
            const jwtError = new Error('jwt must have 3 parts');
            jwtError.name = 'JsonWebTokenError';
            jwt.verify.mockImplementation(() => {
                throw jwtError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 for invalid format
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });
            expect(next).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should log error to console when JWT verification fails', async () => {
            // GIVEN: Bearer token that will fail verification
            req.headers.authorization = 'Bearer bad-token';
            
            const jwtError = new Error('invalid token');
            jwt.verify.mockImplementation(() => {
                throw jwtError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should log error to console
            expect(consoleErrorSpy).toHaveBeenCalledWith(jwtError);

            consoleErrorSpy.mockRestore();
        });

        it('should handle JWT token with wrong algorithm', async () => {
            // GIVEN: Bearer token signed with wrong algorithm
            req.headers.authorization = 'Bearer token-wrong-algorithm';
            
            const jwtError = new Error('invalid algorithm');
            jwtError.name = 'JsonWebTokenError';
            jwt.verify.mockImplementation(() => {
                throw jwtError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 for algorithm mismatch
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });

            consoleErrorSpy.mockRestore();
        });
    });

    // ============================================================================
    // Test 5: protect() - Expired JWT token (Error Path)
    // ============================================================================
    describe('Test 5: protect() - Expired JWT Token (High-Priority Security Requirement)', () => {
        it('should return 401 when JWT token is expired', async () => {
            // GIVEN: Bearer token that is expired
            req.headers.authorization = 'Bearer expired-jwt-token';
            
            const expiredError = new Error('jwt expired');
            expiredError.name = 'TokenExpiredError';
            expiredError.expiredAt = new Date('2025-01-01T00:00:00Z');
            jwt.verify.mockImplementation(() => {
                throw expiredError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should catch TokenExpiredError and return 401
            expect(jwt.verify).toHaveBeenCalledWith('expired-jwt-token', 'test-secret-key-for-jwt');
            expect(Customer.findById).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });
            expect(next).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(expiredError);

            consoleErrorSpy.mockRestore();
        });

        it('should handle expired token with expiration timestamp', async () => {
            // GIVEN: Bearer token expired with specific timestamp
            req.headers.authorization = 'Bearer token-expired-yesterday';
            
            const expiredError = new Error('jwt expired');
            expiredError.name = 'TokenExpiredError';
            expiredError.expiredAt = new Date('2025-11-08T12:00:00Z');
            jwt.verify.mockImplementation(() => {
                throw expiredError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should reject expired token regardless of timestamp
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });
            expect(next).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should not allow access with recently expired token', async () => {
            // GIVEN: Bearer token that just expired 1 second ago
            req.headers.authorization = 'Bearer just-expired-token';
            
            const recentExpiredError = new Error('jwt expired');
            recentExpiredError.name = 'TokenExpiredError';
            recentExpiredError.expiredAt = new Date(Date.now() - 1000); // 1 second ago
            jwt.verify.mockImplementation(() => {
                throw recentExpiredError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should reject even recently expired tokens
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });
            expect(Customer.findById).not.toHaveBeenCalled();
            expect(next).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should prevent req.userId population when token is expired', async () => {
            // GIVEN: Bearer token that is expired
            req.headers.authorization = 'Bearer expired-token-xyz';
            
            const expiredError = new Error('jwt expired');
            expiredError.name = 'TokenExpiredError';
            jwt.verify.mockImplementation(() => {
                throw expiredError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should not populate userId or userRole
            expect(req.userId).toBeNull();
            expect(req.userRole).toBeNull();
            expect(next).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should treat expired token same as invalid token in error message', async () => {
            // GIVEN: Two scenarios - one expired, one invalid
            req.headers.authorization = 'Bearer expired-token';
            
            const expiredError = new Error('jwt expired');
            expiredError.name = 'TokenExpiredError';
            jwt.verify.mockImplementation(() => {
                throw expiredError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called with expired token
            await protect(req, res, next);

            // THEN: Should return same error message as invalid token
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });

            // Reset for second scenario
            jest.clearAllMocks();
            req.headers.authorization = 'Bearer invalid-token';
            
            const invalidError = new Error('invalid token');
            invalidError.name = 'JsonWebTokenError';
            jwt.verify.mockImplementation(() => {
                throw invalidError;
            });

            // WHEN: protect middleware is called with invalid token
            await protect(req, res, next);

            // THEN: Should return same error message
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });

            consoleErrorSpy.mockRestore();
        });
    });

    // ============================================================================
    // Test 6: protect() - Valid token correctly populates req fields (Happy Path)
    // ============================================================================
    describe('Test 6: protect() - Valid Token Correctly Populates req.userId and req.userRole', () => {
        it('should populate req.userId with decoded user id', async () => {
            // GIVEN: Valid Bearer token
            req.headers.authorization = 'Bearer valid-token-123';

            const mockDecoded = {
                id: 'user-id-from-token',
                role: 'customer',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockUser = {
                _id: 'user-id-from-token',
                email: 'user@customer.com'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockUser);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should set req.userId to decoded id
            expect(req.userId).toBe('user-id-from-token');
            expect(req.userId).toBe(mockDecoded.id);
            expect(next).toHaveBeenCalled();
        });

        it('should populate req.userRole with decoded role', async () => {
            // GIVEN: Valid Bearer token with customer role
            req.headers.authorization = 'Bearer token-with-role';

            const mockDecoded = {
                id: 'role-test-user-id',
                role: 'customer',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockUser = {
                _id: 'role-test-user-id',
                email: 'role@customer.com'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockUser);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should set req.userRole to decoded role
            expect(req.userRole).toBe('customer');
            expect(req.userRole).toBe(mockDecoded.role);
            expect(next).toHaveBeenCalled();
        });

        it('should populate both req.userId and req.userRole before calling next', async () => {
            // GIVEN: Valid Bearer token
            req.headers.authorization = 'Bearer both-fields-token';

            const mockDecoded = {
                id: 'both-fields-user-id',
                role: 'admin',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockUser = {
                _id: 'both-fields-user-id',
                email: 'both@admin.com'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockUser);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should populate both fields before calling next
            expect(req.userId).toBe('both-fields-user-id');
            expect(req.userRole).toBe('admin');
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should make req.userId available to downstream middleware', async () => {
            // GIVEN: Valid Bearer token
            req.headers.authorization = 'Bearer downstream-token';

            const mockDecoded = {
                id: 'downstream-user-id',
                role: 'customer',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockUser = {
                _id: 'downstream-user-id',
                email: 'downstream@customer.com'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockUser);

            // Mock next function to verify req object state
            next = jest.fn(() => {
                // Verify that when next() is called, req has the fields
                expect(req.userId).toBe('downstream-user-id');
                expect(req.userRole).toBe('customer');
            });

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should have populated req before calling next
            expect(next).toHaveBeenCalled();
        });

        it('should handle restaurant_admin role in req.userRole', async () => {
            // GIVEN: Valid Bearer token with restaurant_admin role
            req.headers.authorization = 'Bearer restaurant-admin-token';

            const mockDecoded = {
                id: 'restaurant-admin-id',
                role: 'restaurant_admin',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockUser = {
                _id: 'restaurant-admin-id',
                email: 'admin@restaurant.com'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockUser);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should set req.userRole to restaurant_admin
            expect(req.userRole).toBe('restaurant_admin');
            expect(req.userId).toBe('restaurant-admin-id');
            expect(next).toHaveBeenCalled();
        });

        it('should not modify req object when authentication fails', async () => {
            // GIVEN: Request without authorization header
            req.headers = {};
            req.userId = null;
            req.userRole = null;

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should not modify req.userId or req.userRole
            expect(req.userId).toBeNull();
            expect(req.userRole).toBeNull();
            expect(next).not.toHaveBeenCalled();
        });

        it('should pass req with populated fields to next middleware chain', async () => {
            // GIVEN: Valid Bearer token
            req.headers.authorization = 'Bearer chain-token';

            const mockDecoded = {
                id: 'chain-user-id',
                role: 'delivery_personnel',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockUser = {
                _id: 'chain-user-id',
                email: 'chain@delivery.com'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockUser);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should call next with no arguments (successful)
            expect(next).toHaveBeenCalledWith();
            expect(next).toHaveBeenCalledTimes(1);
            expect(req.userId).toBe('chain-user-id');
            expect(req.userRole).toBe('delivery_personnel');
        });
    });

    // ============================================================================
    // Additional Edge Cases and Null Pointer Risks
    // ============================================================================
    describe('Additional Edge Cases - User Existence Check (Null Pointer Risk #3)', () => {
        it('should return 401 when valid token but user no longer exists in database', async () => {
            // GIVEN: Valid Bearer token but user deleted from database
            req.headers.authorization = 'Bearer valid-token-deleted-user';

            const mockDecoded = {
                id: 'deleted-user-id',
                role: 'customer',
                iat: 1699507200,
                exp: 1700112000
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(null); // User not found

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return 401 for non-existent user
            expect(jwt.verify).toHaveBeenCalledWith('valid-token-deleted-user', 'test-secret-key-for-jwt');
            expect(Customer.findById).toHaveBeenCalledWith('deleted-user-id');
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'The user belonging to this token no longer exists.'
            });
            expect(req.userId).toBeNull();
            expect(req.userRole).toBeNull();
            expect(next).not.toHaveBeenCalled();
        });

        it('should handle null user from database query', async () => {
            // GIVEN: Valid token but findById returns null
            req.headers.authorization = 'Bearer token-null-user';

            const mockDecoded = {
                id: 'null-user-id',
                role: 'customer',
                iat: 1699507200,
                exp: 1700112000
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(null);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should handle null pointer risk safely
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'The user belonging to this token no longer exists.'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should verify user existence before granting access', async () => {
            // GIVEN: Valid token but user undefined in database
            req.headers.authorization = 'Bearer token-undefined-user';

            const mockDecoded = {
                id: 'undefined-user-id',
                role: 'customer',
                iat: 1699507200,
                exp: 1700112000
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(undefined);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should reject undefined user
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('Additional Edge Cases - Database and System Errors (Null Pointer Risk #4)', () => {
        it('should handle database connection error when checking user existence', async () => {
            // GIVEN: Valid token but database query fails
            req.headers.authorization = 'Bearer token-db-error';

            const mockDecoded = {
                id: 'db-error-user-id',
                role: 'customer',
                iat: 1699507200,
                exp: 1700112000
            };

            const dbError = new Error('Database connection failed');
            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockRejectedValue(dbError);

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should catch database error and return 401
            expect(Customer.findById).toHaveBeenCalledWith('db-error-user-id');
            expect(consoleErrorSpy).toHaveBeenCalledWith(dbError);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });
            expect(next).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should handle missing JWT_SECRET environment variable', async () => {
            // GIVEN: Valid Bearer token but JWT_SECRET is undefined
            req.headers.authorization = 'Bearer token-no-secret';
            process.env.JWT_SECRET = undefined;

            const secretError = new Error('secretOrPrivateKey must have a value');
            jwt.verify.mockImplementation(() => {
                throw secretError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should handle null pointer risk for missing secret
            expect(consoleErrorSpy).toHaveBeenCalledWith(secretError);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });
            expect(next).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should handle null JWT_SECRET in environment', async () => {
            // GIVEN: Valid Bearer token but JWT_SECRET is null
            req.headers.authorization = 'Bearer token-null-secret';
            process.env.JWT_SECRET = null;

            const secretError = new Error('secretOrPrivateKey must have a value');
            jwt.verify.mockImplementation(() => {
                throw secretError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should handle null environment variable safely
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should handle empty string JWT_SECRET', async () => {
            // GIVEN: Valid Bearer token but JWT_SECRET is empty string
            req.headers.authorization = 'Bearer token-empty-secret';
            process.env.JWT_SECRET = '';

            const secretError = new Error('secretOrPrivateKey must have a value');
            jwt.verify.mockImplementation(() => {
                throw secretError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should handle empty secret safely
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Additional Exception and Security Tests', () => {
        it('should handle unexpected errors in try-catch block', async () => {
            // GIVEN: Valid Bearer token but unexpected error occurs
            req.headers.authorization = 'Bearer token-unexpected-error';

            const unexpectedError = new Error('Unexpected system error');
            jwt.verify.mockImplementation(() => {
                throw unexpectedError;
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should catch any error and return 401
            expect(consoleErrorSpy).toHaveBeenCalledWith(unexpectedError);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });
            expect(next).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should not expose sensitive error details in response', async () => {
            // GIVEN: Valid Bearer token but detailed error occurs
            req.headers.authorization = 'Bearer token-sensitive-error';

            const sensitiveError = new Error('Database: mongodb://admin:password123@localhost:27017 failed');
            jwt.verify.mockReturnValue({ id: 'test-id', role: 'customer' });
            Customer.findById.mockRejectedValue(sensitiveError);

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should return generic error message, not sensitive details
            expect(res.json).toHaveBeenCalledWith({
                message: 'Token is invalid or expired.'
            });
            expect(res.json).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('mongodb://')
                })
            );
            expect(res.json).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('password')
                })
            );

            consoleErrorSpy.mockRestore();
        });

        it('should maintain middleware chain integrity on success', async () => {
            // GIVEN: Valid Bearer token
            req.headers.authorization = 'Bearer integrity-test-token';

            const mockDecoded = {
                id: 'integrity-user-id',
                role: 'customer',
                iat: 1699507200,
                exp: 1700112000
            };

            const mockUser = {
                _id: 'integrity-user-id',
                email: 'integrity@customer.com'
            };

            jwt.verify.mockReturnValue(mockDecoded);
            Customer.findById.mockResolvedValue(mockUser);

            // WHEN: protect middleware is called
            await protect(req, res, next);

            // THEN: Should call next exactly once with no arguments
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });
    });
});
