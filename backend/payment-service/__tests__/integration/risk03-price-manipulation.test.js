const request = require("supertest");
const mongoose = require("mongoose");
const Payment = require("../../models/PaymentModel");

// Mock Stripe - use "mock" prefix so Jest allows access in factory
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

// Import app AFTER mocks are defined
const app = require("../../server");

const describe = global.describe;
const it = global.it;
const expect = global.expect;
const beforeAll = global.beforeAll;
const afterAll = global.afterAll;
const beforeEach = global.beforeEach;
const afterEach = global.afterEach;

// Use mock prefix so Jest allows access
let mockUniqueCounter = 0;

describe("RISK-PAYMENT-03: Price Manipulation Integration Tests", () => {
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
    
    // Reset mock to return unique payment intent IDs using global counter
    mockStripeCreate.mockImplementation((params) => {
      mockUniqueCounter++;
      const now = Date.now();
      return Promise.resolve({
        id: `pi_manipulated_${now}_${mockUniqueCounter}`,
        client_secret: `pi_manipulated_${now}_${mockUniqueCounter}_secret`,
        status: "requires_payment_method",
      });
    });
  });

  afterEach(async () => {
    await Payment.deleteMany({});
  });

  describe("Client-Provided Amount Accepted Without Validation", () => {
    it("should accept manipulated low amount (0.01) from client (RISK-PAYMENT-03)", async () => {
      const manipulatedPayment = {
        orderId: "RISK03-ORD-001",
        userId: "attacker123",
        amount: "0.01", // Manipulated amount - should be $100 but attacker sends $0.01
        currency: "usd",
        email: "attacker@example.com",
        phone: "+15551234567",
      };

      const response = await request(app)
        .post("/api/payment/process")
        .send(manipulatedPayment)
        .expect(200);

      expect(response.body).toHaveProperty("clientSecret");

      // Verify Stripe was called with manipulated amount (1 cent instead of expected amount)
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1, // 0.01 * 100 = 1 cent
          currency: "usd",
        })
      );

      // Wait for DB
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify database stores the manipulated amount
      const paymentInDb = await Payment.findOne({ orderId: manipulatedPayment.orderId });
      expect(paymentInDb.amount).toBe(0.01);
    });

    it("should accept zero amount from client (RISK-PAYMENT-03)", async () => {
      const zeroPayment = {
        orderId: "RISK03-ORD-002",
        userId: "attacker456",
        amount: "0.00", // Zero amount
        currency: "usd",
        email: "zero@example.com",
        phone: "+15559876543",
      };

      const response = await request(app)
        .post("/api/payment/process")
        .send(zeroPayment)
        .expect(200);

      // Verify Stripe was called with zero amount
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 0, // 0.00 * 100 = 0 cents
          currency: "usd",
        })
      );

      // Wait for DB
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify database stores zero amount
      const paymentInDb = await Payment.findOne({ orderId: zeroPayment.orderId });
      expect(paymentInDb.amount).toBe(0);
    });

    it("should accept extremely high amount from client (RISK-PAYMENT-03)", async () => {
      const highPayment = {
        orderId: "RISK03-ORD-003",
        userId: "richuser789",
        amount: "999999.99", // Extremely high amount
        currency: "usd",
        email: "rich@example.com",
        phone: "+15551111111",
      };

      const response = await request(app)
        .post("/api/payment/process")
        .send(highPayment)
        .expect(200);

      // Verify Stripe was called with high amount
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 99999999, // 999999.99 * 100 cents
          currency: "usd",
        })
      );

      // Wait for DB
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify database stores high amount
      const paymentInDb = await Payment.findOne({ orderId: highPayment.orderId });
      expect(paymentInDb.amount).toBe(999999.99);
    });

    it("should accept negative amount string from client (RISK-PAYMENT-03)", async () => {
      const negativePayment = {
        orderId: "RISK03-ORD-004",
        userId: "attacker999",
        amount: "-50.00", // Negative amount
        currency: "usd",
        email: "negative@example.com",
        phone: "+15552222222",
      };

      const response = await request(app)
        .post("/api/payment/process")
        .send(negativePayment);

      // Server should either accept (bad) or reject (good)
      // If it accepts, it's a vulnerability
      if (response.status === 200) {
        expect(mockStripeCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: -5000, // -50.00 * 100
          })
        );
      }
    });

    it("should accept amount with many decimal places (RISK-PAYMENT-03)", async () => {
      const decimalPayment = {
        orderId: "RISK03-ORD-005",
        userId: "user111",
        amount: "12.3456789", // Many decimal places
        currency: "usd",
        email: "decimal@example.com",
        phone: "+15553333333",
      };

      const response = await request(app)
        .post("/api/payment/process")
        .send(decimalPayment)
        .expect(200);

      // Verify rounding behavior
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: expect.any(Number),
          currency: "usd",
        })
      );

      // Wait for DB
      await new Promise(resolve => setTimeout(resolve, 100));

      const paymentInDb = await Payment.findOne({ orderId: decimalPayment.orderId });
      expect(paymentInDb.amount).toBeCloseTo(12.3456789);
    });
  });

  describe("No Server-Side Price Validation", () => {
    it("should not validate amount against orderId or userId (RISK-PAYMENT-03)", async () => {
      // Scenario: Order should cost $100 but attacker sends $1
      const fraudPayment = {
        orderId: "EXPENSIVE-ORDER-001",
        userId: "normaluser",
        amount: "1.00", // Should be validated against actual order cost
        currency: "usd",
        email: "fraud@example.com",
        phone: "+15554444444",
      };

      const response = await request(app)
        .post("/api/payment/process")
        .send(fraudPayment)
        .expect(200);

      // No validation occurs - accepts any amount
      expect(response.body).toHaveProperty("clientSecret");
      
      // Wait for DB
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const paymentInDb = await Payment.findOne({ orderId: fraudPayment.orderId });
      expect(paymentInDb.amount).toBe(1.0);
    });

    it("should accept different amounts for same order on retry (RISK-PAYMENT-03)", async () => {
      let callCount = 0;
      mockStripeCreate.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          id: `pi_retry_${callCount}`,
          client_secret: `pi_retry_${callCount}_secret`,
          status: "requires_payment_method",
        });
      });

      // First attempt with correct amount
      await request(app)
        .post("/api/payment/process")
        .send({
          orderId: "RISK03-ORD-006",
          userId: "user222",
          amount: "100.00",
          currency: "usd",
          email: "retry1@example.com",
          phone: "+15555555555",
        })
        .expect(200);

      // Clean up to allow different amount
      await Payment.deleteMany({ orderId: "RISK03-ORD-006" });

      // Second attempt with manipulated amount - should be rejected but isn't
      const response = await request(app)
        .post("/api/payment/process")
        .send({
          orderId: "RISK03-ORD-006",
          userId: "user222",
          amount: "1.00", // Manipulated
          currency: "usd",
          email: "retry2@example.com",
          phone: "+15556666666",
        })
        .expect(200);

      expect(mockStripeCreate).toHaveBeenCalledTimes(2);
      
      // Verify second call has manipulated amount
      expect(mockStripeCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          amount: 100, // 1.00 * 100 cents
        })
      );
    });

    it("should accept amount as string without sanitization (RISK-PAYMENT-03)", async () => {
      const stringPayment = {
        orderId: "RISK03-ORD-007",
        userId: "user333",
        amount: "  25.00  ", // String with whitespace
        currency: "usd",
        email: "string@example.com",
        phone: "+15557777777",
      };

      const response = await request(app)
        .post("/api/payment/process")
        .send(stringPayment)
        .expect(200);

      // parseFloat should handle whitespace but no additional validation
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2500,
        })
      );
    });
  });

  describe("Currency Manipulation", () => {
    it("should accept any currency code from client (RISK-PAYMENT-03)", async () => {
      const currencyPayment = {
        orderId: "RISK03-ORD-008",
        userId: "user444",
        amount: "100.00",
        currency: "xyz", // Invalid currency
        email: "currency@example.com",
        phone: "+15558888888",
      };

      const response = await request(app)
        .post("/api/payment/process")
        .send(currencyPayment);

      // Server accepts any currency without validation
      if (response.status === 200) {
        expect(mockStripeCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            currency: "xyz",
          })
        );
      }
    });
  });
});
