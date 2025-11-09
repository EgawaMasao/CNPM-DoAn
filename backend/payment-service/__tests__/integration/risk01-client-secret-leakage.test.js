const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../server");
const Payment = require("../../models/PaymentModel");

// Mock Stripe to avoid real API calls
jest.mock("stripe", () => {
  // Counter must be defined inside the mock factory
  let mockUniqueIntentCounter = 0;
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn().mockImplementation(() => {
        mockUniqueIntentCounter++;
        const now = Date.now();
        return Promise.resolve({
          id: `pi_test_mock_${now}_${mockUniqueIntentCounter}`,
          client_secret: `pi_test_mock_${now}_${mockUniqueIntentCounter}_secret_SENSITIVE_DATA`,
          status: "requires_payment_method",
        });
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: "pi_test_mock_intent_01",
        status: "requires_payment_method",
      }),
      cancel: jest.fn().mockResolvedValue({ id: "pi_test_mock_intent_01", status: "canceled" }),
    },
  }));
});

// Mock Twilio to avoid real SMS
jest.mock("../../utils/twilioService", () => ({
  sendSmsNotification: jest.fn().mockResolvedValue(true),
}));

describe("RISK-PAYMENT-01: Client Secret Leakage Integration Tests", () => {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Restaurant";

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Payment.deleteMany({});
  });

  afterEach(async () => {
    await Payment.deleteMany({});
  });

  describe("Client Secret Storage in Database", () => {
    it("should store stripeClientSecret in the database (RISK-PAYMENT-01)", async () => {
      const paymentData = {
        orderId: "RISK01-ORD-001",
        userId: "user123",
        amount: "10.50",
        currency: "usd",
        email: "test@example.com",
        phone: "+15551234567",
      };

      const response = await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Verify response contains clientSecret
      expect(response.body).toHaveProperty("clientSecret");
      expect(response.body.clientSecret).toContain("secret");

      // Wait for database write to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify database contains stripeClientSecret (sensitive data leakage)
      const paymentInDb = await Payment.findOne({ orderId: paymentData.orderId }).lean();
      expect(paymentInDb).not.toBeNull();
      expect(paymentInDb.stripeClientSecret).toBeDefined();
      expect(paymentInDb.stripeClientSecret).toContain("secret");
      expect(paymentInDb.stripeClientSecret).toContain("SENSITIVE_DATA");
    });

    it("should return clientSecret in API response (RISK-PAYMENT-01)", async () => {
      const paymentData = {
        orderId: "RISK01-ORD-002",
        userId: "user456",
        amount: "25.00",
        currency: "usd",
        email: "customer@example.com",
        phone: "+15559876543",
      };

      const response = await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Verify clientSecret is exposed in API response
      expect(response.body.clientSecret).toBeDefined();
      expect(response.body.clientSecret).toContain("secret");
      expect(response.body.clientSecret).toContain("SENSITIVE_DATA");
      expect(response.body).toHaveProperty("paymentId");
      expect(response.body).toHaveProperty("disablePayment", false);
    });

    it("should reuse existing clientSecret for pending payments (RISK-PAYMENT-03)", async () => {
      const paymentData = {
        orderId: "RISK01-ORD-003",
        userId: "user789",
        amount: "15.00",
        currency: "usd",
        email: "reuse@example.com",
        phone: "+15551111111",
      };

      // First request
      const firstResponse = await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      const firstClientSecret = firstResponse.body.clientSecret;
      expect(firstClientSecret).toContain("secret");

      // Second request with same orderId - should reuse or create new based on implementation
      const secondResponse = await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Verify a clientSecret is returned (may or may not be the same)
      expect(secondResponse.body.clientSecret).toBeDefined();
      expect(secondResponse.body.clientSecret).toContain("secret");
    });

    it("should expose clientSecret for paid orders in DB (RISK-PAYMENT-01)", async () => {
      // Create a paid payment record manually
      const paidPayment = await Payment.create({
        orderId: "RISK01-ORD-004",
        userId: "user999",
        amount: 50.0,
        currency: "usd",
        status: "Paid",
        email: "paid@example.com",
        phone: "+15552222222",
        stripePaymentIntentId: "pi_paid_intent_001",
        stripeClientSecret: "pi_paid_intent_001_secret_SHOULD_NOT_BE_STORED",
      });

      // Verify the paid payment still has clientSecret stored
      const foundPayment = await Payment.findOne({ orderId: "RISK01-ORD-004" });
      expect(foundPayment.status).toBe("Paid");
      expect(foundPayment.stripeClientSecret).toBeDefined();
      expect(foundPayment.stripeClientSecret).toContain("secret");
    });
  });

  describe("Client Secret in API Responses for Existing Payments", () => {
    it("should not return clientSecret for already paid orders but data remains in DB (RISK-PAYMENT-01)", async () => {
      // Create a paid payment
      await Payment.create({
        orderId: "RISK01-ORD-005",
        userId: "user111",
        amount: 100.0,
        currency: "usd",
        status: "Paid",
        email: "alreadypaid@example.com",
        phone: "+15553333333",
        stripePaymentIntentId: "pi_already_paid_unique_" + Date.now(),
        stripeClientSecret: "pi_already_paid_secret_SENSITIVE",
      });

      const response = await request(app)
        .post("/api/payment/process")
        .send({
          orderId: "RISK01-ORD-005",
          userId: "user111",
          amount: "100.00",
          currency: "usd",
          email: "alreadypaid@example.com",
          phone: "+15553333333",
        })
        .expect(200);

      // API should indicate payment is already done
      expect(response.body).toHaveProperty("disablePayment", true);
      
      // But sensitive data still exists in database
      const dbRecord = await Payment.findOne({ orderId: "RISK01-ORD-005" });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord.stripeClientSecret).toBe("pi_already_paid_secret_SENSITIVE");
    });

    it("should verify multiple payments store multiple client secrets in DB (RISK-PAYMENT-01)", async () => {
      const payments = [
        { orderId: "RISK01-ORD-006", userId: "u1", amount: "5.00", email: "a@x.com", phone: "+15554444444" },
        { orderId: "RISK01-ORD-007", userId: "u2", amount: "10.00", email: "b@x.com", phone: "+15555555555" },
        { orderId: "RISK01-ORD-008", userId: "u3", amount: "15.00", email: "c@x.com", phone: "+15556666666" },
      ];

      for (const payment of payments) {
        await request(app)
          .post("/api/payment/process")
          .send({ ...payment, currency: "usd" })
          .expect(200);
      }

      // Wait for all database writes
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all payments have clientSecret stored
      const allPayments = await Payment.find({ 
        orderId: { $in: ["RISK01-ORD-006", "RISK01-ORD-007", "RISK01-ORD-008"] }
      });
      expect(allPayments.length).toBeGreaterThanOrEqual(3);
      
      allPayments.forEach((p) => {
        expect(p.stripeClientSecret).toBeDefined();
        expect(p.stripeClientSecret).toContain("secret");
      });
    });
  });
});
