import { jest } from '@jest/globals';

// Create mock for jwt module
const mockJwtVerify = jest.fn();

// Mock the jsonwebtoken module BEFORE importing authMiddleware
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: mockJwtVerify
  }
}));

// Now import authMiddleware after mocking
const { default: authMiddleware } = await import('../src/middleware/authMiddleware.js');

describe('AuthMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      header: jest.fn(),
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    mockJwtVerify.mockReset();
  });

  // Test 1: No Authorization header - validates authorization denied path (null_pointer_risk)
  test('should return 401 when no Authorization header is provided', () => {
    // GIVEN no Authorization header in request
    req.header.mockReturnValue(null);

    // WHEN authMiddleware is called
    authMiddleware(req, res, next);

    // THEN should return 401 with authorization denied message
    expect(req.header).toHaveBeenCalledWith('Authorization');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token, authorization denied' });
    expect(next).not.toHaveBeenCalled();
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  // Test 2: Authorization header without 'Bearer ' prefix - validates malformed header handling (null_pointer_risk)
  test('should return 401 when Authorization header does not start with Bearer', () => {
    // GIVEN an Authorization header without Bearer prefix
    req.header.mockReturnValue('InvalidToken12345');

    // WHEN authMiddleware is called
    authMiddleware(req, res, next);

    // THEN should return 401 with authorization denied message
    expect(req.header).toHaveBeenCalledWith('Authorization');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token, authorization denied' });
    expect(next).not.toHaveBeenCalled();
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  // Test 3: Valid Bearer token - verifies successful authentication with user.id and user.role
  test('should authenticate successfully with valid Bearer token and set user with id and role', () => {
    // GIVEN a valid Bearer token with user id and role
    const mockToken = 'valid.jwt.token.here';
    const mockDecoded = { id: 'user123', role: 'admin', email: 'admin@example.com' };
    process.env.JWT_SECRET = 'test-secret';
    req.header.mockReturnValue(`Bearer ${mockToken}`);
    mockJwtVerify.mockReturnValue(mockDecoded);

    // WHEN authMiddleware is called
    authMiddleware(req, res, next);

    // THEN should verify token, set req.user with id and role, and call next
    expect(req.header).toHaveBeenCalledWith('Authorization');
    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, 'test-secret');
    expect(req.user).toEqual({
      id: 'user123',
      role: 'admin'
    });
    expect(req.user.id).toBe(mockDecoded.id);
    expect(req.user.role).toBe(mockDecoded.role);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  // Test 4: Invalid token signature - tests jwt.verify() exception handling (methods_that_can_throw)
  test('should return 401 when token has invalid signature', () => {
    // GIVEN a Bearer token with invalid signature
    const mockToken = 'invalid.signature.token';
    process.env.JWT_SECRET = 'test-secret';
    req.header.mockReturnValue(`Bearer ${mockToken}`);
    mockJwtVerify.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    // WHEN authMiddleware is called
    authMiddleware(req, res, next);

    // THEN should catch error and return 401 with Invalid token message
    expect(req.header).toHaveBeenCalledWith('Authorization');
    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, 'test-secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  // Test 5: Expired Bearer token - ensures expired JWT throws proper 401 error
  test('should return 401 when Bearer token is expired', () => {
    // GIVEN an expired Bearer token
    const mockToken = 'expired.jwt.token';
    process.env.JWT_SECRET = 'test-secret';
    req.header.mockReturnValue(`Bearer ${mockToken}`);
    mockJwtVerify.mockImplementation(() => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      throw error;
    });

    // WHEN authMiddleware is called
    authMiddleware(req, res, next);

    // THEN should catch TokenExpiredError and return 401
    expect(req.header).toHaveBeenCalledWith('Authorization');
    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, 'test-secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  // Test 6: Malformed Bearer token - tests jwt.verify() with corrupted token string
  test('should return 401 when Bearer token is malformed', () => {
    // GIVEN a malformed Bearer token string
    const mockToken = 'malformed-token-without-proper-jwt-structure';
    process.env.JWT_SECRET = 'test-secret';
    req.header.mockReturnValue(`Bearer ${mockToken}`);
    mockJwtVerify.mockImplementation(() => {
      const error = new Error('jwt malformed');
      error.name = 'JsonWebTokenError';
      throw error;
    });

    // WHEN authMiddleware is called
    authMiddleware(req, res, next);

    // THEN should catch JsonWebTokenError and return 401
    expect(req.header).toHaveBeenCalledWith('Authorization');
    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, 'test-secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  // Test 7: Empty Bearer token (Bearer with space only) - validates token extraction edge case (null_pointer_risk)
  test('should return 401 when Bearer token is empty or only whitespace', () => {
    // GIVEN a Bearer header with empty token after split
    const mockToken = '';
    process.env.JWT_SECRET = 'test-secret';
    req.header.mockReturnValue('Bearer ');
    mockJwtVerify.mockImplementation(() => {
      throw new Error('jwt must be provided');
    });

    // WHEN authMiddleware is called
    authMiddleware(req, res, next);

    // THEN should attempt to verify and catch error
    expect(req.header).toHaveBeenCalledWith('Authorization');
    expect(mockJwtVerify).toHaveBeenCalledWith('', 'test-secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  // Test 8: Missing JWT_SECRET - tests behavior when environment variable is undefined
  test('should handle missing JWT_SECRET gracefully', () => {
    // GIVEN a valid Bearer token but JWT_SECRET is undefined
    const mockToken = 'valid.jwt.token';
    req.header.mockReturnValue(`Bearer ${mockToken}`);
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    mockJwtVerify.mockImplementation(() => {
      throw new Error('secretOrPrivateKey must have a value');
    });

    // WHEN authMiddleware is called
    authMiddleware(req, res, next);

    // THEN should catch error and return 401
    expect(req.header).toHaveBeenCalledWith('Authorization');
    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();

    // Cleanup
    if (originalSecret) {
      process.env.JWT_SECRET = originalSecret;
    }
  });
});
