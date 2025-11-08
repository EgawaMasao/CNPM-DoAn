// Import setup (must be first so lifecycle hooks run before tests)
import './setupMongo.js';
import { jest } from '@jest/globals';
jest.setTimeout(30000);

// then other imports
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Restaurant from '../src/models/Restaurant.js';
import restaurantRoutes from '../src/routes/restaurantRoutes.js';

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/restaurants', restaurantRoutes);

// Mock JWT_SECRET
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';

beforeEach(async () => {
  await Restaurant.deleteMany({});
});

afterEach(async () => {
  await Restaurant.deleteMany({});
});

describe('Restaurant Routes - POST /register', () => {
  
  test('Test 1: POST /register should successfully register restaurant with all required fields and file upload (happy path)', async () => {
    // GIVEN: Valid restaurant registration data with all required fields
    const validRestaurantData = {
      name: 'Golden Dragon Restaurant',
      ownerName: 'John Smith',
      location: '123 Main Street, City',
      contactNumber: '0123456789',
      email: 'admin@goldendragon.com',
      password: 'SecurePassword123!'
    };
    
    // WHEN: Posting registration request with file
    const response = await request(app)
      .post('/api/restaurants/register')
      .field('name', validRestaurantData.name)
      .field('ownerName', validRestaurantData.ownerName)
      .field('location', validRestaurantData.location)
      .field('contactNumber', validRestaurantData.contactNumber)
      .field('email', validRestaurantData.email)
      .field('password', validRestaurantData.password)
      .attach('profilePicture', Buffer.from('fake-image-content'), 'restaurant.jpg');
    
    // THEN: Should return 201 with success message and restaurant details
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Restaurant and Admin registered successfully');
    expect(response.body.restaurant).toBeDefined();
    expect(response.body.restaurant.name).toBe(validRestaurantData.name);
    expect(response.body.restaurant.ownerName).toBe(validRestaurantData.ownerName);
    expect(response.body.restaurant.location).toBe(validRestaurantData.location);
    expect(response.body.restaurant.contactNumber).toBe(validRestaurantData.contactNumber);
    expect(response.body.restaurant.profilePicture).toContain('/uploads/');
    
    // Verify restaurant was saved in database
    const savedRestaurant = await Restaurant.findOne({ 'admin.email': validRestaurantData.email });
    expect(savedRestaurant).toBeDefined();
    expect(savedRestaurant.name).toBe(validRestaurantData.name);
  });

  test('Test 2: POST /register should return 400 when missing required fields (error path - null pointer risk)', async () => {
    // GIVEN: Multiple test cases with missing required fields
    const testCases = [
      { name: '', ownerName: 'John', location: 'Location', contactNumber: '123', email: 'test@test.com', password: 'pass', missing: 'name' },
      { name: 'Restaurant', ownerName: '', location: 'Location', contactNumber: '123', email: 'test@test.com', password: 'pass', missing: 'ownerName' },
      { name: 'Restaurant', ownerName: 'John', location: '', contactNumber: '123', email: 'test@test.com', password: 'pass', missing: 'location' },
      { name: 'Restaurant', ownerName: 'John', location: 'Location', contactNumber: '', email: 'test@test.com', password: 'pass', missing: 'contactNumber' },
      { name: 'Restaurant', ownerName: 'John', location: 'Location', contactNumber: '123', email: '', password: 'pass', missing: 'email' },
      { name: 'Restaurant', ownerName: 'John', location: 'Location', contactNumber: '123', email: 'test@test.com', password: '', missing: 'password' }
    ];
    
    // WHEN: Attempting to register with missing fields
    for (const testData of testCases) {
      const response = await request(app)
        .post('/api/restaurants/register')
        .field('name', testData.name)
        .field('ownerName', testData.ownerName)
        .field('location', testData.location)
        .field('contactNumber', testData.contactNumber)
        .field('email', testData.email)
        .field('password', testData.password);
      
      // THEN: Should return 400 with validation error
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('All fields are required');
    }
    
    // WHEN: Sending request with completely missing fields (null/undefined)
    const responseNoFields = await request(app)
      .post('/api/restaurants/register')
      .send({});
    
    // THEN: Should return 400 (null pointer protection)
    expect(responseNoFields.status).toBe(400);
    expect(responseNoFields.body.message).toBe('All fields are required');
  });

  test('Test 5: POST /register should return 400 when duplicate restaurant name or email exists (error path - data integrity)', async () => {
    // GIVEN: An existing restaurant in the database
    const existingRestaurant = new Restaurant({
      name: 'Existing Restaurant',
      ownerName: 'Jane Doe',
      location: '456 Oak Avenue',
      contactNumber: '9876543210',
      admin: {
        email: 'existing@restaurant.com',
        password: 'ExistingPass123!'
      }
    });
    await existingRestaurant.save();
    
    // WHEN: Attempting to register with duplicate restaurant name
    const responseDuplicateName = await request(app)
      .post('/api/restaurants/register')
      .field('name', 'Existing Restaurant')
      .field('ownerName', 'Different Owner')
      .field('location', 'Different Location')
      .field('contactNumber', '1111111111')
      .field('email', 'different@email.com')
      .field('password', 'DifferentPass123!');
    
    // THEN: Should return 400 with duplicate error
    expect(responseDuplicateName.status).toBe(400);
    expect(responseDuplicateName.body.message).toBe('Restaurant or Email already exists');
    
    // WHEN: Attempting to register with duplicate email
    const responseDuplicateEmail = await request(app)
      .post('/api/restaurants/register')
      .field('name', 'Different Restaurant')
      .field('ownerName', 'Different Owner')
      .field('location', 'Different Location')
      .field('contactNumber', '2222222222')
      .field('email', 'existing@restaurant.com')
      .field('password', 'DifferentPass123!');
    
    // THEN: Should return 400 with duplicate error
    expect(responseDuplicateEmail.status).toBe(400);
    expect(responseDuplicateEmail.body.message).toBe('Restaurant or Email already exists');
    
    // Verify only one restaurant exists in database
    const restaurantCount = await Restaurant.countDocuments();
    expect(restaurantCount).toBe(1);
  });
});

describe('Restaurant Routes - POST /login', () => {
  
  test('Test 3: POST /login should generate valid JWT token for correct credentials (happy path - critical authentication)', async () => {
    // GIVEN: An existing restaurant with valid credentials
    const restaurantData = {
      name: 'Login Test Restaurant',
      ownerName: 'Test Owner',
      location: 'Test Location',
      contactNumber: '5555555555',
      admin: {
        email: 'login@test.com',
        password: 'ValidPassword123!'
      }
    };
    
    const restaurant = new Restaurant(restaurantData);
    await restaurant.save();
    
    // WHEN: Logging in with correct credentials
    const response = await request(app)
      .post('/api/restaurants/login')
      .send({
        email: 'login@test.com',
        password: 'ValidPassword123!'
      });
    
    // THEN: Should return 200 with valid JWT token
    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    
    // Verify token is valid and contains correct restaurant ID
    const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(restaurant._id.toString());
    expect(decoded.exp).toBeDefined();
  });

  test('Test 4: POST /login should reject invalid credentials - wrong password and non-existent email (error path - security critical)', async () => {
    // GIVEN: An existing restaurant with known credentials
    const restaurantData = {
      name: 'Security Test Restaurant',
      ownerName: 'Security Owner',
      location: 'Security Location',
      contactNumber: '7777777777',
      admin: {
        email: 'security@test.com',
        password: 'CorrectPassword123!'
      }
    };
    
    const restaurant = new Restaurant(restaurantData);
    await restaurant.save();
    
    // WHEN: Attempting login with wrong password
    const responseWrongPassword = await request(app)
      .post('/api/restaurants/login')
      .send({
        email: 'security@test.com',
        password: 'WrongPassword456!'
      });
    
    // THEN: Should return 400 with invalid credentials message (no token leak)
    expect(responseWrongPassword.status).toBe(400);
    expect(responseWrongPassword.body.message).toBe('Invalid credentials');
    expect(responseWrongPassword.body.token).toBeUndefined();
    
    // WHEN: Attempting login with non-existent email
    const responseNonExistentEmail = await request(app)
      .post('/api/restaurants/login')
      .send({
        email: 'nonexistent@test.com',
        password: 'AnyPassword123!'
      });
    
    // THEN: Should return 400 with same invalid credentials message (no info leak)
    expect(responseNonExistentEmail.status).toBe(400);
    expect(responseNonExistentEmail.body.message).toBe('Invalid credentials');
    expect(responseNonExistentEmail.body.token).toBeUndefined();
    
    // WHEN: Attempting login with null/undefined inputs
    const responseNullEmail = await request(app)
      .post('/api/restaurants/login')
      .send({
        email: null,
        password: 'Password123!'
      });
    
    // THEN: Should handle gracefully without crashing
    expect(responseNullEmail.status).toBe(400);
    expect(responseNullEmail.body.message).toBe('Invalid credentials');
  });
});

describe('Restaurant Routes - PUT /availability', () => {
  
  test('Test 6: PUT /availability should toggle restaurant availability (true/false) affecting visibility (happy path - business logic critical)', async () => {
    // GIVEN: An existing restaurant with default availability (true)
    const restaurantData = {
      name: 'Availability Test Restaurant',
      ownerName: 'Availability Owner',
      location: 'Availability Location',
      contactNumber: '8888888888',
      admin: {
        email: 'availability@test.com',
        password: 'AvailabilityPass123!'
      },
      availability: true
    };
    
    const restaurant = new Restaurant(restaurantData);
    await restaurant.save();
    
    // Generate valid JWT token
    const token = jwt.sign({ id: restaurant._id }, process.env.JWT_SECRET);
    
    // WHEN: Setting availability to false (closing restaurant)
    const responseClose = await request(app)
      .put('/api/restaurants/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({
        availability: false
      });
    
    // THEN: Should return 200 with "Closed" message
    expect(responseClose.status).toBe(200);
    expect(responseClose.body.message).toBe('Restaurant is now Closed');
    expect(responseClose.body.availability).toBe(false);
    
    // Verify database was updated
    const updatedRestaurantClosed = await Restaurant.findById(restaurant._id);
    expect(updatedRestaurantClosed.availability).toBe(false);
    
    // WHEN: Setting availability to true (opening restaurant)
    const responseOpen = await request(app)
      .put('/api/restaurants/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({
        availability: true
      });
    
    // THEN: Should return 200 with "Open" message
    expect(responseOpen.status).toBe(200);
    expect(responseOpen.body.message).toBe('Restaurant is now Open');
    expect(responseOpen.body.availability).toBe(true);
    
    // Verify database was updated
    const updatedRestaurantOpen = await Restaurant.findById(restaurant._id);
    expect(updatedRestaurantOpen.availability).toBe(true);
    
    // WHEN: Sending invalid (non-boolean) availability value
    const responseInvalid = await request(app)
      .put('/api/restaurants/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({
        availability: 'invalid-string'
      });
    
    // THEN: Should return 400 with validation error
    expect(responseInvalid.status).toBe(400);
    expect(responseInvalid.body.message).toBe('Invalid value for availability. Must be true or false.');
  });
});

describe('Restaurant Routes - GET /all', () => {
  
  test('Test 7: GET /all should return only available restaurants (availability: true filter) for customers (happy path - public endpoint)', async () => {
    // GIVEN: Multiple restaurants with different availability statuses
    const availableRestaurant1 = new Restaurant({
      name: 'Available Restaurant 1',
      ownerName: 'Owner 1',
      location: 'Location 1',
      contactNumber: '1111111111',
      admin: { email: 'available1@test.com', password: 'Pass123!' },
      availability: true
    });
    
    const availableRestaurant2 = new Restaurant({
      name: 'Available Restaurant 2',
      ownerName: 'Owner 2',
      location: 'Location 2',
      contactNumber: '2222222222',
      admin: { email: 'available2@test.com', password: 'Pass123!' },
      availability: true
    });
    
    const unavailableRestaurant = new Restaurant({
      name: 'Unavailable Restaurant',
      ownerName: 'Owner 3',
      location: 'Location 3',
      contactNumber: '3333333333',
      admin: { email: 'unavailable@test.com', password: 'Pass123!' },
      availability: false
    });
    
    await availableRestaurant1.save();
    await availableRestaurant2.save();
    await unavailableRestaurant.save();
    
    // WHEN: Customer fetches all available restaurants (no authentication required - public endpoint)
    const response = await request(app)
      .get('/api/restaurants/all');
    
    // THEN: Should return 200 with only available restaurants
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Restaurants fetched successfully');
    expect(response.body.restaurants).toBeDefined();
    expect(response.body.restaurants.length).toBe(2);
    
    // Verify only available restaurants are returned
    const restaurantNames = response.body.restaurants.map(r => r.name);
    expect(restaurantNames).toContain('Available Restaurant 1');
    expect(restaurantNames).toContain('Available Restaurant 2');
    expect(restaurantNames).not.toContain('Unavailable Restaurant');
    
    // Verify passwords are not exposed in response
    response.body.restaurants.forEach(restaurant => {
      expect(restaurant.admin).toBeDefined();
      expect(restaurant.admin.password).toBeUndefined();
    });
    
    // WHEN: No restaurants are available
    await Restaurant.deleteMany({});
    const responseEmpty = await request(app)
      .get('/api/restaurants/all');
    
    // THEN: Should return 200 with empty array (no error)
    expect(responseEmpty.status).toBe(200);
    expect(responseEmpty.body.restaurants).toEqual([]);
  });
});

describe('Restaurant Routes - PUT /update', () => {
  
  test('Test 8: PUT /update should handle partial updates with optional fields and file upload (edge case - null pointer risk)', async () => {
    // GIVEN: An existing restaurant
    const restaurantData = {
      name: 'Original Restaurant Name',
      ownerName: 'Original Owner',
      location: 'Original Location',
      contactNumber: '9999999999',
      admin: {
        email: 'update@test.com',
        password: 'UpdatePass123!'
      },
      profilePicture: '/uploads/old-picture.jpg'
    };
    
    const restaurant = new Restaurant(restaurantData);
    await restaurant.save();
    
    // Generate valid JWT token
    const token = jwt.sign({ id: restaurant._id }, process.env.JWT_SECRET);
    
    // WHEN: Updating only name (partial update without file)
    const responsePartialName = await request(app)
      .put('/api/restaurants/update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Name Only'
      });
    
    // THEN: Should update only name, keep other fields unchanged
    expect(responsePartialName.status).toBe(200);
    expect(responsePartialName.body.message).toBe('Profile updated successfully');
    expect(responsePartialName.body.restaurant.name).toBe('Updated Name Only');
    expect(responsePartialName.body.restaurant.ownerName).toBe('Original Owner');
    expect(responsePartialName.body.restaurant.location).toBe('Original Location');
    expect(responsePartialName.body.restaurant.contactNumber).toBe('9999999999');
    expect(responsePartialName.body.restaurant.profilePicture).toBe('/uploads/old-picture.jpg');
    
    // WHEN: Updating with new profile picture and some fields
    const responseWithFile = await request(app)
      .put('/api/restaurants/update')
      .set('Authorization', `Bearer ${token}`)
      .field('location', 'New Location')
      .field('contactNumber', '0000000000')
      .attach('profilePicture', Buffer.from('new-image-content'), 'new-picture.jpg');
    
    // THEN: Should update specified fields and profile picture
    expect(responseWithFile.status).toBe(200);
    expect(responseWithFile.body.restaurant.location).toBe('New Location');
    expect(responseWithFile.body.restaurant.contactNumber).toBe('0000000000');
    expect(responseWithFile.body.restaurant.profilePicture).toContain('/uploads/');
    expect(responseWithFile.body.restaurant.profilePicture).not.toBe('/uploads/old-picture.jpg');
    
    // WHEN: Sending empty update request (no fields provided)
    const responseEmpty = await request(app)
      .put('/api/restaurants/update')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    
    // THEN: Should return 200 without errors (handles null/undefined gracefully)
    expect(responseEmpty.status).toBe(200);
    expect(responseEmpty.body.message).toBe('Profile updated successfully');
    
    // WHEN: Updating with null values (edge case)
    const responseNullValues = await request(app)
      .put('/api/restaurants/update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: null,
        ownerName: undefined
      });
    
    // THEN: Should handle null/undefined without crashing (fields not updated when null)
    expect(responseNullValues.status).toBe(200);
  });
});
