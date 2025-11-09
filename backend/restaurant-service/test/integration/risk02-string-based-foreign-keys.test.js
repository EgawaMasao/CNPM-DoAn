/**
 * RISK-02: String-Based Foreign Keys - No Validation
 * Tests that orders can be created with non-existent restaurantId and foodId
 * Demonstrates lack of referential integrity
 */

import mongoose from 'mongoose';
import Restaurant from '../../src/models/Restaurant.js';
import FoodItem from '../../src/models/FoodItem.js';

describe('RISK-02: String-Based Foreign Keys Integration Test', () => {
  const MONGO_URI = 'mongodb://localhost:27017/Restaurant';
  let validRestaurant;
  let validFoodItem;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI);
    }
  });

  beforeEach(async () => {
    await Restaurant.deleteMany({});
    await FoodItem.deleteMany({});

    // Create valid test data
    validRestaurant = await Restaurant.create({
      name: 'Valid Restaurant',
      ownerName: 'Owner Name',
      location: 'Valid Location',
      contactNumber: '+1234567890',
      admin: {
        email: 'valid@restaurant.com',
        password: 'password123'
      }
    });

    validFoodItem = await FoodItem.create({
      restaurant: validRestaurant._id,
      name: 'Valid Food',
      description: 'Valid Description',
      price: 1500,
      image: '/uploads/valid.jpg',
      category: 'Main Course'
    });
  });

  afterAll(async () => {
    await Restaurant.deleteMany({});
    await FoodItem.deleteMany({});
    await mongoose.connection.close();
  });

  test('Should demonstrate lack of foreign key validation for restaurantId', async () => {
    // Create order schema simulation (string-based IDs)
    const OrderSchema = new mongoose.Schema({
      customerId: { type: String, required: true },
      restaurantId: { type: String, required: true }, // No reference validation
      items: [{
        foodId: { type: String, required: true },
        quantity: Number,
        price: Number
      }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Create order with NON-EXISTENT restaurantId (ghost restaurant)
    const ghostRestaurantId = new mongoose.Types.ObjectId().toString();
    const invalidOrder = await Order.create({
      customerId: 'customer_123',
      restaurantId: ghostRestaurantId, // Does not exist in Restaurant collection
      items: [{
        foodId: validFoodItem._id.toString(),
        quantity: 2,
        price: 1500
      }],
      totalPrice: 3000,
      deliveryAddress: '123 Ghost Street'
    });

    // Order created successfully despite invalid restaurantId
    expect(invalidOrder).toBeDefined();
    expect(invalidOrder.restaurantId).toBe(ghostRestaurantId);

    // Verify restaurant doesn't exist
    const restaurantExists = await Restaurant.findById(ghostRestaurantId);
    expect(restaurantExists).toBeNull();

    // But order still exists with invalid reference
    const orderExists = await Order.findById(invalidOrder._id);
    expect(orderExists).not.toBeNull();
    expect(orderExists.restaurantId).toBe(ghostRestaurantId);

    await Order.deleteMany({});
  });

  test('Should demonstrate lack of foreign key validation for foodId', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{
        foodId: { type: String, required: true },
        quantity: Number,
        price: Number
      }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Create order with NON-EXISTENT foodId
    const ghostFoodId = new mongoose.Types.ObjectId().toString();
    const invalidOrder = await Order.create({
      customerId: 'customer_456',
      restaurantId: validRestaurant._id.toString(),
      items: [{
        foodId: ghostFoodId, // Does not exist in FoodItem collection
        quantity: 5,
        price: 2000
      }],
      totalPrice: 10000,
      deliveryAddress: '456 Phantom Avenue'
    });

    expect(invalidOrder).toBeDefined();
    expect(invalidOrder.items[0].foodId).toBe(ghostFoodId);

    // Verify food item doesn't exist
    const foodExists = await FoodItem.findById(ghostFoodId);
    expect(foodExists).toBeNull();

    // But order still exists
    const orderExists = await Order.findById(invalidOrder._id);
    expect(orderExists.items[0].foodId).toBe(ghostFoodId);

    await Order.deleteMany({});
  });

  test('Should allow multiple orders with same non-existent references', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    const fakeRestaurantId = 'nonexistent_restaurant_999';
    const fakeFoodId = 'nonexistent_food_888';

    // Create multiple orders with fake IDs
    const orders = await Order.insertMany([
      {
        customerId: 'customer_1',
        restaurantId: fakeRestaurantId,
        items: [{ foodId: fakeFoodId, quantity: 1, price: 100 }],
        totalPrice: 100,
        deliveryAddress: 'Address 1'
      },
      {
        customerId: 'customer_2',
        restaurantId: fakeRestaurantId,
        items: [{ foodId: fakeFoodId, quantity: 3, price: 100 }],
        totalPrice: 300,
        deliveryAddress: 'Address 2'
      },
      {
        customerId: 'customer_3',
        restaurantId: fakeRestaurantId,
        items: [{ foodId: fakeFoodId, quantity: 2, price: 100 }],
        totalPrice: 200,
        deliveryAddress: 'Address 3'
      }
    ]);

    expect(orders).toHaveLength(3);
    
    // All reference same non-existent entities
    orders.forEach(order => {
      expect(order.restaurantId).toBe(fakeRestaurantId);
      expect(order.items[0].foodId).toBe(fakeFoodId);
    });

    // Verify references don't exist in database (using proper query)
    // Note: Cannot query Restaurant/FoodItem with invalid string IDs
    // This demonstrates the lack of referential integrity - orders accepted invalid IDs
    const allRestaurants = await Restaurant.find({});
    const allFoods = await FoodItem.find({});
    
    const restaurantExists = allRestaurants.some(r => r._id.toString() === fakeRestaurantId);
    const foodExists = allFoods.some(f => f._id.toString() === fakeFoodId);
    
    expect(restaurantExists).toBe(false);
    expect(foodExists).toBe(false);

    await Order.deleteMany({});
  });

  test('Should demonstrate referential integrity violation with deleted entities', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Create order with valid references
    const order = await Order.create({
      customerId: 'customer_777',
      restaurantId: validRestaurant._id.toString(),
      items: [{
        foodId: validFoodItem._id.toString(),
        quantity: 1,
        price: 1500
      }],
      totalPrice: 1500,
      deliveryAddress: 'Valid Address'
    });

    // Delete the restaurant and food item
    await Restaurant.findByIdAndDelete(validRestaurant._id);
    await FoodItem.findByIdAndDelete(validFoodItem._id);

    // Order still exists with dangling references
    const orphanedOrder = await Order.findById(order._id);
    expect(orphanedOrder).not.toBeNull();

    // But referenced entities are gone
    const deletedRestaurant = await Restaurant.findById(orphanedOrder.restaurantId);
    const deletedFood = await FoodItem.findById(orphanedOrder.items[0].foodId);
    expect(deletedRestaurant).toBeNull();
    expect(deletedFood).toBeNull();

    await Order.deleteMany({});
  });

  test('Should accept invalid ObjectId formats as strings', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Invalid ObjectId formats but accepted as strings
    const invalidFormats = [
      'not-an-objectid',
      '12345',
      'abc-def-ghi',
      'restaurant_with_spaces',
      'food@item#invalid'
    ];

    for (const invalidId of invalidFormats) {
      const order = await Order.create({
        customerId: 'customer_test',
        restaurantId: invalidId,
        items: [{
          foodId: invalidId,
          quantity: 1,
          price: 100
        }],
        totalPrice: 100,
        deliveryAddress: 'Test Address'
      });

      expect(order.restaurantId).toBe(invalidId);
      expect(order.items[0].foodId).toBe(invalidId);
    }

    const allOrders = await Order.find({});
    expect(allOrders).toHaveLength(invalidFormats.length);

    await Order.deleteMany({});
  });

  test('Should demonstrate cascade delete issue with string references', async () => {
    // Create restaurant with food items
    const restaurant = await Restaurant.create({
      name: 'Cascade Test Restaurant',
      ownerName: 'Cascade Owner',
      location: 'Cascade Location',
      contactNumber: '+9876543210',
      admin: {
        email: 'cascade@test.com',
        password: 'password123'
      }
    });

    const foodItems = await FoodItem.insertMany([
      {
        restaurant: restaurant._id,
        name: 'Food 1',
        description: 'Description 1',
        price: 1000,
        image: '/uploads/food1.jpg',
        category: 'Category A'
      },
      {
        restaurant: restaurant._id,
        name: 'Food 2',
        description: 'Description 2',
        price: 2000,
        image: '/uploads/food2.jpg',
        category: 'Category B'
      }
    ]);

    // Delete restaurant
    await Restaurant.findByIdAndDelete(restaurant._id);

    // Food items still exist (no cascade)
    const orphanedFoods = await FoodItem.find({ restaurant: restaurant._id });
    expect(orphanedFoods).toHaveLength(2);

    // Clean up
    await FoodItem.deleteMany({ restaurant: restaurant._id });
  });
});
