// Import setup (must be first so lifecycle hooks run before tests)
import './setupMongo.js';
import { jest } from '@jest/globals';
jest.setTimeout(30000);

// Set JWT_SECRET before importing app
process.env.JWT_SECRET = 'test-secret-key-for-food-item-testing';

// then other imports
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/server.js';
import Restaurant from '../src/models/Restaurant.js';
import FoodItem from '../src/models/FoodItem.js';

// Helper function to generate JWT token
const generateToken = (userId, role = 'restaurant') => {
  return jwt.sign(
    { id: userId, role: role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

beforeEach(async () => {
  await Restaurant.deleteMany({});
  await FoodItem.deleteMany({});
});

afterEach(async () => {
  await Restaurant.deleteMany({});
  await FoodItem.deleteMany({});
});

describe('FoodItemRoutes - POST /api/food-items/create', () => {
  
  test('Test 1: POST /create should create food item with valid data and file upload (happy path)', async () => {
    // GIVEN: A valid restaurant and authenticated user with file upload
    const restaurantId = new mongoose.Types.ObjectId();
    await Restaurant.create({
      _id: restaurantId,
      name: 'Test Restaurant',
      ownerName: 'John Doe',
      location: 'Test Location',
      contactNumber: '1234567890',
      admin: {
        email: 'restaurant@test.com',
        password: '$2b$10$hashedPassword'
      }
    });
    
    const token = generateToken(restaurantId.toString(), 'restaurant');
    
    // WHEN: Making POST request to create food item with file
    const res = await request(app)
      .post('/api/food-items/create')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Delicious Burger')
      .field('description', 'A tasty burger')
      .field('price', '15000')
      .field('category', 'FastFood')
      .attach('image', Buffer.from('fake-image-data'), 'burger.jpg');
    
    // THEN: Should create food item successfully with image path
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Food item created successfully');
    expect(res.body.newFoodItem).toBeDefined();
    expect(res.body.newFoodItem.name).toBe('Delicious Burger');
    expect(res.body.newFoodItem.price).toBe(15000);
    expect(res.body.newFoodItem.image).toMatch(/\/uploads\/.+/);
    
    // Verify in database
    const savedItem = await FoodItem.findById(res.body.newFoodItem._id);
    expect(savedItem).toBeTruthy();
    expect(savedItem.restaurant.toString()).toBe(restaurantId.toString());
  });

  test('Test 2: POST /create should handle missing file upload (error path - null_pointer_risk)', async () => {
    // GIVEN: A valid restaurant and authenticated user but NO file upload
    const restaurantId = new mongoose.Types.ObjectId();
    await Restaurant.create({
      _id: restaurantId,
      name: 'Test Restaurant',
      ownerName: 'John Doe',
      location: 'Test Location',
      contactNumber: '1234567890',
      admin: {
        email: 'restaurant@test.com',
        password: '$2b$10$hashedPassword'
      }
    });
    
    const token = generateToken(restaurantId.toString(), 'restaurant');
    
    // WHEN: Making POST request without file (req.file is undefined) using multipart/form-data but no file attached
    const res = await request(app)
      .post('/api/food-items/create')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Burger Without Image')
      .field('description', 'Missing image')
      .field('price', '15000')
      .field('category', 'FastFood');
      // NO .attach() call - req.file will be undefined
    
    // THEN: Should return 500 error due to req.file.filename being undefined
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server Error');
    
    // Verify food item was NOT created in database
    const items = await FoodItem.find({ restaurant: restaurantId });
    expect(items.length).toBe(0);
  });

  test('Test 7: POST /create should handle restaurant not found (error path - null_pointer_risk)', async () => {
    // GIVEN: An authenticated user but restaurant does NOT exist in database
    const nonExistentRestaurantId = new mongoose.Types.ObjectId();
    const token = generateToken(nonExistentRestaurantId.toString(), 'restaurant');
    
    // WHEN: Making POST request with non-existent restaurant
    const res = await request(app)
      .post('/api/food-items/create')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Orphan Burger')
      .field('description', 'No restaurant')
      .field('price', '10000')
      .field('category', 'FastFood')
      .attach('image', Buffer.from('fake-image-data'), 'orphan.jpg');
    
    // THEN: Should return 404 error (Restaurant.findById returns null)
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Restaurant not found');
    
    // Verify food item was NOT created
    const items = await FoodItem.find({});
    expect(items.length).toBe(0);
  });
});

describe('FoodItemRoutes - GET /api/food-items/restaurant/:restaurantId', () => {
  
  test('Test 3: GET /restaurant/:restaurantId should return all food items for restaurant (happy path - public)', async () => {
    // GIVEN: A restaurant with multiple food items
    const restaurantId = new mongoose.Types.ObjectId();
    await Restaurant.create({
      _id: restaurantId,
      name: 'Popular Restaurant',
      ownerName: 'Jane Doe',
      location: 'Downtown',
      contactNumber: '9876543210',
      admin: {
        email: 'popular@test.com',
        password: '$2b$10$hashedPassword'
      }
    });
    
    // Create 3 food items
    await FoodItem.create([
      {
        restaurant: restaurantId,
        name: 'Pizza',
        description: 'Cheese pizza',
        price: 20000,
        image: '/uploads/pizza.jpg',
        category: 'Italian',
        availability: true
      },
      {
        restaurant: restaurantId,
        name: 'Pasta',
        description: 'Spaghetti',
        price: 18000,
        image: '/uploads/pasta.jpg',
        category: 'Italian',
        availability: true
      },
      {
        restaurant: restaurantId,
        name: 'Salad',
        description: 'Fresh salad',
        price: 12000,
        image: '/uploads/salad.jpg',
        category: 'Healthy',
        availability: false
      }
    ]);
    
    // WHEN: Making GET request to public endpoint (no auth required)
    const res = await request(app).get(`/api/food-items/restaurant/${restaurantId}`);
    
    // THEN: Should return all food items for the restaurant
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
    
    const names = res.body.map(item => item.name).sort();
    expect(names).toEqual(['Pasta', 'Pizza', 'Salad']);
    
    // Verify all items belong to correct restaurant
    res.body.forEach(item => {
      const restaurantRef = item.restaurant && item.restaurant._id 
        ? item.restaurant._id 
        : item.restaurant;
      expect(restaurantRef.toString()).toBe(restaurantId.toString());
    });
  });
});

describe('FoodItemRoutes - PUT /api/food-items/:id', () => {
  
  test('Test 4: PUT /:id should prevent unauthorized user from modifying food item (error path - security)', async () => {
    // GIVEN: Two different restaurants and a food item owned by restaurant1
    const restaurant1Id = new mongoose.Types.ObjectId();
    const restaurant2Id = new mongoose.Types.ObjectId();
    
    await Restaurant.create([
      {
        _id: restaurant1Id,
        name: 'Restaurant 1',
        ownerName: 'Owner 1',
        location: 'Location 1',
        contactNumber: '1111111111',
        admin: { email: 'r1@test.com', password: '$2b$10$hash1' }
      },
      {
        _id: restaurant2Id,
        name: 'Restaurant 2',
        ownerName: 'Owner 2',
        location: 'Location 2',
        contactNumber: '2222222222',
        admin: { email: 'r2@test.com', password: '$2b$10$hash2' }
      }
    ]);
    
    // Food item owned by restaurant1
    const foodItem = await FoodItem.create({
      restaurant: restaurant1Id,
      name: 'Original Burger',
      description: 'Original description',
      price: 10000,
      image: '/uploads/original.jpg',
      category: 'FastFood'
    });
    
    // Token for restaurant2 (trying to modify restaurant1's food item)
    const maliciousToken = generateToken(restaurant2Id.toString(), 'restaurant');
    
    // WHEN: Restaurant2 tries to update restaurant1's food item
    const res = await request(app)
      .put(`/api/food-items/${foodItem._id}`)
      .set('Authorization', `Bearer ${maliciousToken}`)
      .send({
        name: 'Hacked Burger',
        price: 1
      });
    
    // THEN: Should return 403 Forbidden (authorization check fails)
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You are not authorized to modify this food item');
    
    // Verify food item was NOT modified in database
    const unchangedItem = await FoodItem.findById(foodItem._id);
    expect(unchangedItem.name).toBe('Original Burger');
    expect(unchangedItem.price).toBe(10000);
  });

  test('Test 8: PUT /:id should update food item with partial fields and file (happy path)', async () => {
    // GIVEN: An existing food item owned by authenticated restaurant
    const restaurantId = new mongoose.Types.ObjectId();
    await Restaurant.create({
      _id: restaurantId,
      name: 'Update Restaurant',
      ownerName: 'Owner',
      location: 'Location',
      contactNumber: '3333333333',
      admin: { email: 'update@test.com', password: '$2b$10$hash' }
    });
    
    const foodItem = await FoodItem.create({
      restaurant: restaurantId,
      name: 'Old Name',
      description: 'Old description',
      price: 5000,
      image: '/uploads/old.jpg',
      category: 'OldCategory',
      availability: true
    });
    
    const token = generateToken(restaurantId.toString(), 'restaurant');
    
    // WHEN: Updating only some fields with new file upload
    const res = await request(app)
      .put(`/api/food-items/${foodItem._id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Updated Name')
      .field('price', '8000')
      .field('availability', 'false')
      .attach('image', Buffer.from('new-image-data'), 'new.jpg');
    
    // THEN: Should update specified fields and file, keep others unchanged
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Food item updated successfully');
    expect(res.body.foodItem.name).toBe('Updated Name');
    expect(res.body.foodItem.price).toBe(8000);
    expect(res.body.foodItem.availability).toBe(false);
    expect(res.body.foodItem.image).toMatch(/\/uploads\/.+/);
    expect(res.body.foodItem.image).not.toBe('/uploads/old.jpg'); // Image changed
    expect(res.body.foodItem.description).toBe('Old description'); // Unchanged
    expect(res.body.foodItem.category).toBe('OldCategory'); // Unchanged
    
    // Verify in database
    const updatedItem = await FoodItem.findById(foodItem._id);
    expect(updatedItem.name).toBe('Updated Name');
    expect(updatedItem.price).toBe(8000);
    expect(updatedItem.availability).toBe(false);
  });
});

describe('FoodItemRoutes - DELETE /api/food-items/:id', () => {
  
  test('Test 5: DELETE /:id should prevent unauthorized deletion (error path - security critical)', async () => {
    // GIVEN: Two restaurants and a food item owned by restaurant1
    const restaurant1Id = new mongoose.Types.ObjectId();
    const restaurant2Id = new mongoose.Types.ObjectId();
    
    await Restaurant.create([
      {
        _id: restaurant1Id,
        name: 'Restaurant Owner',
        ownerName: 'Owner 1',
        location: 'Location 1',
        contactNumber: '4444444444',
        admin: { email: 'owner@test.com', password: '$2b$10$hash1' }
      },
      {
        _id: restaurant2Id,
        name: 'Restaurant Attacker',
        ownerName: 'Attacker',
        location: 'Location 2',
        contactNumber: '5555555555',
        admin: { email: 'attacker@test.com', password: '$2b$10$hash2' }
      }
    ]);
    
    const foodItem = await FoodItem.create({
      restaurant: restaurant1Id,
      name: 'Protected Item',
      description: 'Should not be deleted',
      price: 15000,
      image: '/uploads/protected.jpg',
      category: 'Protected'
    });
    
    // Token for restaurant2 (unauthorized user)
    const unauthorizedToken = generateToken(restaurant2Id.toString(), 'restaurant');
    
    // WHEN: Unauthorized user tries to delete restaurant1's food item
    const res = await request(app)
      .delete(`/api/food-items/${foodItem._id}`)
      .set('Authorization', `Bearer ${unauthorizedToken}`);
    
    // THEN: Should return 403 Forbidden (security check prevents deletion)
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You are not authorized to delete this food item');
    
    // Verify food item still exists in database
    const stillExists = await FoodItem.findById(foodItem._id);
    expect(stillExists).toBeTruthy();
    expect(stillExists.name).toBe('Protected Item');
  });
});

describe('FoodItemRoutes - PUT /api/food-items/availability/:id', () => {
  
  test('Test 6: PUT /availability/:id should validate boolean value (edge case)', async () => {
    // GIVEN: An existing food item owned by authenticated restaurant
    const restaurantId = new mongoose.Types.ObjectId();
    await Restaurant.create({
      _id: restaurantId,
      name: 'Validation Restaurant',
      ownerName: 'Owner',
      location: 'Location',
      contactNumber: '6666666666',
      admin: { email: 'validate@test.com', password: '$2b$10$hash' }
    });
    
    const foodItem = await FoodItem.create({
      restaurant: restaurantId,
      name: 'Item with Availability',
      description: 'Test availability',
      price: 10000,
      image: '/uploads/test.jpg',
      category: 'Test',
      availability: true
    });
    
    const token = generateToken(restaurantId.toString(), 'restaurant');
    
    // WHEN: Sending invalid availability value (not boolean)
    const res = await request(app)
      .put(`/api/food-items/availability/${foodItem._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        availability: 'yes' // Invalid: string instead of boolean
      });
    
    // THEN: Should return 400 Bad Request with validation message
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid value for availability. Must be true or false.');
    
    // Verify availability was NOT changed in database
    const unchangedItem = await FoodItem.findById(foodItem._id);
    expect(unchangedItem.availability).toBe(true); // Still original value
    
    // Test with null value
    const resNull = await request(app)
      .put(`/api/food-items/availability/${foodItem._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        availability: null
      });
    
    expect(resNull.status).toBe(400);
    expect(resNull.body.message).toBe('Invalid value for availability. Must be true or false.');
    
    // Test with number value
    const resNumber = await request(app)
      .put(`/api/food-items/availability/${foodItem._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        availability: 1
      });
    
    expect(resNumber.status).toBe(400);
    expect(resNumber.body.message).toBe('Invalid value for availability. Must be true or false.');
  });
});
