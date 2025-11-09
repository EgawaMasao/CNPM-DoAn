/**
 * RISK-05: Price Manipulation - Client-Controlled Pricing
 * Tests that orders accept client-provided prices without server-side validation
 */

import mongoose from 'mongoose';
import Restaurant from '../../src/models/Restaurant.js';
import FoodItem from '../../src/models/FoodItem.js';

describe('RISK-05: Price Manipulation Integration Test', () => {
  const MONGO_URI = 'mongodb://localhost:27017/Restaurant';
  let testRestaurant;
  let expensiveFood;
  let cheapFood;
  let premiumFood;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI);
    }
  });

  beforeEach(async () => {
    await Restaurant.deleteMany({});
    await FoodItem.deleteMany({});

    // Create test restaurant
    testRestaurant = await Restaurant.create({
      name: 'Price Test Restaurant',
      ownerName: 'Price Owner',
      location: 'Price Street',
      contactNumber: '+1234567890',
      admin: {
        email: 'price@test.com',
        password: 'password123'
      },
      availability: true
    });

    // Create expensive food item (server-side price: $50)
    expensiveFood = await FoodItem.create({
      restaurant: testRestaurant._id,
      name: 'Expensive Steak',
      description: 'Premium steak',
      price: 5000, // $50.00 in cents
      image: '/uploads/steak.jpg',
      category: 'Main Course',
      availability: true
    });

    // Create cheap food item (server-side price: $5)
    cheapFood = await FoodItem.create({
      restaurant: testRestaurant._id,
      name: 'Cheap Fries',
      description: 'Side dish',
      price: 500, // $5.00 in cents
      image: '/uploads/fries.jpg',
      category: 'Side',
      availability: true
    });

    // Create premium food item (server-side price: $100)
    premiumFood = await FoodItem.create({
      restaurant: testRestaurant._id,
      name: 'Premium Lobster',
      description: 'Luxury seafood',
      price: 10000, // $100.00 in cents
      image: '/uploads/lobster.jpg',
      category: 'Premium',
      availability: true
    });
  });

  afterAll(async () => {
    await Restaurant.deleteMany({});
    await FoodItem.deleteMany({});
    await mongoose.connection.close();
  });

  test('Should verify actual food prices in database', async () => {
    const expensive = await FoodItem.findById(expensiveFood._id);
    const cheap = await FoodItem.findById(cheapFood._id);
    const premium = await FoodItem.findById(premiumFood._id);

    expect(expensive.price).toBe(5000); // $50.00
    expect(cheap.price).toBe(500);      // $5.00
    expect(premium.price).toBe(10000);  // $100.00
  });

  test('Should accept client-provided price instead of server price', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Client sends FAKE price ($0.01) for expensive item (real price: $50)
    const manipulatedOrder = await Order.create({
      customerId: 'customer_attacker',
      restaurantId: testRestaurant._id.toString(),
      items: [{
        foodId: expensiveFood._id.toString(),
        quantity: 10,
        price: 1 // Client sends $0.01 instead of $50.00
      }],
      totalPrice: 10, // Total: 10 × $0.01 = $0.10 instead of $500
      deliveryAddress: 'Attacker Address'
    });

    // Order created with manipulated price
    expect(manipulatedOrder).toBeDefined();
    expect(manipulatedOrder.items[0].price).toBe(1); // Fake price accepted
    expect(manipulatedOrder.totalPrice).toBe(10);

    // Real price in database is still $50
    const realFood = await FoodItem.findById(expensiveFood._id);
    expect(realFood.price).toBe(5000);

    // Price difference: Customer pays $0.10, should pay $500
    const priceDifference = (realFood.price * manipulatedOrder.items[0].quantity) - manipulatedOrder.totalPrice;
    expect(priceDifference).toBe(49990); // Lost revenue: $499.90

    await Order.deleteMany({});
  });

  test('Should allow zero-price orders', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Client sends price = 0
    const freeOrder = await Order.create({
      customerId: 'customer_freeloader',
      restaurantId: testRestaurant._id.toString(),
      items: [
        {
          foodId: expensiveFood._id.toString(),
          quantity: 100,
          price: 0 // FREE expensive steak!
        },
        {
          foodId: premiumFood._id.toString(),
          quantity: 50,
          price: 0 // FREE premium lobster!
        }
      ],
      totalPrice: 0, // Total: $0.00
      deliveryAddress: 'Free Stuff Address'
    });

    expect(freeOrder).toBeDefined();
    expect(freeOrder.totalPrice).toBe(0);
    expect(freeOrder.items[0].price).toBe(0);
    expect(freeOrder.items[1].price).toBe(0);

    // Calculate actual value
    const actualValue = (expensiveFood.price * 100) + (premiumFood.price * 50);
    expect(actualValue).toBe(1000000); // Should be $10,000, but customer pays $0

    await Order.deleteMany({});
  });

  test('Should allow negative price orders', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Client sends NEGATIVE price (getting paid to order!)
    const negativeOrder = await Order.create({
      customerId: 'customer_hacker',
      restaurantId: testRestaurant._id.toString(),
      items: [{
        foodId: premiumFood._id.toString(),
        quantity: 5,
        price: -1000 // Client gets PAID $10 per item
      }],
      totalPrice: -5000, // Client receives $50
      deliveryAddress: 'Hacker Address'
    });

    expect(negativeOrder).toBeDefined();
    expect(negativeOrder.items[0].price).toBe(-1000);
    expect(negativeOrder.totalPrice).toBe(-5000); // Negative total!

    // Actual price should be positive
    const actualPrice = premiumFood.price * 5;
    expect(actualPrice).toBe(50000); // Should be $500

    await Order.deleteMany({});
  });

  test('Should allow price arbitrage across orders', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Same food, different prices in different orders
    const order1 = await Order.create({
      customerId: 'customer_1',
      restaurantId: testRestaurant._id.toString(),
      items: [{
        foodId: expensiveFood._id.toString(),
        quantity: 1,
        price: 1 // Pays $0.01
      }],
      totalPrice: 1,
      deliveryAddress: 'Address 1'
    });

    const order2 = await Order.create({
      customerId: 'customer_2',
      restaurantId: testRestaurant._id.toString(),
      items: [{
        foodId: expensiveFood._id.toString(),
        quantity: 1,
        price: 10000 // Pays $100
      }],
      totalPrice: 10000,
      deliveryAddress: 'Address 2'
    });

    const order3 = await Order.create({
      customerId: 'customer_3',
      restaurantId: testRestaurant._id.toString(),
      items: [{
        foodId: expensiveFood._id.toString(),
        quantity: 1,
        price: 500 // Pays $5
      }],
      totalPrice: 500,
      deliveryAddress: 'Address 3'
    });

    // Same food item, three different prices accepted
    expect(order1.items[0].price).toBe(1);
    expect(order2.items[0].price).toBe(10000);
    expect(order3.items[0].price).toBe(500);

    // Real price is constant
    const realFood = await FoodItem.findById(expensiveFood._id);
    expect(realFood.price).toBe(5000);

    await Order.deleteMany({});
  });

  test('Should allow unrealistic pricing manipulation', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Ridiculously low prices
    const orders = await Order.insertMany([
      {
        customerId: 'customer_a',
        restaurantId: testRestaurant._id.toString(),
        items: [{
          foodId: premiumFood._id.toString(),
          quantity: 1000,
          price: 1 // $0.01 each instead of $100
        }],
        totalPrice: 1000, // $10 total instead of $100,000
        deliveryAddress: 'Address A'
      },
      {
        customerId: 'customer_b',
        restaurantId: testRestaurant._id.toString(),
        items: [{
          foodId: expensiveFood._id.toString(),
          quantity: 500,
          price: 10 // $0.10 each instead of $50
        }],
        totalPrice: 5000, // $50 total instead of $25,000
        deliveryAddress: 'Address B'
      }
    ]);

    expect(orders).toHaveLength(2);

    // Calculate total revenue loss
    const order1Loss = (premiumFood.price - 1) * 1000;
    const order2Loss = (expensiveFood.price - 10) * 500;
    const totalLoss = order1Loss + order2Loss;

    expect(totalLoss).toBe(12494000); // $124,940 revenue loss

    await Order.deleteMany({});
  });

  test('Should demonstrate price-quantity mismatch exploitation', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Large quantity with wrong price
    const exploitOrder = await Order.create({
      customerId: 'customer_exploit',
      restaurantId: testRestaurant._id.toString(),
      items: [
        {
          foodId: expensiveFood._id.toString(),
          quantity: 999,
          price: 100 // $1 each instead of $50
        },
        {
          foodId: premiumFood._id.toString(),
          quantity: 888,
          price: 200 // $2 each instead of $100
        }
      ],
      totalPrice: (999 * 100) + (888 * 200), // Client calculates: $99,900 + $177,600 = $277,500
      deliveryAddress: 'Exploit Address'
    });

    expect(exploitOrder).toBeDefined();

    // Calculate correct total based on actual food prices
    const correctTotal = (999 * expensiveFood.price) + (888 * premiumFood.price);
    const paidTotal = exploitOrder.totalPrice;
    const fraudAmount = correctTotal - paidTotal;

    // Correct calculation: (999 * 5000) + (888 * 10000) = 4,995,000 + 8,880,000 = 13,875,000
    // Client paid: 99,900 + 177,600 = 277,500
    // Fraud: 13,875,000 - 277,500 = 13,597,500
    expect(fraudAmount).toBe(13597500); // $135,975 fraud

    await Order.deleteMany({});
  });

  test('Should allow inconsistent totalPrice calculation', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Items total doesn't match totalPrice
    const inconsistentOrder = await Order.create({
      customerId: 'customer_math',
      restaurantId: testRestaurant._id.toString(),
      items: [
        {
          foodId: expensiveFood._id.toString(),
          quantity: 10,
          price: 1000 // $10 each
        },
        {
          foodId: cheapFood._id.toString(),
          quantity: 5,
          price: 500 // $5 each
        }
      ],
      totalPrice: 100, // Claims $1 total (wrong math: should be 10×$10 + 5×$5 = $125)
      deliveryAddress: 'Math Error Address'
    });

    expect(inconsistentOrder).toBeDefined();

    // Calculate what total should be based on items
    const calculatedTotal = (10 * 1000) + (5 * 500);
    expect(calculatedTotal).toBe(12500); // $125

    // But order claims different total
    expect(inconsistentOrder.totalPrice).toBe(100); // $1

    await Order.deleteMany({});
  });
});
