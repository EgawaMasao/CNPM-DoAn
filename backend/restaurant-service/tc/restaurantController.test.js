import { jest } from '@jest/globals';

// Create mock functions
const mockFindOne = jest.fn();
const mockCompare = jest.fn();
const mockSign = jest.fn();

// Mock modules before imports
jest.unstable_mockModule('bcryptjs', () => ({
  default: {
    compare: mockCompare
  }
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    sign: mockSign
  }
}));

jest.unstable_mockModule('../src/models/Restaurant.js', () => ({
  default: {
    findOne: mockFindOne
  }
}));

// Import after mocking
const { loginRestaurant } = await import('../src/controllers/restaurantController.js');

describe('restaurantController - loginRestaurant', () => {
  let req;
  let res;
  let jsonMock;
  let statusMock;

  beforeEach(() => {
    // Setup request and response mocks
    req = {
      body: {}
    };

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = {
      json: jsonMock,
      status: statusMock
    };

    // Clear all mocks before each test
    mockFindOne.mockClear();
    mockCompare.mockClear();
    mockSign.mockClear();
    jsonMock.mockClear();
    statusMock.mockClear();

    // Set up environment variable
    process.env.JWT_SECRET = 'test-secret-key';

    // Mock console.error to avoid cluttering test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  // Test 1: Happy path - successful login
  test('1 | loginRestaurant | happy | Verify successful login returns JWT token when valid credentials provided', async () => {
    // GIVEN: Valid email and password in request body
    req.body = {
      email: 'admin@restaurant.com',
      password: 'password123'
    };

    const mockRestaurant = {
      _id: 'restaurant123',
      admin: {
        email: 'admin@restaurant.com',
        password: '$2a$10$hashedpassword'
      }
    };

    const mockToken = 'jwt.token.here';

    mockFindOne.mockResolvedValue(mockRestaurant);
    mockCompare.mockResolvedValue(true);
    mockSign.mockReturnValue(mockToken);

    // WHEN: loginRestaurant is called
    await loginRestaurant(req, res);

    // THEN: Should return JWT token
    expect(mockFindOne).toHaveBeenCalledWith({ 'admin.email': 'admin@restaurant.com' });
    expect(mockCompare).toHaveBeenCalledWith('password123', '$2a$10$hashedpassword');
    expect(mockSign).toHaveBeenCalledWith(
      { restaurantId: 'restaurant123', email: 'admin@restaurant.com' },
      'test-secret-key',
      { expiresIn: '30d' }
    );
    expect(res.json).toHaveBeenCalledWith({ token: mockToken });
    expect(res.status).not.toHaveBeenCalled();
  });

  // Test 2: Error - invalid email
  test('2 | loginRestaurant | error | Test invalid email returns 400 with "Invalid email or password" message', async () => {
    // GIVEN: Invalid email that doesn't exist in database
    req.body = {
      email: 'nonexistent@restaurant.com',
      password: 'password123'
    };

    mockFindOne.mockResolvedValue(null);

    // WHEN: loginRestaurant is called
    await loginRestaurant(req, res);

    // THEN: Should return 400 error with appropriate message
    expect(mockFindOne).toHaveBeenCalledWith({ 'admin.email': 'nonexistent@restaurant.com' });
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockSign).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Invalid email or password' });
  });

  // Test 3: Error - invalid password
  test('3 | loginRestaurant | error | Test invalid password returns 400 with "Invalid email or password" message', async () => {
    // GIVEN: Valid email but incorrect password
    req.body = {
      email: 'admin@restaurant.com',
      password: 'wrongpassword'
    };

    const mockRestaurant = {
      _id: 'restaurant123',
      admin: {
        email: 'admin@restaurant.com',
        password: '$2a$10$hashedpassword'
      }
    };

    mockFindOne.mockResolvedValue(mockRestaurant);
    mockCompare.mockResolvedValue(false);

    // WHEN: loginRestaurant is called
    await loginRestaurant(req, res);

    // THEN: Should return 400 error with appropriate message
    expect(mockFindOne).toHaveBeenCalledWith({ 'admin.email': 'admin@restaurant.com' });
    expect(mockCompare).toHaveBeenCalledWith('wrongpassword', '$2a$10$hashedpassword');
    expect(mockSign).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Invalid email or password' });
  });

  // Test 4: Error - server error (database failure)
  test('4 | loginRestaurant | error | Test server error (database failure) returns 500 with "Server Error" message', async () => {
    // GIVEN: Database query throws an error
    req.body = {
      email: 'admin@restaurant.com',
      password: 'password123'
    };

    const dbError = new Error('Database connection failed');
    mockFindOne.mockRejectedValue(dbError);

    // WHEN: loginRestaurant is called
    await loginRestaurant(req, res);

    // THEN: Should return 500 error with "Server Error" message
    expect(mockFindOne).toHaveBeenCalledWith({ 'admin.email': 'admin@restaurant.com' });
    expect(console.error).toHaveBeenCalledWith(dbError);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Server Error' });
  });

  // Test 5: Edge - missing email field
  test('5 | loginRestaurant | edge | Test missing email field in request body handles gracefully', async () => {
    // GIVEN: Request body with missing email field
    req.body = {
      password: 'password123'
    };

    mockFindOne.mockResolvedValue(null);

    // WHEN: loginRestaurant is called
    await loginRestaurant(req, res);

    // THEN: Should query with undefined email and return 400 error
    expect(mockFindOne).toHaveBeenCalledWith({ 'admin.email': undefined });
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Invalid email or password' });
  });

  // Test 6: Edge - missing password field
  test('6 | loginRestaurant | edge | Test missing password field in request body handles gracefully', async () => {
    // GIVEN: Request body with missing password field
    req.body = {
      email: 'admin@restaurant.com'
    };

    const mockRestaurant = {
      _id: 'restaurant123',
      admin: {
        email: 'admin@restaurant.com',
        password: '$2a$10$hashedpassword'
      }
    };

    mockFindOne.mockResolvedValue(mockRestaurant);
    mockCompare.mockResolvedValue(false);

    // WHEN: loginRestaurant is called
    await loginRestaurant(req, res);

    // THEN: Should attempt to compare undefined password and fail
    expect(mockFindOne).toHaveBeenCalledWith({ 'admin.email': 'admin@restaurant.com' });
    expect(mockCompare).toHaveBeenCalledWith(undefined, '$2a$10$hashedpassword');
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Invalid email or password' });
  });

  // Test 7: Happy path - verify JWT token payload
  test('7 | loginRestaurant | happy | Verify JWT token contains correct restaurantId and email in payload', async () => {
    // GIVEN: Valid credentials and specific restaurant data
    req.body = {
      email: 'test@restaurant.com',
      password: 'testpass'
    };

    const mockRestaurant = {
      _id: 'specific-restaurant-id-456',
      admin: {
        email: 'test@restaurant.com',
        password: '$2a$10$specifichashedpassword'
      }
    };

    const mockToken = 'specific.jwt.token';

    mockFindOne.mockResolvedValue(mockRestaurant);
    mockCompare.mockResolvedValue(true);
    mockSign.mockReturnValue(mockToken);

    // WHEN: loginRestaurant is called
    await loginRestaurant(req, res);

    // THEN: JWT token should be generated with correct payload
    expect(mockSign).toHaveBeenCalledWith(
      { 
        restaurantId: 'specific-restaurant-id-456', 
        email: 'test@restaurant.com' 
      },
      'test-secret-key',
      { expiresIn: '30d' }
    );
    expect(res.json).toHaveBeenCalledWith({ token: mockToken });
  });

  // Test 8: Edge - null/undefined restaurant from database
  test('8 | loginRestaurant | edge | Test null/undefined restaurant from database query returns appropriate error', async () => {
    // GIVEN: Database returns undefined instead of null
    req.body = {
      email: 'admin@restaurant.com',
      password: 'password123'
    };

    mockFindOne.mockResolvedValue(undefined);

    // WHEN: loginRestaurant is called
    await loginRestaurant(req, res);

    // THEN: Should handle undefined restaurant and return 400 error
    expect(mockFindOne).toHaveBeenCalledWith({ 'admin.email': 'admin@restaurant.com' });
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockSign).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Invalid email or password' });
  });
});
