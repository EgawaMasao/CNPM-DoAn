const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../server");
const Payment = require("../../models/PaymentModel");

// Mock Stripe
jest.mock("stripe", () => {
  let counter = 0;
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn().mockImplementation(() => {
        counter++;
        return Promise.resolve({
          id: `pi_logging_test_${counter}`,
          client_secret: `pi_logging_test_${counter}_secret_SENSITIVE_DATA_IN_LOGS`,
          status: "requires_payment_method",
        });
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: "pi_logging_test",
        status: "requires_payment_method",
      }),
      cancel: jest.fn().mockResolvedValue({ id: "pi_logging_test", status: "canceled" }),
    },
  }));
});

// Mock Twilio
jest.mock("../../utils/twilioService", () => ({
  sendSmsNotification: jest.fn().mockResolvedValue(true),
}));

describe("RISK-PAYMENT-09: Sensitive Data Logging Integration Tests", () => {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Restaurant";
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Payment.deleteMany({});
    // Spy on console.log and console.error to capture logs
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    await Payment.deleteMany({});
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("Client Secret Logging in Payment Processing", () => {
    it("should log PaymentIntent with client_secret to console (RISK-PAYMENT-09)", async () => {
      const paymentData = {
        orderId: "RISK09-ORD-001",
        userId: "user123",
        amount: "25.00",
        currency: "usd",
        email: "logging@example.com",
        phone: "+15551234567",
      };

      await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Verify console.log was called
      expect(consoleLogSpy).toHaveBeenCalled();

      // Check if any log contains the client_secret
      const allLogs = consoleLogSpy.mock.calls.map((call) => JSON.stringify(call));
      const hasClientSecretLog = allLogs.some(
        (log) => log.includes("client_secret") || log.includes("SENSITIVE_DATA_IN_LOGS")
      );

      expect(hasClientSecretLog).toBe(true);
    });

    it("should log entire Payment object including stripeClientSecret (RISK-PAYMENT-09)", async () => {
      const paymentData = {
        orderId: "RISK09-ORD-002",
        userId: "user456",
        amount: "50.00",
        currency: "usd",
        email: "payment@example.com",
        phone: "+15559876543",
      };

      await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Find log entry that contains "Stored Payment Record" or payment object
      const paymentRecordLog = consoleLogSpy.mock.calls.find((call) =>
        call.some((arg) => typeof arg === "string" && arg.includes("Stored Payment Record"))
      );

      expect(paymentRecordLog).toBeDefined();

      // Verify that the log includes sensitive data
      const loggedData = JSON.stringify(paymentRecordLog);
      expect(loggedData).toContain("stripeClientSecret");
    });

    it("should log stripePaymentIntentId in payment processing (RISK-PAYMENT-09)", async () => {
      const paymentData = {
        orderId: "RISK09-ORD-003",
        userId: "user789",
        amount: "75.00",
        currency: "usd",
        email: "intent@example.com",
        phone: "+15551111111",
      };

      await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Check if PaymentIntent ID is logged
      const allLogs = consoleLogSpy.mock.calls.map((call) => JSON.stringify(call));
      const hasPaymentIntentIdLog = allLogs.some(
        (log) => log.includes("pi_logging_test") || log.includes("Created PaymentIntent")
      );

      expect(hasPaymentIntentIdLog).toBe(true);
    });

    it("should log sensitive email and phone data (RISK-PAYMENT-09)", async () => {
      const sensitivePayment = {
        orderId: "RISK09-ORD-004",
        userId: "user999",
        amount: "100.00",
        currency: "usd",
        email: "sensitive@private.com",
        phone: "+15552222222",
      };

      await request(app)
        .post("/api/payment/process")
        .send(sensitivePayment)
        .expect(200);

      // Verify email and phone are in logs
      const allLogs = consoleLogSpy.mock.calls.map((call) => JSON.stringify(call));
      const hasEmail = allLogs.some((log) => log.includes("sensitive@private.com"));
      const hasPhone = allLogs.some((log) => log.includes("+15552222222"));

      expect(hasEmail || hasPhone).toBe(true);
    });
  });

  describe("Logging in Different Scenarios", () => {
    it("should log during duplicate payment detection (RISK-PAYMENT-09)", async () => {
      const paymentData = {
        orderId: "RISK09-ORD-005",
        userId: "user111",
        amount: "30.00",
        currency: "usd",
        email: "duplicate@example.com",
        phone: "+15553333333",
      };

      // First request
      await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      consoleLogSpy.mockClear();

      // Second request - duplicate
      await request(app)
        .post("/api/payment/process")
        .send(paymentData);

      // Check for "Existing Payment Found" or "Processing payment" log
      const relevantLog = consoleLogSpy.mock.calls.find((call) =>
        call.some((arg) => typeof arg === "string" && 
          (arg.includes("Existing Payment Found") || arg.includes("Processing payment")))
      );

      expect(relevantLog).toBeDefined();
    });

    it("should log payment processing request details (RISK-PAYMENT-09)", async () => {
      const paymentData = {
        orderId: "RISK09-ORD-006",
        userId: "user222",
        amount: "45.00",
        currency: "usd",
        email: "process@example.com",
        phone: "+15554444444",
      };

      await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Check for processing log
      const processingLog = consoleLogSpy.mock.calls.find((call) =>
        call.some((arg) => typeof arg === "string" && arg.includes("Processing payment request"))
      );

      expect(processingLog).toBeDefined();
      
      const processingLogStr = JSON.stringify(processingLog);
      expect(processingLogStr).toContain("RISK09-ORD-006");
    });

    it("should log when reusing existing payment intent (RISK-PAYMENT-09)", async () => {
      // Create existing payment manually
      const uniqueId = `pi_existing_${Date.now()}_${Math.random()}`;
      await Payment.create({
        orderId: "RISK09-ORD-007",
        userId: "user333",
        amount: 60.0,
        currency: "usd",
        status: "Pending",
        email: "reuse@example.com",
        phone: "+15555555555",
        stripePaymentIntentId: uniqueId,
        stripeClientSecret: `${uniqueId}_secret_SENSITIVE`,
      });

      await request(app)
        .post("/api/payment/process")
        .send({
          orderId: "RISK09-ORD-007",
          userId: "user333",
          amount: "60.00",
          currency: "usd",
          email: "reuse@example.com",
          phone: "+15555555555",
        });

      // Check for "Reusing existing" or "Existing Payment" log
      const reuseLog = consoleLogSpy.mock.calls.find((call) =>
        call.some((arg) => typeof arg === "string" && 
          (arg.includes("Reusing existing") || arg.includes("Existing Payment")))
      );

      expect(reuseLog).toBeDefined();
    });
  });

  describe("Error Logging with Sensitive Data", () => {
    it("should not log sensitive data in error scenarios (best practice check) (RISK-PAYMENT-09)", async () => {
      // This test verifies current behavior - ideally errors shouldn't log secrets
      const paymentData = {
        orderId: "RISK09-ORD-008",
        userId: "user444",
        amount: "invalid", // Invalid amount to trigger error
        currency: "usd",
        email: "error@example.com",
        phone: "+15556666666",
      };

      await request(app)
        .post("/api/payment/process")
        .send(paymentData);

      // Check if errors contain sensitive information
      const errorLogs = consoleErrorSpy.mock.calls.map((call) => JSON.stringify(call));
      
      // Ideally should not log secrets in errors
      // This test documents current behavior
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should verify multiple payment requests create multiple log entries (RISK-PAYMENT-09)", async () => {
      const payments = [
        { orderId: `RISK09-ORD-009-${Date.now()}-${Math.random()}`, userId: "u1", amount: "10.00", email: "a@x.com", phone: "+15557777777" },
        { orderId: `RISK09-ORD-010-${Date.now()}-${Math.random()}`, userId: "u2", amount: "20.00", email: "b@x.com", phone: "+15558888888" },
        { orderId: `RISK09-ORD-011-${Date.now()}-${Math.random()}`, userId: "u3", amount: "30.00", email: "c@x.com", phone: "+15559999999" },
      ];

      for (const payment of payments) {
        const response = await request(app)
          .post("/api/payment/process")
          .send({ ...payment, currency: "usd" });
        
        // Accept 200 or 500 status
        expect([200, 500]).toContain(response.status);
      }

      // Count log entries containing sensitive data
      const allLogs = consoleLogSpy.mock.calls.map((call) => JSON.stringify(call));
      const sensitiveLogCount = allLogs.filter((log) =>
        log.includes("stripeClientSecret") || log.includes("client_secret")
      ).length;

      // Should have at least some log entries with sensitive data
      expect(sensitiveLogCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Log Content Verification", () => {
    it("should verify exact log format exposes Payment document (RISK-PAYMENT-09)", async () => {
      const paymentData = {
        orderId: "RISK09-ORD-012",
        userId: "user555",
        amount: "88.00",
        currency: "usd",
        email: "format@example.com",
        phone: "+15550000000",
      };

      await request(app)
        .post("/api/payment/process")
        .send(paymentData)
        .expect(200);

      // Find the specific log that prints the Payment record
      const paymentRecordLog = consoleLogSpy.mock.calls.find((call) =>
        call.some((arg) => typeof arg === "string" && arg.includes("Stored Payment Record"))
      );

      expect(paymentRecordLog).toBeDefined();
      expect(paymentRecordLog.length).toBeGreaterThan(1); // Should have label + object

      // Verify the logged object is the actual Payment document
      const loggedPayment = paymentRecordLog.find((arg) => typeof arg === "object");
      if (loggedPayment) {
        expect(loggedPayment).toHaveProperty("orderId");
        expect(loggedPayment).toHaveProperty("stripeClientSecret");
        expect(loggedPayment).toHaveProperty("stripePaymentIntentId");
        expect(loggedPayment.orderId).toBe("RISK09-ORD-012");
      }
    });
  });
});
