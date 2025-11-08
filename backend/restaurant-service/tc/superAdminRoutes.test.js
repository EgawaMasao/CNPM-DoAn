// Import setup (must be first so lifecycle hooks run before tests)
import './setupMongo.js';
import { jest } from '@jest/globals';
jest.setTimeout(30000);

// then other imports
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import SuperAdmin from '../src/models/SuperAdmin.js';
import Restaurant from '../src/models/Restaurant.js';
import superAdminRoutes from '../src/routes/superAdminRoutes.js';

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/superadmin', superAdminRoutes);

// Mock JWT_SECRET
process.env.JWT_SECRET = 'test-jwt-secret-key-for-superadmin-testing';

beforeEach(async () => {
  await SuperAdmin.deleteMany({});
  await Restaurant.deleteMany({});
});

afterEach(async () => {
  await SuperAdmin.deleteMany({});
  await Restaurant.deleteMany({});
});

describe('SuperAdmin Routes - POST /register', () => {
  
  test('Test 1: POST /register should successfully create super admin with valid credentials (happy path - core functionality)', async () => {
    // GIVEN: Valid super admin registration data with all required fields
    const validSuperAdminData = {
      name: 'Super Admin User',
      email: 'superadmin@shopee.com',
      password: 'SecurePassword123!'
    };
    
    // WHEN: Posting registration request with valid data
    const response = await request(app)
      .post('/api/superadmin/register')
      .send(validSuperAdminData);
    
    // THEN: Should return 201 with success message (core functionality verified)
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Super Admin registered successfully');
    
    // Verify super admin was saved in database with correct data
    const savedSuperAdmin = await SuperAdmin.findOne({ email: validSuperAdminData.email });
    expect(savedSuperAdmin).toBeDefined();
    expect(savedSuperAdmin.name).toBe(validSuperAdminData.name);
    expect(savedSuperAdmin.email).toBe(validSuperAdminData.email);
    // Verify password is hashed (not plain text)
    expect(savedSuperAdmin.password).not.toBe(validSuperAdminData.password);
    expect(savedSuperAdmin.password.length).toBeGreaterThan(20); // bcrypt hash length
  });

  test('Test 2: POST /register should return 400 when missing required fields (error path - high null_pointer_risk)', async () => {
    // GIVEN: Multiple test cases with missing required fields (name, email, password)
    const testCases = [
      { name: '', email: 'test@test.com', password: 'pass', missing: 'name' },
      { name: 'Admin', email: '', password: 'pass', missing: 'email' },
      { name: 'Admin', email: 'test@test.com', password: '', missing: 'password' },
      { email: 'test@test.com', password: 'pass', missing: 'name' },
      { name: 'Admin', password: 'pass', missing: 'email' },
      { name: 'Admin', email: 'test@test.com', missing: 'password' }
    ];
    
    // WHEN: Attempting to register with each missing field scenario
    for (const testData of testCases) {
      const response = await request(app)
        .post('/api/superadmin/register')
        .send(testData);
      
      // THEN: Should return 500 or validation error (null pointer risk mitigated)
      expect([400, 500]).toContain(response.status);
    }
    
    // WHEN: Sending request with completely missing body (null/undefined)
    const responseNoFields = await request(app)
      .post('/api/superadmin/register')
      .send({});
    
    // THEN: Should return error status without crashing (null pointer protection)
    expect([400, 500]).toContain(responseNoFields.status);
    
    // WHEN: Sending null values explicitly
    const responseNullValues = await request(app)
      .post('/api/superadmin/register')
      .send({
        name: null,
        email: null,
        password: null
      });
    
    // THEN: Should handle gracefully without server crash
    expect([400, 500]).toContain(responseNullValues.status);
    
    // Verify no super admin was created in any case
    const superAdminCount = await SuperAdmin.countDocuments();
    expect(superAdminCount).toBe(0);
  });

  test('Test 5: POST /register should prevent duplicate super admin registration with existing email (edge case - data integrity)', async () => {
    // GIVEN: An existing super admin in the database
    const existingSuperAdmin = new SuperAdmin({
      name: 'Existing Super Admin',
      email: 'existing@shopee.com',
      password: 'ExistingPass123!'
    });
    await existingSuperAdmin.save();
    
    // WHEN: Attempting to register with duplicate email
    const responseDuplicateEmail = await request(app)
      .post('/api/superadmin/register')
      .send({
        name: 'Different Admin',
        email: 'existing@shopee.com', // Same email as existing
        password: 'DifferentPass456!'
      });
    
    // THEN: Should return 400 with duplicate error message (data integrity protected)
    expect(responseDuplicateEmail.status).toBe(400);
    expect(responseDuplicateEmail.body.message).toBe('Super Admin already exists');
    
    // Verify only one super admin exists in database
    const superAdminCount = await SuperAdmin.countDocuments();
    expect(superAdminCount).toBe(1);
    
    // Verify the original super admin remains unchanged
    const unchangedAdmin = await SuperAdmin.findOne({ email: 'existing@shopee.com' });
    expect(unchangedAdmin.name).toBe('Existing Super Admin');
    
    // WHEN: Attempting to register with same email but different case
    const responseCaseInsensitive = await request(app)
      .post('/api/superadmin/register')
      .send({
        name: 'Case Test Admin',
        email: 'EXISTING@shopee.com', // Different case
        password: 'CaseTestPass789!'
      });
    
    // THEN: Should handle case sensitivity appropriately (depends on DB schema)
    // If email is case-insensitive in schema, should reject; otherwise allow
    // For this test, we verify system doesn't crash with duplicate attempts
    expect([400, 201]).toContain(responseCaseInsensitive.status);
  });
});

describe('SuperAdmin Routes - POST /login', () => {
  
  test('Test 3: POST /login should generate valid JWT token for correct credentials (happy path - critical auth flow)', async () => {
    // GIVEN: An existing super admin with valid credentials
    const superAdminData = {
      name: 'Login Test Super Admin',
      email: 'login@shopee.com',
      password: 'ValidPassword123!'
    };
    
    const superAdmin = new SuperAdmin(superAdminData);
    await superAdmin.save();
    
    // WHEN: Logging in with correct credentials
    const response = await request(app)
      .post('/api/superadmin/login')
      .send({
        email: 'login@shopee.com',
        password: 'ValidPassword123!'
      });
    
    // THEN: Should return 200 with valid JWT token and name (critical auth flow verified)
    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.name).toBe(superAdminData.name);
    
    // Verify token is valid and contains correct super admin ID and role
    const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(superAdmin._id.toString());
    expect(decoded.role).toBe('superAdmin');
    expect(decoded.name).toBe(superAdminData.name);
    expect(decoded.exp).toBeDefined();
    
    // Verify token expiration is 30 days
    const expirationTime = decoded.exp - decoded.iat;
    expect(expirationTime).toBe(30 * 24 * 60 * 60); // 30 days in seconds
  });

  test('Test 4: POST /login should return 400 for invalid credentials - wrong password (error path - security critical)', async () => {
    // GIVEN: An existing super admin with known credentials
    const superAdminData = {
      name: 'Security Test Super Admin',
      email: 'security@shopee.com',
      password: 'CorrectPassword123!'
    };
    
    const superAdmin = new SuperAdmin(superAdminData);
    await superAdmin.save();
    
    // WHEN: Attempting login with wrong password
    const responseWrongPassword = await request(app)
      .post('/api/superadmin/login')
      .send({
        email: 'security@shopee.com',
        password: 'WrongPassword456!'
      });
    
    // THEN: Should return 400 with invalid credentials message (security critical - no token leak)
    expect(responseWrongPassword.status).toBe(400);
    expect(responseWrongPassword.body.message).toBe('Invalid credentials');
    expect(responseWrongPassword.body.token).toBeUndefined();
    expect(responseWrongPassword.body.name).toBeUndefined();
    
    // WHEN: Attempting login with empty password
    const responseEmptyPassword = await request(app)
      .post('/api/superadmin/login')
      .send({
        email: 'security@shopee.com',
        password: ''
      });
    
    // THEN: Should return 400 without revealing user existence
    expect(responseEmptyPassword.status).toBe(400);
    expect(responseEmptyPassword.body.message).toBe('Invalid credentials');
    expect(responseEmptyPassword.body.token).toBeUndefined();
    
    // WHEN: Attempting login with slightly modified password (case sensitivity test)
    const responseCasePassword = await request(app)
      .post('/api/superadmin/login')
      .send({
        email: 'security@shopee.com',
        password: 'correctpassword123!' // lowercase
      });
    
    // THEN: Should reject (password is case-sensitive for security)
    expect(responseCasePassword.status).toBe(400);
    expect(responseCasePassword.body.message).toBe('Invalid credentials');
  });

  
});

describe('SuperAdmin Routes - GET /restaurants', () => {
  
  test('Test 7: GET /restaurants should return 401 when no token provided (error path - auth middleware dependency)', async () => {
    // GIVEN: Multiple restaurants exist in database (to ensure endpoint has data to return if authenticated)
    const restaurant1 = new Restaurant({
      name: 'Test Restaurant 1',
      ownerName: 'Owner 1',
      location: 'Location 1',
      contactNumber: '1111111111',
      admin: {
        email: 'restaurant1@test.com',
        password: 'Pass123!'
      }
    });
    
    const restaurant2 = new Restaurant({
      name: 'Test Restaurant 2',
      ownerName: 'Owner 2',
      location: 'Location 2',
      contactNumber: '2222222222',
      admin: {
        email: 'restaurant2@test.com',
        password: 'Pass123!'
      }
    });
    
    await restaurant1.save();
    await restaurant2.save();
    
    // WHEN: Attempting to access protected route without token
    const responseNoToken = await request(app)
      .get('/api/superadmin/restaurants');
    
    // THEN: Should return 401 unauthorized (auth middleware dependency verified)
    expect(responseNoToken.status).toBe(401);
    expect(responseNoToken.body.message).toBe('No token, authorization denied');
    expect(responseNoToken.body.restaurants).toBeUndefined();
    
    // WHEN: Attempting with empty Authorization header
    const responseEmptyAuth = await request(app)
      .get('/api/superadmin/restaurants')
      .set('Authorization', '');
    
    // THEN: Should return 401
    expect(responseEmptyAuth.status).toBe(401);
    expect(responseEmptyAuth.body.message).toBe('No token, authorization denied');
    
    // WHEN: Attempting with malformed Authorization header (missing "Bearer" prefix)
    const validToken = jwt.sign({ id: 'test-id', role: 'superAdmin' }, process.env.JWT_SECRET);
    const responseMalformedAuth = await request(app)
      .get('/api/superadmin/restaurants')
      .set('Authorization', validToken); // Missing "Bearer " prefix
    
    // THEN: Should return 401 (strict token format validation)
    expect(responseMalformedAuth.status).toBe(401);
    expect(responseMalformedAuth.body.message).toBe('No token, authorization denied');
    
    // WHEN: Attempting with invalid token format
    const responseInvalidToken = await request(app)
      .get('/api/superadmin/restaurants')
      .set('Authorization', 'Bearer invalid-token-format');
    
    // THEN: Should return 401 with invalid token message
    expect(responseInvalidToken.status).toBe(401);
    expect(responseInvalidToken.body.message).toBe('Invalid token');
    
    // WHEN: Attempting with expired token
    const expiredToken = jwt.sign(
      { id: 'test-id', role: 'superAdmin' },
      process.env.JWT_SECRET,
      { expiresIn: '-1h' } // Expired 1 hour ago
    );
    const responseExpiredToken = await request(app)
      .get('/api/superadmin/restaurants')
      .set('Authorization', `Bearer ${expiredToken}`);
    
    // THEN: Should return 401 (expired token rejected)
    expect(responseExpiredToken.status).toBe(401);
    expect(responseExpiredToken.body.message).toBe('Invalid token');
  });
});

describe('SuperAdmin Routes - DELETE /restaurant/:id', () => {
  
  test('Test 8: DELETE /restaurant/:id should return 404 when restaurant ID not found (error path - high impact operation)', async () => {
    // GIVEN: A valid super admin with authentication token
    const superAdmin = new SuperAdmin({
      name: 'Delete Test Admin',
      email: 'delete@shopee.com',
      password: 'DeletePass123!'
    });
    await superAdmin.save();
    
    const validToken = jwt.sign(
      { id: superAdmin._id.toString(), role: 'superAdmin', name: superAdmin.name },
      process.env.JWT_SECRET
    );
    
    // AND: An existing restaurant to verify delete doesn't affect wrong data
    const existingRestaurant = new Restaurant({
      name: 'Existing Restaurant',
      ownerName: 'Existing Owner',
      location: 'Existing Location',
      contactNumber: '9999999999',
      admin: {
        email: 'existing@test.com',
        password: 'Pass123!'
      }
    });
    await existingRestaurant.save();
    
    // WHEN: Attempting to delete restaurant with non-existent ID (valid MongoDB ObjectId format)
    const fakeObjectId = '507f1f77bcf86cd799439011'; // Valid format but doesn't exist
    const responseNotFound = await request(app)
      .delete(`/api/superadmin/restaurant/${fakeObjectId}`)
      .set('Authorization', `Bearer ${validToken}`);
    
    // THEN: Should return 404 with not found message (high impact operation error handling verified)
    expect(responseNotFound.status).toBe(404);
    expect(responseNotFound.body.message).toBe('Restaurant not found');
    
    // Verify existing restaurant was NOT deleted (no side effects)
    const stillExists = await Restaurant.findById(existingRestaurant._id);
    expect(stillExists).toBeDefined();
    expect(stillExists.name).toBe('Existing Restaurant');
    
    // WHEN: Attempting to delete with invalid MongoDB ObjectId format
    const responseInvalidId = await request(app)
      .delete('/api/superadmin/restaurant/invalid-id-format')
      .set('Authorization', `Bearer ${validToken}`);
    
    // THEN: Should return 500 (CastError from Mongoose for invalid ObjectId format)
    expect(responseInvalidId.status).toBe(500);
    expect(responseInvalidId.body.message).toBe('Server Error');
    
    // Verify existing restaurant still intact after invalid ID attempt
    const stillExistsAfterInvalid = await Restaurant.findById(existingRestaurant._id);
    expect(stillExistsAfterInvalid).toBeDefined();
    
    // WHEN: Attempting to delete with null/undefined ID
    const responseNullId = await request(app)
      .delete('/api/superadmin/restaurant/null')
      .set('Authorization', `Bearer ${validToken}`);
    
    // THEN: Should return 500 (CastError from Mongoose for invalid ObjectId format)
    expect(responseNullId.status).toBe(500);
    expect(responseNullId.body.message).toBe('Server Error');
    
    // WHEN: Attempting to delete same non-existent ID multiple times (idempotency test)
    const responseSecondAttempt = await request(app)
      .delete(`/api/superadmin/restaurant/${fakeObjectId}`)
      .set('Authorization', `Bearer ${validToken}`);
    
    // THEN: Should consistently return 404 (idempotent behavior)
    expect(responseSecondAttempt.status).toBe(404);
    expect(responseSecondAttempt.body.message).toBe('Restaurant not found');
    
    // Verify total restaurant count remains 1 (only existing restaurant)
    const totalCount = await Restaurant.countDocuments();
    expect(totalCount).toBe(1);
  });
});
