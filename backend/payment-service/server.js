require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const { register, metricsMiddleware } = require("./metrics");

const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");

// Connect to MongoDB (skip in test environment - tests manage their own connections)
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

const app = express();

// Enable CORS for your frontend
const allowedOrigins = [
  "http://localhost:3000",
  "http://frontend:3000",
  "http://frontend-app:3000",
  "http://food-delivery.local",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({ 
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));

// IMPORTANT: Mount the webhook route with raw body parsing BEFORE JSON parser middleware.
app.use("/api/payment/webhook", express.raw({ type: "application/json" }), webhookRoutes);

// JSON parser for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(metricsMiddleware);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Swagger Configuration (optional)
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Payment Service API",
      version: "1.0.0",
      description: "API documentation for Payment Microservice (Stripe Integration)",
    },
  },
  apis: ["./routes/*.js"],
};
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Mount payment routes
app.use("/api/payment", paymentRoutes);

app.get("/", (req, res) => res.send("Payment Service Running"));

const PORT = process.env.PORT || 5004;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Payment Service running on port ${PORT}`);
    console.log(`🌍 API Base URL: http://localhost:${PORT}`);
    console.log(`📖 Swagger API Docs: http://localhost:${PORT}/api-docs`);
  });
}

module.exports = app;
