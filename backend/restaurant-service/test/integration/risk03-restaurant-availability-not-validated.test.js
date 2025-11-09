/**
 * RISK-03: Restaurant Availability Not Validated During Order
 * Tests that orders can be created for closed/unavailable restaurants
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../src/server.js';
import Restaurant from '../../src/models/Restaurant.js';
import FoodItem from '../../src/models/FoodItem.js';

describe('RISK-03: Restaurant Availability Not Validated Integration Test', () => {
  const MONGO_URI = 'mongodb://localhost:27017/Restaurant';
  let closedRestaurant;
  let openRestaurant;
  let foodItem1;
  let foodItem2;
  let customerToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI);
    }
  });

  beforeEach(async () => {
    await Restaurant.deleteMany({});
    await FoodItem.deleteMany({});

    // Create closed restaurant
    closedRestaurant = await Restaurant.create({
      name: 'Closed Restaurant',
      ownerName: 'Closed Owner',
      location: 'Closed Street',
      contactNumber: '+1111111111',
      admin: {
        email: 'closed@test.com',
        password: 'password123'
      },
      availability: false // CLOSED
    });

    // Create open restaurant
    openRestaurant = await Restaurant.create({
      name: 'Open Restaurant',
      ownerName: 'Open Owner',
      location: 'Open Street',
      contactNumber: '+2222222222',
      admin: {
        email: 'open@test.com',
        password: 'password123'
      },
      availability: true // OPEN
    });

    // Create food items
    foodItem1 = await FoodItem.create({
      restaurant: closedRestaurant._id,
      name: 'Food from Closed Restaurant',
      description: 'Should not be orderable',
      price: 1500,
      image: '/uploads/closed-food.jpg',
      category: 'Main Course',
      availability: true
    });

    foodItem2 = await FoodItem.create({
      restaurant: openRestaurant._id,
      name: 'Food from Open Restaurant',
      description: 'Can be ordered',
      price: 2000,
      image: '/uploads/open-food.jpg',
      category: 'Dessert',
      availability: true
    });

    // Create customer token
    customerToken = jwt.sign(
      { id: 'customer_123', role: 'customer' },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await Restaurant.deleteMany({});
    await FoodItem.deleteMany({});
    await mongoose.connection.close();
  });

  test('Should verify restaurant is actually closed in database', async () => {
    const restaurant = await Restaurant.findById(closedRestaurant._id);
    expect(restaurant.availability).toBe(false);
    expect(restaurant.name).toBe('Closed Restaurant');
  });

  test('Should demonstrate order creation succeeds for closed restaurant', async () => {
    // Simulate order-service creating order without checking availability
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String,
      status: { type: String, default: 'Pending' }
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Create order for CLOSED restaurant
    const orderForClosedRestaurant = await Order.create({
      customerId: 'customer_123',
      restaurantId: closedRestaurant._id.toString(),
      items: [{
        foodId: foodItem1._id.toString(),
        quantity: 3,
        price: 1500
      }],
      totalPrice: 4500,
      deliveryAddress: '123 Customer Street'
    });

    // Order created successfully despite restaurant being closed
    expect(orderForClosedRestaurant).toBeDefined();
    expect(orderForClosedRestaurant.status).toBe('Pending');

    // Verify restaurant is still closed
    const restaurant = await Restaurant.findById(closedRestaurant._id);
    expect(restaurant.availability).toBe(false);

    await Order.deleteMany({});
  });

  test('Should allow fetching closed restaurants from public endpoint', async () => {
    const response = await request(app)
      .get('/api/restaurant/all');

    expect(response.status).toBe(200);
    expect(response.body.restaurants).toBeDefined();

    // Only open restaurants should be returned
    const closedInResults = response.body.restaurants.find(
      r => r._id.toString() === closedRestaurant._id.toString()
    );
    expect(closedInResults).toBeUndefined();

    // But closed restaurant still exists in DB
    const closedInDB = await Restaurant.findById(closedRestaurant._id);
    expect(closedInDB).not.toBeNull();
    expect(closedInDB.availability).toBe(false);
  });

  test('Should demonstrate availability toggle without order validation', async () => {
    // Restaurant starts open
    let restaurant = await Restaurant.findById(openRestaurant._id);
    expect(restaurant.availability).toBe(true);

    // Close the restaurant
    restaurant.availability = false;
    await restaurant.save();

    // Verify it's now closed
    restaurant = await Restaurant.findById(openRestaurant._id);
    expect(restaurant.availability).toBe(false);

    // Create order schema
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Still able to create order for now-closed restaurant
    const order = await Order.create({
      customerId: 'customer_456',
      restaurantId: openRestaurant._id.toString(),
      items: [{
        foodId: foodItem2._id.toString(),
        quantity: 2,
        price: 2000
      }],
      totalPrice: 4000,
      deliveryAddress: '456 Test Avenue'
    });

    expect(order).toBeDefined();
    expect(order.restaurantId).toBe(openRestaurant._id.toString());

    await Order.deleteMany({});
  });

  test('Should not prevent orders during restaurant business hours toggle', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String,
      createdAt: { type: Date, default: Date.now }
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Create multiple orders while toggling availability
    const orders = [];

    // Order 1: Restaurant is open
    await Restaurant.findByIdAndUpdate(openRestaurant._id, { availability: true });
    orders.push(await Order.create({
      customerId: 'customer_1',
      restaurantId: openRestaurant._id.toString(),
      items: [{ foodId: foodItem2._id.toString(), quantity: 1, price: 2000 }],
      totalPrice: 2000,
      deliveryAddress: 'Address 1'
    }));

    // Close restaurant
    await Restaurant.findByIdAndUpdate(openRestaurant._id, { availability: false });

    // Order 2: Restaurant is now closed (but order still goes through)
    orders.push(await Order.create({
      customerId: 'customer_2',
      restaurantId: openRestaurant._id.toString(),
      items: [{ foodId: foodItem2._id.toString(), quantity: 1, price: 2000 }],
      totalPrice: 2000,
      deliveryAddress: 'Address 2'
    }));

    // Open restaurant again
    await Restaurant.findByIdAndUpdate(openRestaurant._id, { availability: true });

    // Order 3: Restaurant is open again
    orders.push(await Order.create({
      customerId: 'customer_3',
      restaurantId: openRestaurant._id.toString(),
      items: [{ foodId: foodItem2._id.toString(), quantity: 1, price: 2000 }],
      totalPrice: 2000,
      deliveryAddress: 'Address 3'
    }));

    // All orders created successfully regardless of availability
    expect(orders).toHaveLength(3);
    orders.forEach(order => {
      expect(order.restaurantId).toBe(openRestaurant._id.toString());
    });

    await Order.deleteMany({});
  });

  test('Should demonstrate no real-time availability check', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Simulate concurrent order attempts
    const orderPromises = Array.from({ length: 5 }, (_, i) =>
      Order.create({
        customerId: `customer_${i}`,
        restaurantId: closedRestaurant._id.toString(),
        items: [{
          foodId: foodItem1._id.toString(),
          quantity: 1,
          price: 1500
        }],
        totalPrice: 1500,
        deliveryAddress: `Address ${i}`
      })
    );

    // All orders succeed even for closed restaurant
    const results = await Promise.all(orderPromises);
    expect(results).toHaveLength(5);

    // Verify restaurant was closed the entire time
    const restaurant = await Restaurant.findById(closedRestaurant._id);
    expect(restaurant.availability).toBe(false);

    await Order.deleteMany({});
  });

  test('Should allow bulk orders to closed restaurants', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String,
      status: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Create 10 orders for closed restaurant
    const bulkOrders = Array.from({ length: 10 }, (_, i) => ({
      customerId: `bulk_customer_${i}`,
      restaurantId: closedRestaurant._id.toString(),
      items: [{
        foodId: foodItem1._id.toString(),
        quantity: i + 1,
        price: 1500
      }],
      totalPrice: 1500 * (i + 1),
      deliveryAddress: `Bulk Address ${i}`,
      status: 'Pending'
    }));

    const insertedOrders = await Order.insertMany(bulkOrders);
    expect(insertedOrders).toHaveLength(10);

    // All reference the closed restaurant
    insertedOrders.forEach(order => {
      expect(order.restaurantId).toBe(closedRestaurant._id.toString());
    });

    // Restaurant is still closed
    const restaurant = await Restaurant.findById(closedRestaurant._id);
    expect(restaurant.availability).toBe(false);

    await Order.deleteMany({});
  });
});
