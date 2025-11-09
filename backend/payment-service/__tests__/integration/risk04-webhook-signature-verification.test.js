const request = require("supertest");
const mongoose = require("mongoose");
const Payment = require("../../models/PaymentModel");

// Mock Stripe with webhook utilities - define mock before using it
let mockConstructEvent;
jest.mock("stripe", () => {
  mockConstructEvent = jest.fn();
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: "pi_webhook_test",
        client_secret: "pi_webhook_test_secret",
        status: "requires_payment_method",
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: "pi_webhook_test",
        status: "requires_payment_method",
      }),
      cancel: jest.fn().mockResolvedValue({ id: "pi_webhook_test", status: "canceled" }),
    },
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }));
});

// Mock Twilio
jest.mock("../../utils/twilioService", () => ({
  sendSmsNotification: jest.fn().mockResolvedValue(true),
}));

// Mock Email service
jest.mock("../../utils/emailService", () => ({
  sendEmailNotification: jest.fn().mockResolvedValue(true),
}));

const app = require("../../server");

describe("RISK-PAYMENT-04: Webhook Signature Verification Integration Tests", () => {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Restaurant";

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Payment.deleteMany({});
    mockConstructEvent.mockClear();
  });

  afterEach(async () => {
    await Payment.deleteMany({});
  });

  describe("Missing Webhook Secret Configuration", () => {
    it("should fail webhook verification when signature is missing (RISK-PAYMENT-04)", async () => {
      // Simulate webhook event without signature
      mockConstructEvent.mockImplementation(() => {
        throw new Error("No signatures found matching the expected signature for payload");
      });

      const webhookPayload = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_001",
            metadata: { orderId: "RISK04-ORD-001" },
          },
        },
      };

      const response = await request(app)
        .post("/api/payment/webhook")
        .send(webhookPayload)
        .set("Content-Type", "application/json");
        // No stripe-signature header

      // Should fail with 400
      expect(response.status).toBe(400);
      expect(response.text).toContain("Webhook Error");
    });

    it("should fail webhook verification with invalid signature (RISK-PAYMENT-04)", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Webhook signature verification failed");
      });

      const webhookPayload = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_002",
            metadata: { orderId: "RISK04-ORD-002" },
          },
        },
      };

      const response = await request(app)
        .post("/api/payment/webhook")
        .send(webhookPayload)
        .set("Content-Type", "application/json")
        .set("stripe-signature", "invalid_signature_here");

      expect(response.status).toBe(400);
      expect(response.text).toContain("Webhook Error");
    });

    it("should fail webhook verification with wrong secret (RISK-PAYMENT-04)", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("No signatures found matching the expected signature");
      });

      const webhookPayload = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_003",
            metadata: { orderId: "RISK04-ORD-003" },
          },
        },
      };

      const response = await request(app)
        .post("/api/payment/webhook")
        .send(webhookPayload)
        .set("Content-Type", "application/json")
        .set("stripe-signature", "t=1234567890,v1=wrong_hash,v0=other_hash");

      expect(response.status).toBe(400);
      expect(response.text).toContain("Webhook Error");
    });
  });

  describe("Valid Webhook Processing", () => {
    it("should process webhook successfully with valid signature (RISK-PAYMENT-04)", async () => {
      // Create payment record first
      const uniqueIntentId = `pi_valid_${Date.now()}_${Math.random()}`;
      await Payment.create({
        orderId: "RISK04-ORD-004",
        userId: "user123",
        amount: 50.0,
        currency: "usd",
        status: "Pending",
        email: "valid@example.com",
        phone: "+15551234567",
        stripePaymentIntentId: uniqueIntentId,
        stripeClientSecret: `${uniqueIntentId}_secret`,
      });

      // Mock successful verification
      mockConstructEvent.mockReturnValue({
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: uniqueIntentId,
            metadata: { orderId: "RISK04-ORD-004" },
          },
        },
      });

      const webhookPayload = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: uniqueIntentId,
            metadata: { orderId: "RISK04-ORD-004" },
          },
        },
      };

      const response = await request(app)
        .post("/api/payment/webhook")
        .send(webhookPayload)
        .set("Content-Type", "application/json")
        .set("stripe-signature", "t=1234567890,v1=valid_signature_hash");

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);

      // Wait a bit for async update
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify payment status updated
      const updatedPayment = await Payment.findOne({ orderId: "RISK04-ORD-004" });
      expect(updatedPayment).not.toBeNull();
      expect(updatedPayment.status).toBe("Paid");
    });

    it("should handle payment_intent.payment_failed with valid signature (RISK-PAYMENT-04)", async () => {
      // Create payment record
      const uniqueIntentId = `pi_failed_${Date.now()}_${Math.random()}`;
      await Payment.create({
        orderId: "RISK04-ORD-005",
        userId: "user456",
        amount: 30.0,
        currency: "usd",
        status: "Pending",
        email: "failed@example.com",
        phone: "+15559876543",
        stripePaymentIntentId: uniqueIntentId,
        stripeClientSecret: `${uniqueIntentId}_secret`,
      });

      // Mock successful verification for failed payment
      mockConstructEvent.mockReturnValue({
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: uniqueIntentId,
            metadata: { orderId: "RISK04-ORD-005" },
          },
        },
      });

      const webhookPayload = {
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: uniqueIntentId,
            metadata: { orderId: "RISK04-ORD-005" },
          },
        },
      };

      const response = await request(app)
        .post("/api/payment/webhook")
        .send(webhookPayload)
        .set("Content-Type", "application/json")
        .set("stripe-signature", "t=1234567890,v1=valid_signature");

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);

      // Wait a bit for async update
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify payment status updated to Failed
      const updatedPayment = await Payment.findOne({ orderId: "RISK04-ORD-005" });
      expect(updatedPayment).not.toBeNull();
      expect(updatedPayment.status).toBe("Failed");
    });
  });

  describe("Webhook Processing Without Payment Record", () => {
    it("should return 404 when payment record not found (RISK-PAYMENT-04)", async () => {
      // Mock successful signature verification
      mockConstructEvent.mockReturnValue({
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_not_found",
            metadata: { orderId: "NONEXISTENT-ORDER" },
          },
        },
      });

      const webhookPayload = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_not_found",
            metadata: { orderId: "NONEXISTENT-ORDER" },
          },
        },
      };

      const response = await request(app)
        .post("/api/payment/webhook")
        .send(webhookPayload)
        .set("Content-Type", "application/json")
        .set("stripe-signature", "t=1234567890,v1=valid_signature");

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("Payment record not found");
    });

    it("should return 404 when orderId missing in metadata (RISK-PAYMENT-04)", async () => {
      // Mock successful signature verification but no orderId
      mockConstructEvent.mockReturnValue({
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_no_metadata",
            metadata: {}, // Empty metadata - no orderId
          },
        },
      });

      const webhookPayload = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_no_metadata",
            metadata: {},
          },
        },
      };

      const response = await request(app)
        .post("/api/payment/webhook")
        .send(webhookPayload)
        .set("Content-Type", "application/json")
        .set("stripe-signature", "t=1234567890,v1=valid_signature");

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("Payment record not found");
    });
  });

  describe("Unhandled Webhook Events", () => {
    it("should handle unhandled event types gracefully (RISK-PAYMENT-04)", async () => {
      mockConstructEvent.mockReturnValue({
        type: "payment_intent.created",
        data: {
          object: {
            id: "pi_created",
            metadata: { orderId: "RISK04-ORD-006" },
          },
        },
      });

      const webhookPayload = {
        type: "payment_intent.created",
        data: {
          object: {
            id: "pi_created",
            metadata: { orderId: "RISK04-ORD-006" },
          },
        },
      };

      const response = await request(app)
        .post("/api/payment/webhook")
        .send(webhookPayload)
        .set("Content-Type", "application/json")
        .set("stripe-signature", "t=1234567890,v1=valid_signature");

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });
  });

  describe("Signature Verification Edge Cases", () => {
    it("should reject webhook with malformed signature header (RISK-PAYMENT-04)", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Unable to extract timestamp and signatures from header");
      });

      const webhookPayload = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_malformed",
            metadata: { orderId: "RISK04-ORD-007" },
          },
        },
      };

      const response = await request(app)
        .post("/api/payment/webhook")
        .send(webhookPayload)
        .set("Content-Type", "application/json")
        .set("stripe-signature", "malformed_signature_format");

      expect(response.status).toBe(400);
      expect(response.text).toContain("Webhook Error");
    });

    it("should reject webhook with expired timestamp (RISK-PAYMENT-04)", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Timestamp outside the tolerance zone");
      });

      const webhookPayload = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_expired",
            metadata: { orderId: "RISK04-ORD-008" },
          },
        },
      };

      const response = await request(app)
        .post("/api/payment/webhook")
        .send(webhookPayload)
        .set("Content-Type", "application/json")
        .set("stripe-signature", "t=1,v1=old_signature"); // Very old timestamp

      expect(response.status).toBe(400);
      expect(response.text).toContain("Webhook Error");
    });
  });
});
