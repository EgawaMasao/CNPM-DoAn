import { jest } from '@jest/globals';

// Mock jsonwebtoken before importing
const mockJwt = {
    verify: jest.fn()
};

jest.unstable_mockModule("jsonwebtoken", () => ({
    default: mockJwt
}));

// Import modules after mocking
const { protect, authorizeRoles } = await import("../../middleware/authMiddleware.js");

describe("authMiddleware", () => {
    let req, res, next;

    beforeEach(() => {
        // Setup common mocks for each test
        req = {
            header: jest.fn(),
            user: null
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
        
        // Setup environment variables
        process.env.JWT_SECRET = "test-secret-key";
        
        // Clear all mocks before each test
        jest.clearAllMocks();
        mockJwt.verify.mockReset();
    });

    describe("protect middleware", () => {
        // Test 1: No token provided
        it("should return 401 when no token is provided", () => {
            // GIVEN: No Authorization header is present
            req.header.mockReturnValue(undefined);

            // WHEN: protect middleware is called
            protect(req, res, next);

            // THEN: Should return 401 with appropriate error message
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ 
                message: "No token, authorization denied" 
            });
            expect(next).not.toHaveBeenCalled();
        });

        // Test 2: Invalid token format
        it("should return 401 when token verification fails", () => {
            // GIVEN: A malformed or expired token is provided
            req.header.mockReturnValue("Bearer invalid-token");
            mockJwt.verify.mockImplementation(() => {
                throw new Error("jwt malformed");
            });

            // WHEN: protect middleware is called
            protect(req, res, next);

            // THEN: Should catch the error and return 401
            expect(mockJwt.verify).toHaveBeenCalledWith("invalid-token", "test-secret-key");
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
            expect(next).not.toHaveBeenCalled();
        });

        // Test 3: Valid token with role
        it("should attach decoded user to request and call next when token is valid", () => {
            // GIVEN: A valid token with role is provided
            const mockDecodedToken = {
                userId: "12345",
                email: "user@example.com",
                role: "customer"
            };
            req.header.mockReturnValue("Bearer valid-token");
            mockJwt.verify.mockReturnValue(mockDecodedToken);

            // WHEN: protect middleware is called
            protect(req, res, next);

            // THEN: Should verify token, attach user to request, and proceed
            expect(mockJwt.verify).toHaveBeenCalledWith("valid-token", "test-secret-key");
            expect(req.user).toEqual(mockDecodedToken);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });

        // Additional test: Token missing role property
        it("should return 401 when decoded token has no role", () => {
            // GIVEN: A valid token but without role property
            const mockDecodedToken = {
                userId: "12345",
                email: "user@example.com"
                // role is missing
            };
            req.header.mockReturnValue("Bearer token-without-role");
            mockJwt.verify.mockReturnValue(mockDecodedToken);

            // WHEN: protect middleware is called
            protect(req, res, next);

            // THEN: Should return 401 with role-specific error message
            expect(mockJwt.verify).toHaveBeenCalledWith("token-without-role", "test-secret-key");
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ 
                message: "Invalid token: Role not found" 
            });
            expect(next).not.toHaveBeenCalled();
        });

        // Null/edge case tests
        it("should handle null Authorization header gracefully", () => {
            // GIVEN: Authorization header is explicitly null
            req.header.mockReturnValue(null);

            // WHEN: protect middleware is called
            protect(req, res, next);

            // THEN: Should handle null and return 401
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ 
                message: "No token, authorization denied" 
            });
            expect(next).not.toHaveBeenCalled();
        });

        it("should handle Authorization header without Bearer prefix", () => {
            // GIVEN: Authorization header exists but malformed (no "Bearer ")
            req.header.mockReturnValue("InvalidFormat");

            // WHEN: protect middleware is called
            protect(req, res, next);

            // THEN: Should not extract token properly and return 401
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ 
                message: "No token, authorization denied" 
            });
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe("authorizeRoles middleware", () => {
        // Test 4: No user in request
        it("should return 403 when req.user is not set", () => {
            // GIVEN: protect middleware was not called first (no req.user)
            req.user = null;
            const middleware = authorizeRoles("admin", "customer");

            // WHEN: authorizeRoles middleware is called
            middleware(req, res, next);

            // THEN: Should return 403 access denied
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ 
                message: "Access denied: Role not found" 
            });
            expect(next).not.toHaveBeenCalled();
        });

        // Test 5: User role not authorized
        it("should return 403 when user role is not in allowed roles", () => {
            // GIVEN: User has a role but it's not in the allowed list
            req.user = {
                userId: "12345",
                email: "user@example.com",
                role: "customer"
            };
            const middleware = authorizeRoles("admin", "restaurantAdmin");

            // WHEN: authorizeRoles middleware is called
            middleware(req, res, next);

            // THEN: Should return 403 unauthorized role
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ 
                message: "Access denied: Unauthorized role" 
            });
            expect(next).not.toHaveBeenCalled();
        });

        // Test 6: User with authorized role
        it("should call next when user has an authorized role", () => {
            // GIVEN: User has a role that matches one of the allowed roles
            req.user = {
                userId: "12345",
                email: "admin@example.com",
                role: "admin"
            };
            const middleware = authorizeRoles("admin", "restaurantAdmin");

            // WHEN: authorizeRoles middleware is called
            middleware(req, res, next);

            // THEN: Should proceed to next middleware
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });

        // Additional edge case tests
        it("should return 403 when req.user exists but has no role property", () => {
            // GIVEN: User object exists but role property is missing
            req.user = {
                userId: "12345",
                email: "user@example.com"
                // role is missing
            };
            const middleware = authorizeRoles("admin");

            // WHEN: authorizeRoles middleware is called
            middleware(req, res, next);

            // THEN: Should return 403 role not found
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ 
                message: "Access denied: Role not found" 
            });
            expect(next).not.toHaveBeenCalled();
        });

        it("should handle single role authorization", () => {
            // GIVEN: Only one role is allowed and user has it
            req.user = {
                userId: "12345",
                email: "customer@example.com",
                role: "customer"
            };
            const middleware = authorizeRoles("customer");

            // WHEN: authorizeRoles middleware is called
            middleware(req, res, next);

            // THEN: Should proceed to next middleware
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it("should handle multiple roles and match the last one", () => {
            // GIVEN: Multiple roles allowed and user has the last one
            req.user = {
                userId: "12345",
                email: "delivery@example.com",
                role: "deliveryPersonnel"
            };
            const middleware = authorizeRoles("admin", "restaurantAdmin", "deliveryPersonnel");

            // WHEN: authorizeRoles middleware is called
            middleware(req, res, next);

            // THEN: Should proceed to next middleware
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it("should handle empty req.user object", () => {
            // GIVEN: req.user is an empty object
            req.user = {};
            const middleware = authorizeRoles("admin");

            // WHEN: authorizeRoles middleware is called
            middleware(req, res, next);

            // THEN: Should return 403 role not found
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ 
                message: "Access denied: Role not found" 
            });
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe("Integration scenarios", () => {
        it("should handle protect followed by authorizeRoles successfully", () => {
            // GIVEN: A valid token with customer role
            const mockDecodedToken = {
                userId: "12345",
                email: "customer@example.com",
                role: "customer"
            };
            req.header.mockReturnValue("Bearer valid-token");
            mockJwt.verify.mockReturnValue(mockDecodedToken);

            // WHEN: protect middleware is called first
            protect(req, res, next);

            // THEN: User should be attached and next called
            expect(req.user).toEqual(mockDecodedToken);
            expect(next).toHaveBeenCalled();

            // AND WHEN: authorizeRoles is called with matching role
            const authMiddleware = authorizeRoles("customer", "admin");
            jest.clearAllMocks(); // Clear previous next() call
            authMiddleware(req, res, next);

            // THEN: Should also proceed successfully
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it("should handle protect followed by authorizeRoles with role mismatch", () => {
            // GIVEN: A valid token with customer role
            const mockDecodedToken = {
                userId: "12345",
                email: "customer@example.com",
                role: "customer"
            };
            req.header.mockReturnValue("Bearer valid-token");
            mockJwt.verify.mockReturnValue(mockDecodedToken);

            // WHEN: protect middleware is called first
            protect(req, res, next);

            // THEN: User should be attached
            expect(req.user).toEqual(mockDecodedToken);

            // AND WHEN: authorizeRoles is called with non-matching roles
            const authMiddleware = authorizeRoles("admin", "restaurantAdmin");
            jest.clearAllMocks(); // Clear previous calls
            authMiddleware(req, res, next);

            // THEN: Should return 403 unauthorized
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ 
                message: "Access denied: Unauthorized role" 
            });
            expect(next).not.toHaveBeenCalled();
        });
    });
});
