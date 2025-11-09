# Payment Service Integration Tests

## Overview
This directory contains integration tests for the Payment Service, validating 6 critical security risks identified in the payment processing workflow.

## Test Coverage

### RISK-PAYMENT-01: Client Secret Leakage (6 tests)
- **File**: `risk01-client-secret-leakage.test.js`
- **Risk**: Stripe client secrets stored in database and exposed in API responses
- **Tests**: Database storage, API responses, reuse scenarios, paid orders

### RISK-PAYMENT-02: Duplicate OrderId Race Conditions (8 tests)
- **File**: `risk02-duplicate-orderid-race.test.js`
- **Risk**: Multiple payment intents created for same order due to race conditions
- **Tests**: Sequential requests, concurrent requests, paid/failed order handling

### RISK-PAYMENT-03: Price Manipulation (10 tests)
- **File**: `risk03-price-manipulation.test.js`
- **Risk**: Client-provided amounts accepted without server-side validation
- **Tests**: Low amounts ($0.01), zero amounts, negative amounts, high amounts, decimal manipulation

### RISK-PAYMENT-04: Webhook Signature Verification (10 tests)
- **File**: `risk04-webhook-signature-verification.test.js`
- **Risk**: Webhooks processed without proper signature verification
- **Tests**: Missing signatures, invalid signatures, expired timestamps, valid processing

### RISK-PAYMENT-09: Sensitive Data Logging (10 tests)
- **File**: `risk09-sensitive-logging.test.js`
- **Risk**: Client secrets, payment IDs, and PII logged to console
- **Tests**: Payment creation logs, webhook logs, error logs, success logs

### RISK-PAYMENT-10: No Idempotency Keys (10 tests)
- **File**: `risk10-no-idempotency-key.test.js`
- **Risk**: Stripe API calls made without idempotency keys, causing duplicates on retries
- **Tests**: Retry scenarios, network failures, concurrent requests, duplicate charges

## Running Tests

### Prerequisites
- MongoDB running on `localhost:27017`
- Node.js 18.x or higher
- All dependencies installed (`npm ci`)

### Commands

```bash
# Run all tests (unit + integration) - NOT RECOMMENDED
npm test

# Run only unit tests (fast, no DB required)
npm run test:unit

# Run only integration tests (serial execution, requires MongoDB)
npm run test:integration

# Run integration tests with verbose output
npm run test:integration -- --verbose

# Run specific test file
npm run test:integration -- __tests__/integration/risk01-client-secret-leakage.test.js
```

## Important Notes

### ⚠️ Serial Execution Required
Integration tests **MUST** run with `--runInBand` flag to prevent:
- Database race conditions
- Connection pool exhaustion
- Parallel test interference

### 🔧 Test Configuration
- **Timeout**: 30 seconds per test
- **Database**: Real MongoDB (not in-memory)
- **Isolation**: Each test cleans up data in `beforeEach`/`afterEach`
- **Mocking**: Stripe, Twilio, and Email services are mocked

### 📊 Expected Results
```
Test Suites: 6 passed, 6 total
Tests:       51 passed, 51 total
```

## CI/CD Integration

Tests run automatically on GitHub Actions when:
- Code pushed to `main` or `develop` branches
- Pull request opened/updated
- Changes made to `backend/payment-service/**`

### GitHub Actions Configuration
```yaml
- name: Run Payment Service Integration Tests
  run: npm run test:integration -- --verbose
  env:
    MONGO_URI: mongodb://localhost:27017/Restaurant
    NODE_ENV: test
```

## Troubleshooting

### Tests Fail in Parallel
**Problem**: Jest worker crashes with "4 child process exceptions"
**Solution**: Always use `npm run test:integration` which includes `--runInBand`

### MongoDB Connection Errors
**Problem**: `process.exit(1)` called, "MongoDB Connection Error"
**Solution**: 
1. Ensure MongoDB is running: `mongod --dbpath /data/db`
2. Check connection string in `.env.test`
3. Verify MongoDB is accessible on port 27017

### Unique Constraint Violations
**Problem**: Duplicate key errors on `stripePaymentIntentId`
**Solution**: Tests use unique IDs with timestamps - if failing, check mock setup

### Database Query Returns Null
**Problem**: Payment record not found after creation
**Solution**: Increase wait time in test or check database cleanup hooks

## Test Structure

Each test file follows this pattern:

```javascript
// 1. Mock setup (BEFORE requires)
jest.mock("stripe", () => { /* ... */ });
jest.mock("../../utils/twilioService", () => { /* ... */ });

// 2. Import app AFTER mocks
const app = require("../../server");

// 3. Test suite with lifecycle hooks
describe("RISK-PAYMENT-XX", () => {
  beforeAll(() => { /* Connect to MongoDB */ });
  afterAll(() => { /* Disconnect */ });
  beforeEach(() => { /* Clean database */ });
  afterEach(() => { /* Additional cleanup */ });
  
  // 4. Test cases
  it("should validate risk scenario", async () => { /* ... */ });
});
```

## Maintenance

When adding new tests:
1. Follow existing naming convention: `riskXX-description.test.js`
2. Use unique order IDs: `RISKXX-ORD-###`
3. Mock all external services (Stripe, Twilio, Email)
4. Clean up test data in hooks
5. Use meaningful test descriptions

## Links
- [Payment Service Documentation](../../README.md)
- [Stripe Testing Guide](../../test-card-details.md)
- [Webhook Guide](../../webhook-guide.md)
