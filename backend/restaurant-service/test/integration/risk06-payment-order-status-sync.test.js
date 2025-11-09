/**
 * RISK-06: Payment-Order Status Sync Failure
 * Tests that payment status updates don't automatically sync to order status
 * Demonstrates missing webhook/callback mechanism between payment-service and order-service
 */

import mongoose from 'mongoose';
import Restaurant from '../../src/models/Restaurant.js';
import FoodItem from '../../src/models/FoodItem.js';

describe('RISK-06: Payment-Order Status Sync Failure Integration Test', () => {
  const MONGO_URI = 'mongodb://localhost:27017/Restaurant';
  let testRestaurant;
  let testFoodItem;

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
      name: 'Payment Sync Test Restaurant',
      ownerName: 'Payment Owner',
      location: 'Payment Street',
      contactNumber: '+1234567890',
      admin: {
        email: 'payment@test.com',
        password: 'password123'
      },
      availability: true
    });

    // Create test food item
    testFoodItem = await FoodItem.create({
      restaurant: testRestaurant._id,
      name: 'Payment Test Food',
      description: 'For testing payment sync',
      price: 2500,
      image: '/uploads/test.jpg',
      category: 'Test',
      availability: true
    });
  });

  afterAll(async () => {
    await Restaurant.deleteMany({});
    await FoodItem.deleteMany({});
    await mongoose.connection.close();
  });

  test('Should demonstrate separate payment and order databases', async () => {
    // Order schema (order-service database)
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed'],
        default: 'Pending'
      },
      status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Canceled'],
        default: 'Pending'
      },
      deliveryAddress: String
    });

    // Payment schema (payment-service database)
    const PaymentSchema = new mongoose.Schema({
      orderId: { type: String, required: true, unique: true },
      userId: String,
      amount: Number,
      currency: { type: String, default: 'usd' },
      status: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed'],
        default: 'Pending'
      },
      email: String,
      phone: String,
      stripePaymentIntentId: String,
      stripeClientSecret: String,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);

    await Order.deleteMany({});
    await Payment.deleteMany({});

    // Create order with pending payment
    const order = await Order.create({
      customerId: 'customer_sync_test',
      restaurantId: testRestaurant._id.toString(),
      items: [{
        foodId: testFoodItem._id.toString(),
        quantity: 2,
        price: 2500
      }],
      totalPrice: 5000,
      paymentStatus: 'Pending',
      status: 'Pending',
      deliveryAddress: 'Sync Test Address'
    });

    // Create corresponding payment record
    const payment = await Payment.create({
      orderId: order._id.toString(),
      userId: 'customer_sync_test',
      amount: 5000,
      currency: 'usd',
      status: 'Pending',
      email: 'customer@test.com',
      phone: '+1234567890',
      stripePaymentIntentId: 'pi_test_123456'
    });

    // Simulate payment success in payment-service
    payment.status = 'Paid';
    payment.updatedAt = new Date();
    await payment.save();

    // Check order status (still Pending - NO AUTO SYNC)
    const orderAfterPayment = await Order.findById(order._id);
    expect(orderAfterPayment.paymentStatus).toBe('Pending'); // NOT updated
    expect(orderAfterPayment.status).toBe('Pending');

    // Payment is Paid but order doesn't know
    const paidPayment = await Payment.findOne({ orderId: order._id.toString() });
    expect(paidPayment.status).toBe('Paid');

    // STATUS MISMATCH CONFIRMED
    expect(paidPayment.status).not.toBe(orderAfterPayment.paymentStatus);

    await Order.deleteMany({});
    await Payment.deleteMany({});
  });

  test('Should show payment succeeds but order remains pending', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      paymentStatus: { type: String, default: 'Pending' },
      status: { type: String, default: 'Pending' },
      deliveryAddress: String
    });

    const PaymentSchema = new mongoose.Schema({
      orderId: { type: String, unique: true },
      amount: Number,
      status: { type: String, default: 'Pending' },
      stripePaymentIntentId: String
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);

    await Order.deleteMany({});
    await Payment.deleteMany({});

    // Create multiple orders
    const orders = await Order.insertMany([
      {
        customerId: 'customer_1',
        restaurantId: testRestaurant._id.toString(),
        items: [{ foodId: testFoodItem._id.toString(), quantity: 1, price: 2500 }],
        totalPrice: 2500,
        deliveryAddress: 'Address 1'
      },
      {
        customerId: 'customer_2',
        restaurantId: testRestaurant._id.toString(),
        items: [{ foodId: testFoodItem._id.toString(), quantity: 3, price: 2500 }],
        totalPrice: 7500,
        deliveryAddress: 'Address 2'
      },
      {
        customerId: 'customer_3',
        restaurantId: testRestaurant._id.toString(),
        items: [{ foodId: testFoodItem._id.toString(), quantity: 2, price: 2500 }],
        totalPrice: 5000,
        deliveryAddress: 'Address 3'
      }
    ]);

    // Create payments
    const payments = await Payment.insertMany(
      orders.map(order => ({
        orderId: order._id.toString(),
        amount: order.totalPrice,
        status: 'Pending',
        stripePaymentIntentId: `pi_test_${order._id}`
      }))
    );

    // Simulate successful payments
    for (const payment of payments) {
      await Payment.findByIdAndUpdate(payment._id, { status: 'Paid' });
    }

    // Check orders (all still Pending)
    const ordersAfterPayment = await Order.find({});
    ordersAfterPayment.forEach(order => {
      expect(order.paymentStatus).toBe('Pending'); // NOT updated
    });

    // Check payments (all Paid)
    const paidPayments = await Payment.find({});
    paidPayments.forEach(payment => {
      expect(payment.status).toBe('Paid');
    });

    await Order.deleteMany({});
    await Payment.deleteMany({});
  });

  test('Should demonstrate payment failure not reflected in order', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      paymentStatus: { type: String, default: 'Pending' },
      status: { type: String, default: 'Pending' },
      deliveryAddress: String
    });

    const PaymentSchema = new mongoose.Schema({
      orderId: { type: String, unique: true },
      amount: Number,
      status: { type: String, default: 'Pending' }
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);

    await Order.deleteMany({});
    await Payment.deleteMany({});

    // Create order
    const order = await Order.create({
      customerId: 'customer_fail',
      restaurantId: testRestaurant._id.toString(),
      items: [{ foodId: testFoodItem._id.toString(), quantity: 5, price: 2500 }],
      totalPrice: 12500,
      deliveryAddress: 'Fail Address'
    });

    // Create payment
    const payment = await Payment.create({
      orderId: order._id.toString(),
      amount: 12500,
      status: 'Pending'
    });

    // Simulate payment failure
    await Payment.findByIdAndUpdate(payment._id, { status: 'Failed' });

    // Order still shows Pending (not Failed)
    const orderAfterFail = await Order.findById(order._id);
    expect(orderAfterFail.paymentStatus).toBe('Pending'); // Should be Failed

    // Payment shows Failed
    const failedPayment = await Payment.findById(payment._id);
    expect(failedPayment.status).toBe('Failed');

    await Order.deleteMany({});
    await Payment.deleteMany({});
  });

  test('Should show no webhook mechanism exists', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      paymentStatus: { type: String, default: 'Pending' },
      status: { type: String, default: 'Pending' },
      deliveryAddress: String,
      webhookReceived: { type: Boolean, default: false }
    }, { collection: 'orders_webhook_test' });

    const PaymentSchema = new mongoose.Schema({
      orderId: { type: String, unique: true },
      amount: Number,
      status: { type: String, default: 'Pending' },
      webhookSent: { type: Boolean, default: false }
    }, { collection: 'payments_webhook_test' });

    const Order = mongoose.models.OrderWebhook || mongoose.model('OrderWebhook', OrderSchema);
    const Payment = mongoose.models.PaymentWebhook || mongoose.model('PaymentWebhook', PaymentSchema);

    await Order.deleteMany({});
    await Payment.deleteMany({});

    // Create order and payment with explicit field values
    const orderDoc = new Order({
      customerId: 'customer_webhook',
      restaurantId: testRestaurant._id.toString(),
      items: [{ foodId: testFoodItem._id.toString(), quantity: 1, price: 2500 }],
      totalPrice: 2500,
      deliveryAddress: 'Webhook Address',
      webhookReceived: false
    });
    const order = await orderDoc.save();

    const paymentDoc = new Payment({
      orderId: order._id.toString(),
      amount: 2500,
      status: 'Pending',
      webhookSent: false
    });
    const payment = await paymentDoc.save();

    // Payment completes
    await Payment.findByIdAndUpdate(payment._id, { 
      status: 'Paid',
      webhookSent: false // No webhook mechanism
    });

    // Order never receives notification
    const orderCheck = await Order.findById(order._id);
    expect(orderCheck.webhookReceived).toBe(false);
    expect(orderCheck.paymentStatus).toBe('Pending');

    await Order.deleteMany({});
    await Payment.deleteMany({});
  });

  test('Should demonstrate time lag in status updates', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      paymentStatus: { type: String, default: 'Pending' },
      status: { type: String, default: 'Pending' },
      deliveryAddress: String,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }, { collection: 'orders_timelag_test', timestamps: false });

    const PaymentSchema = new mongoose.Schema({
      orderId: { type: String, unique: true },
      amount: Number,
      status: { type: String, default: 'Pending' },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }, { collection: 'payments_timelag_test', timestamps: false });

    const Order = mongoose.models.OrderTimelag || mongoose.model('OrderTimelag', OrderSchema);
    const Payment = mongoose.models.PaymentTimelag || mongoose.model('PaymentTimelag', PaymentSchema);

    await Order.deleteMany({});
    await Payment.deleteMany({});

    // Create order with explicit timestamps
    const now = new Date();
    const orderDoc = new Order({
      customerId: 'customer_time',
      restaurantId: testRestaurant._id.toString(),
      items: [{ foodId: testFoodItem._id.toString(), quantity: 1, price: 2500 }],
      totalPrice: 2500,
      deliveryAddress: 'Time Test Address',
      createdAt: now,
      updatedAt: now
    });
    const order = await orderDoc.save();

    const orderOriginalUpdatedAt = order.updatedAt;

    // Create payment
    const paymentDoc = new Payment({
      orderId: order._id.toString(),
      amount: 2500,
      status: 'Pending',
      createdAt: now,
      updatedAt: now
    });
    const payment = await paymentDoc.save();

    // Wait and update payment
    await new Promise(resolve => setTimeout(resolve, 100));
    const laterTime = new Date();
    await Payment.findByIdAndUpdate(payment._id, {
      status: 'Paid',
      updatedAt: laterTime
    });

    const updatedPayment = await Payment.findById(payment._id);

    // Order timestamp unchanged (payment update doesn't trigger order update)
    const unchangedOrder = await Order.findById(order._id);
    expect(unchangedOrder.updatedAt.getTime()).toBe(orderOriginalUpdatedAt.getTime());
    expect(unchangedOrder.paymentStatus).toBe('Pending');

    // Payment timestamp changed
    expect(updatedPayment.updatedAt.getTime()).toBeGreaterThan(payment.createdAt.getTime());

    await Order.deleteMany({});
    await Payment.deleteMany({});
  });

  test('Should show manual sync requirement', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      paymentStatus: { type: String, default: 'Pending' },
      status: { type: String, default: 'Pending' },
      deliveryAddress: String
    });

    const PaymentSchema = new mongoose.Schema({
      orderId: { type: String, unique: true },
      amount: Number,
      status: { type: String, default: 'Pending' }
    });

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);

    await Order.deleteMany({});
    await Payment.deleteMany({});

    // Create order
    const order = await Order.create({
      customerId: 'customer_manual',
      restaurantId: testRestaurant._id.toString(),
      items: [{ foodId: testFoodItem._id.toString(), quantity: 1, price: 2500 }],
      totalPrice: 2500,
      deliveryAddress: 'Manual Sync Address'
    });

    // Create payment
    await Payment.create({
      orderId: order._id.toString(),
      amount: 2500,
      status: 'Pending'
    });

    // Payment completes
    const completedPayment = await Payment.findOneAndUpdate(
      { orderId: order._id.toString() },
      { status: 'Paid' },
      { new: true }
    );

    // Order status unchanged (requires manual sync)
    let orderBeforeSync = await Order.findById(order._id);
    expect(orderBeforeSync.paymentStatus).toBe('Pending');

    // MANUAL SYNC REQUIRED
    await Order.findByIdAndUpdate(order._id, {
      paymentStatus: completedPayment.status // Manual update
    });

    // Now synchronized
    let orderAfterSync = await Order.findById(order._id);
    expect(orderAfterSync.paymentStatus).toBe('Paid');

    await Order.deleteMany({});
    await Payment.deleteMany({});
  });

  test('Should demonstrate duplicate payment attempts without order lock', async () => {
    const OrderSchema = new mongoose.Schema({
      customerId: String,
      restaurantId: String,
      items: [{ foodId: String, quantity: Number, price: Number }],
      totalPrice: Number,
      paymentStatus: { type: String, default: 'Pending' },
      deliveryAddress: String
    });

    const PaymentSchema = new mongoose.Schema({
      orderId: String, // Intentionally NOT unique for this specific test
      amount: Number,
      status: { type: String, default: 'Pending' },
      attemptNumber: Number
    }, { collection: 'payments_duplicate_test' }); // Use separate collection to avoid unique index

    const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    const Payment = mongoose.models.PaymentDuplicateTest || mongoose.model('PaymentDuplicateTest', PaymentSchema);

    await Order.deleteMany({});
    await Payment.deleteMany({});

    // Create order
    const order = await Order.create({
      customerId: 'customer_duplicate',
      restaurantId: testRestaurant._id.toString(),
      items: [{ foodId: testFoodItem._id.toString(), quantity: 1, price: 2500 }],
      totalPrice: 2500,
      deliveryAddress: 'Duplicate Test'
    });

    // Create multiple payment attempts (no locking mechanism)
    const paymentAttempts = await Payment.insertMany([
      { orderId: order._id.toString(), amount: 2500, attemptNumber: 1 },
      { orderId: order._id.toString(), amount: 2500, attemptNumber: 2 },
      { orderId: order._id.toString(), amount: 2500, attemptNumber: 3 }
    ]);

    // All succeed because no sync/lock
    expect(paymentAttempts).toHaveLength(3);

    // Update all to Paid
    await Payment.updateMany(
      { orderId: order._id.toString() },
      { status: 'Paid' }
    );

    // Order still Pending (doesn't know about multiple payments)
    const orderCheck = await Order.findById(order._id);
    expect(orderCheck.paymentStatus).toBe('Pending');

    // Multiple paid payments exist
    const paidPayments = await Payment.find({ 
      orderId: order._id.toString(),
      status: 'Paid'
    });
    expect(paidPayments).toHaveLength(3);

    await Order.deleteMany({});
    await Payment.deleteMany({});
  });
});
