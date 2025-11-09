# Order Service

[![Integration Tests](https://github.com/EgawaMasao/CNPM-DoAn/actions/workflows/integration-tests.yml/badge.svg)](https://github.com/EgawaMasao/CNPM-DoAn/actions/workflows/integration-tests.yml)

Order service for the food delivery application. Handles order creation, status updates, and order management.

## 🧪 Integration Tests

This service includes **72 integration tests** that document **6 critical security vulnerabilities**:

### Security Risks Documented

| Risk ID | Description | Tests | Priority |
|---------|-------------|-------|----------|
| **RISK-01** | JWT Secret Mismatch Between Services | 8 tests | 🔴 HIGH |
| **RISK-03** | Ghost References (No FK Validation) | 12 tests | 🟡 MEDIUM |
| **RISK-05** | WebSocket Authentication Bypass | 13 tests | 🟢 LOW |
| **RISK-07** | Payment-Order Status Not Synced | 8 tests | 🔴 HIGH |
| **RISK-08** | MongoDB Isolation Not Enforced | 15 tests | 🟡 MEDIUM |
| **RISK-10** | CORS Wildcard Allows Any Origin | 18 tests | 🔴 HIGH |

### Running Tests

```bash
# Install dependencies
npm install

# Start MongoDB (required)
docker-compose up -d mongo

# Run all integration tests
npm run test:integration

# Run specific test file
npm run test:integration -- test/integration/risk01-jwt-secret-mismatch.test.js
```

### Test Environment

Integration tests require:
- MongoDB 6.0+ running on `localhost:27017`
- JWT_SECRET in `.env` file
- Node.js 18.x or higher

### CI/CD

Integration tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

See `.github/workflows/integration-tests.yml` for CI/CD configuration.

## 📁 Test Files

| File | Purpose | Tests |
|------|---------|-------|
| `risk01-jwt-secret-mismatch.test.js` | JWT validation failures between services | 8 |
| `risk03-ghost-references.test.js` | Orders with non-existent references | 12 |
| `risk05-websocket-auth.test.js` | WebSocket security documentation | 13 |
| `risk07-payment-sync.test.js` | Order progression without payment | 8 |
| `risk08-mongodb-isolation.test.js` | Cross-database access vulnerabilities | 15 |
| `risk10-cors-wildcard.test.js` | CORS wildcard security issues | 18 |

## 🚀 API Endpoints

- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `PATCH /api/orders/:id` - Update order status
- `GET /api/orders` - List orders

## 🔒 Security Notes

⚠️ **These tests document existing vulnerabilities** - they verify that vulnerabilities exist and work as expected. This is intentional for educational purposes.

**Do not use this code in production without:**
1. Implementing proper JWT secret synchronization
2. Adding foreign key validation
3. Securing WebSocket connections
4. Synchronizing payment status
5. Enforcing database isolation
6. Restricting CORS origins

## 📖 Documentation

For detailed test documentation, see:
- `test/integration/README.md` - Test architecture and troubleshooting
- Individual test files for specific vulnerability documentation

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run unit tests
npm test

# Run integration tests
npm run test:integration
```

## Environment Variables

Required environment variables:

```env
MONGO_URI=mongodb://localhost:27017/Order
JWT_SECRET=your_jwt_secret_here
PORT=5001
NODE_ENV=development
```

## Dependencies

- Express 4.21.2
- Mongoose 8.13.0
- dotenv 16.4.7
- Jest 29.7.0 (testing)
- Supertest 7.1.0 (testing)
- cross-env 7.0.3 (testing)
