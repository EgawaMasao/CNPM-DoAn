const request = require("supertest");
const mongoose = require("mongoose");
const Payment = require("../../models/PaymentModel");

// Mock Stripe with tracking for idempotency keys - define mock before using it
let mockStripeCreate;
jest.mock("stripe", () => {
  mockStripeCreate = jest.fn();
  return jest.fn(() => ({
    paymentIntents: {
      create: mockStripeCreate,
      retrieve: jest.fn().mockResolvedValue({
        id: "pi_test_intent",
        status: "requires_payment_method",
      }),
      cancel: jest.fn().mockResolvedValue({ id: "pi_test_intent", status: "canceled" }),
    },
  }));
});

// Mock Twilio
jest.mock("../../utils/twilioService", () => ({
  sendSmsNotification: jest.fn().mockResolvedValue(true),
}));

const app = require("../../server");

describe("RISK-PAYMENT-10: No Idempotency Key Integration Tests", () => {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Restaurant";

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Payment.deleteMany({});
    mockStripeCreate.mockClear();
  });

  afterEach(async () => {
    await Payment.deleteMany({});
  });

  describe("Multiple PaymentIntents Created Without Idempotency", () => {
    it("should create multiple PaymentIntents on rapid retries (RISK-PAYMENT-10)", async () => {
      let callCount = 0;
      mockStripeCreate.mockImplementation((params) => {
        callCount++;
        // Verify no idempotency key is passed
        expect(params).not.toHaveProperty("idempotency_key");
        
        return Promise.resolve({
          id: `pi_retry_${callCount}`,
          client_secret: `pi_retry_${callCount}_secret`,
          status: "requires_payment_method",
        });
      });

      const paymentData = {
        orderId: "RISK10-ORD-001",
        userId: "user123",
        amount: "50.00",
        currency: "usd",
        email: "retry@example.com",
        phone: "+15551234567",
      };

      // Simulate rapid retries (e.g., due to network timeout or impatient user)
      const responses = await Promise.all([
        request(app).post("/api/payment/process").send(paymentData),
        request(app).post("/api/payment/process").send(paymentData),
        request(app).post("/api/payment/process").send(paymentData),
      ]);

      // Verify that some requests succeeded
      const successCount = responses.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      // Critical: Verify multiple Stripe API calls were made
      // Without idempotency keys, each retry creates a new PaymentIntent
      expect(mockStripeCreate).toHaveBeenCalled();
      
      // Check that no idempotency_key was passed in any call
      mockStripeCreate.mock.calls.forEach((call) => {
        const params = call[0];
        expect(params).not.toHaveProperty("idempotency_key");
      });
    });

    it("should verify different PaymentIntent IDs on sequential retries (RISK-PAYMENT-10)", async () => {
      let callCount = 0;
      mockStripeCreate.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          id: `pi_sequential_${callCount}`,
          client_secret: `pi_sequential_${callCount}_secret`,
          status: "requires_payment_method",
        });
      });

      const paymentData = {
        orderId: "RISK10-ORD-002",
        userId: "user456",
        amount: "75.00",
        currency: "usd",
        email: "sequential@example.com",
        phone: "+15559876543",
      };

      // First attempt
      const response1 = await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      expect(response1.body.clientSecret).toContain("pi_sequential_1");

      // Delete payment to simulate retry after timeout
      await Payment.deleteMany({ orderId: paymentData.orderId });

      // Second attempt (retry)
      const response2 = await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      expect(response2.body.clientSecret).toContain("pi_sequential_2");

      // Verify two different PaymentIntents were created
      expect(response1.body.clientSecret).not.toBe(response2.body.clientSecret);
      expect(mockStripeCreate).toHaveBeenCalledTimes(2);
    });

    it("should create duplicate PaymentIntents without idempotency protection (RISK-PAYMENT-10)", async () => {
      const createdIntents = [];
      mockStripeCreate.mockImplementation((params) => {
        const intentId = `pi_duplicate_${Date.now()}_${Math.random()}`;
        createdIntents.push(intentId);
        
        return Promise.resolve({
          id: intentId,
          client_secret: `${intentId}_secret`,
          status: "requires_payment_method",
        });
      });

      const paymentData = {
        orderId: "RISK10-ORD-003",
        userId: "user789",
        amount: "100.00",
        currency: "usd",
        email: "duplicate@example.com",
        phone: "+15551111111",
      };

      // Simulate client retrying due to timeout
      await request(app).post("/api/payment/process").send(paymentData);
      
      // Clean DB to allow "retry"
      await Payment.deleteMany({ orderId: paymentData.orderId });
      
      await request(app).post("/api/payment/process").send(paymentData);
      
      await Payment.deleteMany({ orderId: paymentData.orderId });
      
      await request(app).post("/api/payment/process").send(paymentData);

      // Verify multiple unique PaymentIntents were created
      expect(createdIntents.length).toBeGreaterThanOrEqual(3);
      expect(new Set(createdIntents).size).toBe(createdIntents.length); // All unique
    });
  });

  describe("Idempotency Key Absence Verification", () => {
    it("should verify Stripe API calls lack idempotency_key parameter (RISK-PAYMENT-10)", async () => {
      mockStripeCreate.mockResolvedValue({
        id: "pi_check_params",
        client_secret: "pi_check_params_secret",
        status: "requires_payment_method",
      });

      const paymentData = {
        orderId: "RISK10-ORD-004",
        userId: "user999",
        amount: "25.00",
        currency: "usd",
        email: "params@example.com",
        phone: "+15552222222",
      };

      await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Inspect the parameters passed to Stripe
      expect(mockStripeCreate).toHaveBeenCalledTimes(1);
      const stripeParams = mockStripeCreate.mock.calls[0][0];

      // Verify expected parameters are present
      expect(stripeParams).toHaveProperty("amount");
      expect(stripeParams).toHaveProperty("currency");
      expect(stripeParams).toHaveProperty("metadata");

      // Critical: Verify idempotency_key is NOT present
      expect(stripeParams).not.toHaveProperty("idempotency_key");
    });

    it("should verify no idempotency headers in Stripe client configuration (RISK-PAYMENT-10)", async () => {
      mockStripeCreate.mockResolvedValue({
        id: "pi_config_check",
        client_secret: "pi_config_check_secret",
        status: "requires_payment_method",
      });

      const paymentData = {
        orderId: "RISK10-ORD-005",
        userId: "user111",
        amount: "30.00",
        currency: "usd",
        email: "config@example.com",
        phone: "+15553333333",
      };

      await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Verify the call was made without idempotency protection
      const allCalls = mockStripeCreate.mock.calls;
      allCalls.forEach((call) => {
        const [params, options] = call;
        
        // Check params don't have idempotency_key
        expect(params).not.toHaveProperty("idempotency_key");
        
        // Check options (second parameter) doesn't have idempotencyKey
        if (options) {
          expect(options).not.toHaveProperty("idempotencyKey");
        }
      });
    });
  });

  describe("Race Condition Without Idempotency", () => {
    it("should allow multiple PaymentIntents for same order metadata (RISK-PAYMENT-10)", async () => {
      const intents = [];
      mockStripeCreate.mockImplementation((params) => {
        const intentId = `pi_race_${intents.length + 1}`;
        intents.push({ id: intentId, metadata: params.metadata });
        
        return Promise.resolve({
          id: intentId,
          client_secret: `${intentId}_secret`,
          status: "requires_payment_method",
        });
      });

      const paymentData = {
        orderId: "RISK10-ORD-006",
        userId: "user222",
        amount: "40.00",
        currency: "usd",
        email: "race@example.com",
        phone: "+15554444444",
      };

      // First request
      await request(app).post("/api/payment/process").send(paymentData);
      
      // Simulate race condition - delete and retry
      await Payment.deleteMany({ orderId: paymentData.orderId });
      
      // Second request with same orderId
      await request(app).post("/api/payment/process").send(paymentData);

      // Both PaymentIntents have same orderId in metadata but different IDs
      expect(intents.length).toBe(2);
      expect(intents[0].metadata.orderId).toBe("RISK10-ORD-006");
      expect(intents[1].metadata.orderId).toBe("RISK10-ORD-006");
      expect(intents[0].id).not.toBe(intents[1].id);
    });

    it("should demonstrate risk of double charging without idempotency (RISK-PAYMENT-10)", async () => {
      const createdPaymentIntents = [];
      
      mockStripeCreate.mockImplementation((params) => {
        const intent = {
          id: `pi_charge_${createdPaymentIntents.length + 1}`,
          client_secret: `pi_charge_${createdPaymentIntents.length + 1}_secret`,
          status: "requires_payment_method",
          amount: params.amount,
          metadata: params.metadata,
        };
        createdPaymentIntents.push(intent);
        return Promise.resolve(intent);
      });

      const paymentData = {
        orderId: "RISK10-ORD-007",
        userId: "user333",
        amount: "200.00",
        currency: "usd",
        email: "charge@example.com",
        phone: "+15555555555",
      };

      // User submits payment
      const response1 = await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Network timeout - user doesn't receive response
      // User retries submission
      await Payment.deleteMany({ orderId: paymentData.orderId });
      
      const response2 = await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Without idempotency keys, two different PaymentIntents exist
      expect(createdPaymentIntents.length).toBe(2);
      expect(response1.body.clientSecret).not.toBe(response2.body.clientSecret);

      // User could potentially complete payment on both intents
      expect(createdPaymentIntents[0].amount).toBe(20000); // $200.00
      expect(createdPaymentIntents[1].amount).toBe(20000); // $200.00
    });
  });

  describe("Impact on Payment Recovery", () => {
    it("should show confusion when multiple intents exist for one order (RISK-PAYMENT-10)", async () => {
      let intentCounter = 0;
      mockStripeCreate.mockImplementation(() => {
        intentCounter++;
        return Promise.resolve({
          id: `pi_confusion_${intentCounter}`,
          client_secret: `pi_confusion_${intentCounter}_secret`,
          status: "requires_payment_method",
        });
      });

      const paymentData = {
        orderId: "RISK10-ORD-008",
        userId: "user444",
        amount: "60.00",
        currency: "usd",
        email: "confusion@example.com",
        phone: "+15556666666",
      };

      // Create first payment
      const response1 = await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      const paymentId1 = response1.body.paymentId;

      // Simulate system issue - create another payment
      await Payment.deleteMany({ orderId: paymentData.orderId });
      
      const response2 = await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      const paymentId2 = response2.body.paymentId;

      // Two different payment records for same order
      expect(paymentId1).not.toBe(paymentId2);
      expect(mockStripeCreate).toHaveBeenCalledTimes(2);
    });

    it("should verify lack of request deduplication (RISK-PAYMENT-10)", async () => {
      const requestLog = [];
      
      mockStripeCreate.mockImplementation((params) => {
        requestLog.push({
          timestamp: Date.now(),
          orderId: params.metadata.orderId,
          amount: params.amount,
        });
        
        return Promise.resolve({
          id: `pi_dedup_${requestLog.length}`,
          client_secret: `pi_dedup_${requestLog.length}_secret`,
          status: "requires_payment_method",
        });
      });

      const paymentData = {
        orderId: "RISK10-ORD-009",
        userId: "user555",
        amount: "90.00",
        currency: "usd",
        email: "dedup@example.com",
        phone: "+15557777777",
      };

      // Rapid successive requests (network glitch scenario)
      for (let i = 0; i < 3; i++) {
        await request(app).post("/api/payment/process").send(paymentData);
        await Payment.deleteMany({ orderId: paymentData.orderId });
      }

      // All requests created new intents (no deduplication)
      expect(requestLog.length).toBe(3);
      expect(requestLog.every((r) => r.orderId === "RISK10-ORD-009")).toBe(true);
      expect(requestLog.every((r) => r.amount === 9000)).toBe(true);
    });
  });
});
