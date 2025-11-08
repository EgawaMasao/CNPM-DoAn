import { jest } from '@jest/globals';

// Create mock for jwt module
const mockJwtVerify = jest.fn();

// Mock the jsonwebtoken module BEFORE importing auth
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: mockJwtVerify
  }
}));

// Now import auth after mocking
const { default: auth } = await import('../src/middleware/auth.js');

describe('Auth Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      header: jest.fn(),
      restaurant: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    mockJwtVerify.mockReset();
  });

  // Test 1: No token provided - validates authorization denied path (null_pointer_risk)
  test('should return 401 when no token is provided', () => {
    // GIVEN no token in request header
    req.header.mockReturnValue(null);

    // WHEN auth middleware is called
    auth(req, res, next);

    // THEN should return 401 with authorization denied message
    expect(req.header).toHaveBeenCalledWith('x-auth-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token, authorization denied' });
    expect(next).not.toHaveBeenCalled();
  });

  // Test 2: Valid token - verifies successful authentication flow with decoded user
  test('should authenticate successfully with valid token', () => {
    // GIVEN a valid token and JWT_SECRET
    const mockToken = 'valid.jwt.token';
    const mockDecoded = { id: 'restaurant123', role: 'admin' };
    process.env.JWT_SECRET = 'test-secret';
    req.header.mockReturnValue(mockToken);
    mockJwtVerify.mockReturnValue(mockDecoded);

    // WHEN auth middleware is called
    auth(req, res, next);

    // THEN should verify token and call next
    expect(req.header).toHaveBeenCalledWith('x-auth-token');
    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, 'test-secret');
    expect(req.restaurant).toBe('restaurant123');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  // Test 3: Invalid token signature - tests jwt.verify() exception handling (methods_that_can_throw)
  test('should return 401 when token has invalid signature', () => {
    // GIVEN a token with invalid signature
    const mockToken = 'invalid.signature.token';
    process.env.JWT_SECRET = 'test-secret';
    req.header.mockReturnValue(mockToken);
    mockJwtVerify.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    // WHEN auth middleware is called
    auth(req, res, next);

    // THEN should catch error and return 401
    expect(req.header).toHaveBeenCalledWith('x-auth-token');
    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, 'test-secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token is not valid' });
    expect(next).not.toHaveBeenCalled();
  });

  // Test 4: Expired token - ensures expired JWT throws proper 401 error
  test('should return 401 when token is expired', () => {
    // GIVEN an expired token
    const mockToken = 'expired.jwt.token';
    process.env.JWT_SECRET = 'test-secret';
    req.header.mockReturnValue(mockToken);
    mockJwtVerify.mockImplementation(() => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      throw error;
    });

    // WHEN auth middleware is called
    auth(req, res, next);

    // THEN should catch TokenExpiredError and return 401
    expect(req.header).toHaveBeenCalledWith('x-auth-token');
    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, 'test-secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token is not valid' });
    expect(next).not.toHaveBeenCalled();
  });

  // Test 5: Malformed token - tests jwt.verify() with corrupted token string
  test('should return 401 when token is malformed', () => {
    // GIVEN a malformed token string
    const mockToken = 'malformed-token-without-proper-structure';
    process.env.JWT_SECRET = 'test-secret';
    req.header.mockReturnValue(mockToken);
    mockJwtVerify.mockImplementation(() => {
      const error = new Error('jwt malformed');
      error.name = 'JsonWebTokenError';
      throw error;
    });

    // WHEN auth middleware is called
    auth(req, res, next);

    // THEN should catch JsonWebTokenError and return 401
    expect(req.header).toHaveBeenCalledWith('x-auth-token');
    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, 'test-secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token is not valid' });
    expect(next).not.toHaveBeenCalled();
  });

  // Test 6: Empty string token - validates empty token handling (null_pointer_risk)
  test('should return 401 when token is empty string', () => {
    // GIVEN an empty string token
    req.header.mockReturnValue('');

    // WHEN auth middleware is called
    auth(req, res, next);

    // THEN should return 401 with authorization denied message
    expect(req.header).toHaveBeenCalledWith('x-auth-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token, authorization denied' });
    expect(next).not.toHaveBeenCalled();
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  // Test 7: Valid token sets req.restaurant - confirms middleware attaches decoded.id correctly
  test('should set req.restaurant with decoded id from valid token', () => {
    // GIVEN a valid token with specific restaurant id
    const mockToken = 'valid.jwt.token';
    const mockRestaurantId = 'restaurant-abc-123';
    const mockDecoded = { id: mockRestaurantId, name: 'Test Restaurant' };
    process.env.JWT_SECRET = 'test-secret';
    req.header.mockReturnValue(mockToken);
    mockJwtVerify.mockReturnValue(mockDecoded);

    // WHEN auth middleware is called
    auth(req, res, next);

    // THEN should set req.restaurant to decoded.id
    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, 'test-secret');
    expect(req.restaurant).toBe(mockRestaurantId);
    expect(req.restaurant).toBe(mockDecoded.id);
    expect(next).toHaveBeenCalled();
  });

  // Test 8: Missing JWT_SECRET - tests behavior when environment variable is undefined
  test('should handle missing JWT_SECRET gracefully', () => {
    // GIVEN a valid token but JWT_SECRET is undefined
    const mockToken = 'valid.jwt.token';
    req.header.mockReturnValue(mockToken);
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    mockJwtVerify.mockImplementation(() => {
      throw new Error('secretOrPrivateKey must have a value');
    });

    // WHEN auth middleware is called
    auth(req, res, next);

    // THEN should catch error and return 401
    expect(req.header).toHaveBeenCalledWith('x-auth-token');
    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token is not valid' });
    expect(next).not.toHaveBeenCalled();

    // Cleanup
    if (originalSecret) {
      process.env.JWT_SECRET = originalSecret;
    }
  });
});
