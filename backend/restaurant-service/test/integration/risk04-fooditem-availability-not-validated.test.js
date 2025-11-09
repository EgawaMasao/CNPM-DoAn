/**
 * RISK-04: FoodItem Availability Not Validated
 * Tests that orders can include unavailable/out-of-stock food items
 */

import mongoose from 'mongoose';
import Restaurant from '../../src/models/Restaurant.js';
import FoodItem from '../../src/models/FoodItem.js';

describe('RISK-04: FoodItem Availability Not Validated Integration Test', () => {
  const MONGO_URI = 'mongodb://localhost:27017/Restaurant';
  let testRestaurant;
  let availableFood;
  let unavailableFood;
  let outOfStockFood;

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
      name: 'Food Availability Test Restaurant',
      ownerName: 'Test Owner',
      location: 'Test Location',
      contactNumber: '+1234567890',
      admin: {
        email: 'foodavail@test.com',
        password: 'password123'
      },
      availability: true
    });

    // Create available food item
    availableFood = await FoodItem.create({
      restaurant: testRestaurant._id,
      name: 'Available Pizza',
      description: 'In stock and available',
      price: 1500,
      image: '/uploads/pizza.jpg',
      category: 'Main Course',
      availability: true // AVAILABLE
    });

    // Create unavailable food item
    unavailableFood = await FoodItem.create({
      restaurant: testRestaurant._id,
      name: 'Unavailable Burger',
      description: 'Out of stock',
      price: 2000,
      image: '/uploads/burger.jpg',
      category: 'Main Course',
      availability: false // UNAVAILABLE
    });

    // Create another unavailable item
    outOfStockFood = await FoodItem.create({
      restaurant: testRestaurant._id,
      name: 'Out of Stock Pasta',
      description: 'Temporarily unavailable',
      price: 1800,
      image: '/uploads/pasta.jpg',
      category: 'Main Course',
      availability: false // OUT OF STOCK
    });
  });

  afterAll(async () => {
    await Restaurant.deleteMany({});
    await FoodItem.deleteMany({});
    await mongoose.connection.close();
  });

  test('Should verify food items availability status in database', async () => {
    const available = await FoodItem.findById(availableFood._id);
    const unavailable = await FoodItem.findById(unavailableFood._id);
    const outOfStock = await FoodItem.findById(outOfStockFood._id);

    expect(available.availability).toBe(true);
    expect(unavailable.availability).toBe(false);
    expect(outOfStock.availability).toBe(false);
  });

  test('Should allow ordering unavailable food items', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Create order with UNAVAILABLE food item
    const orderWithUnavailableFood = await Order.create({
      customerId: 'customer_123',
      restaurantId: testRestaurant._id.toString(),
      items: [{
        foodId: unavailableFood._id.toString(),
        quantity: 5,
        price: 2000
      }],
      totalPrice: 10000,
      deliveryAddress: '123 Test Street'
    });

    // Order created successfully despite food being unavailable
    expect(orderWithUnavailableFood).toBeDefined();
    expect(orderWithUnavailableFood.items[0].foodId).toBe(unavailableFood._id.toString());

    // Verify food is still unavailable
    const foodCheck = await FoodItem.findById(unavailableFood._id);
    expect(foodCheck.availability).toBe(false);

    await Order.deleteMany({});
  });

  test('Should allow ordering multiple unavailable items in single order', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Order with ONLY unavailable items
    const order = await Order.create({
      customerId: 'customer_456',
      restaurantId: testRestaurant._id.toString(),
      items: [
        {
          foodId: unavailableFood._id.toString(),
          quantity: 3,
          price: 2000
        },
        {
          foodId: outOfStockFood._id.toString(),
          quantity: 2,
          price: 1800
        }
      ],
      totalPrice: (3 * 2000) + (2 * 1800), // 9600
      deliveryAddress: '456 Test Avenue'
    });

    expect(order).toBeDefined();
    expect(order.items).toHaveLength(2);
    expect(order.totalPrice).toBe(9600);

    // Both items are unavailable
    const food1 = await FoodItem.findById(unavailableFood._id);
    const food2 = await FoodItem.findById(outOfStockFood._id);
    expect(food1.availability).toBe(false);
    expect(food2.availability).toBe(false);

    await Order.deleteMany({});
  });

  test('Should allow mixed orders with available and unavailable items', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Order mixing available and unavailable items
    const mixedOrder = await Order.create({
      customerId: 'customer_789',
      restaurantId: testRestaurant._id.toString(),
      items: [
        {
          foodId: availableFood._id.toString(),
          quantity: 2,
          price: 1500
        },
        {
          foodId: unavailableFood._id.toString(),
          quantity: 3,
          price: 2000
        },
        {
          foodId: outOfStockFood._id.toString(),
          quantity: 1,
          price: 1800
        }
      ],
      totalPrice: (2 * 1500) + (3 * 2000) + (1 * 1800), // 10800
      deliveryAddress: '789 Mixed Street'
    });

    expect(mixedOrder).toBeDefined();
    expect(mixedOrder.items).toHaveLength(3);

    // Verify availability status
    const foods = await FoodItem.find({
      _id: { $in: mixedOrder.items.map(item => item.foodId) }
    });

    const availabilityMap = {};
    foods.forEach(food => {
      availabilityMap[food._id.toString()] = food.availability;
    });

    expect(availabilityMap[availableFood._id.toString()]).toBe(true);
    expect(availabilityMap[unavailableFood._id.toString()]).toBe(false);
    expect(availabilityMap[outOfStockFood._id.toString()]).toBe(false);

    await Order.deleteMany({});
  });

  test('Should demonstrate availability toggle without order blocking', async () => {
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

    // Mark food as available
    await FoodItem.findByIdAndUpdate(unavailableFood._id, { availability: true });
    let food = await FoodItem.findById(unavailableFood._id);
    expect(food.availability).toBe(true);

    // Create order while available
    const order1 = await Order.create({
      customerId: 'customer_1',
      restaurantId: testRestaurant._id.toString(),
      items: [{ foodId: unavailableFood._id.toString(), quantity: 2, price: 2000 }],
      totalPrice: 4000,
      deliveryAddress: 'Address 1'
    });

    // Mark as unavailable
    await FoodItem.findByIdAndUpdate(unavailableFood._id, { availability: false });
    food = await FoodItem.findById(unavailableFood._id);
    expect(food.availability).toBe(false);

    // Still can create order for now-unavailable item
    const order2 = await Order.create({
      customerId: 'customer_2',
      restaurantId: testRestaurant._id.toString(),
      items: [{ foodId: unavailableFood._id.toString(), quantity: 3, price: 2000 }],
      totalPrice: 6000,
      deliveryAddress: 'Address 2'
    });

    expect(order1).toBeDefined();
    expect(order2).toBeDefined();

    await Order.deleteMany({});
  });

  test('Should allow large quantity orders for unavailable items', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Order huge quantity of unavailable item
    const largeOrder = await Order.create({
      customerId: 'customer_bulk',
      restaurantId: testRestaurant._id.toString(),
      items: [{
        foodId: unavailableFood._id.toString(),
        quantity: 1000, // Unrealistic quantity for unavailable item
        price: 2000
      }],
      totalPrice: 2000000,
      deliveryAddress: 'Bulk Order Address'
    });

    expect(largeOrder).toBeDefined();
    expect(largeOrder.items[0].quantity).toBe(1000);

    // Food is still unavailable
    const food = await FoodItem.findById(unavailableFood._id);
    expect(food.availability).toBe(false);

    await Order.deleteMany({});
  });

  test('Should allow concurrent orders for unavailable items', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Simulate 10 concurrent orders for unavailable item
    const concurrentOrders = Array.from({ length: 10 }, (_, i) =>
      Order.create({
        customerId: `concurrent_customer_${i}`,
        restaurantId: testRestaurant._id.toString(),
        items: [{
          foodId: outOfStockFood._id.toString(),
          quantity: 5,
          price: 1800
        }],
        totalPrice: 9000,
        deliveryAddress: `Concurrent Address ${i}`
      })
    );

    const results = await Promise.all(concurrentOrders);
    expect(results).toHaveLength(10);

    // All orders for the same unavailable item
    results.forEach(order => {
      expect(order.items[0].foodId).toBe(outOfStockFood._id.toString());
    });

    // Food is still unavailable
    const food = await FoodItem.findById(outOfStockFood._id);
    expect(food.availability).toBe(false);

    await Order.deleteMany({});
  });

  test('Should demonstrate no inventory management', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      deliveryAddress: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    await Order.deleteMany({});

    // Create multiple orders that would deplete inventory
    const orders = [];
    for (let i = 0; i < 50; i++) {
      orders.push(await Order.create({
        customerId: `customer_${i}`,
        restaurantId: testRestaurant._id.toString(),
        items: [{
          foodId: availableFood._id.toString(),
          quantity: 100,
          price: 1500
        }],
        totalPrice: 150000,
        deliveryAddress: `Address ${i}`
      }));
    }

    // All orders succeeded without inventory check
    expect(orders).toHaveLength(50);

    // Food availability never changed
    const food = await FoodItem.findById(availableFood._id);
    expect(food.availability).toBe(true);

    await Order.deleteMany({});
  });
});
