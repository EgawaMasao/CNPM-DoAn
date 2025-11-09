# Integration Tests for Order Service

## Overview
This directory contains 6 integration test suites that verify critical security risks and integration vulnerabilities in the order-service.

## Test Files

### RISK-01: JWT Secret Mismatch (risk01-jwt-secret-mismatch.test.js)
- **Description**: Tests JWT token validation failures due to secret inconsistency between auth-service and order-service
- **Test Cases**: 6 scenarios, 8 tests total
- **Key Vulnerabilities**:
  - Tokens signed with wrong secrets accepted/rejected
  - Expired token handling
  - Missing role claims
  - Secret rotation impacts

### RISK-03: Ghost References (risk03-ghost-references.test.js)
- **Description**: Tests orders created with non-existent customer, restaurant, or food IDs
- **Test Cases**: 6 scenarios, 13 tests total
- **Key Vulnerabilities**:
  - No foreign key validation
  - SQL injection attempts
  - Orphaned orders after customer deletion
  - Cross-restaurant food item orders

### RISK-05: WebSocket Authentication (risk05-websocket-auth.test.js)
- **Description**: Documents WebSocket broadcast security vulnerabilities
- **Test Cases**: 7 documentation test groups, 13 tests total
- **Key Vulnerabilities**:
  - CORS wildcard on WebSocket connections (origin: "*")
  - No authentication in connection handler
  - Unrestricted broadcast to all clients
  - Missing socket middleware

### RISK-07: Payment Status Sync (risk07-payment-sync.test.js)
- **Description**: Tests order progression without payment verification
- **Test Cases**: 7 scenarios, 13 tests total
- **Key Vulnerabilities**:
  - Orders created without payment validation
  - Status updates (Pending → Confirmed → Preparing → Delivered) without payment check
  - No webhook for payment-service integration
  - Manual payment status manipulation

### RISK-08: MongoDB Database Isolation (risk08-mongodb-isolation.test.js)
- **Description**: Tests shared MongoDB instance allowing cross-service data access
- **Test Cases**: 7 scenarios, 15 tests total
- **Key Vulnerabilities**:
  - Single MongoDB instance for all services
  - No database-level authentication
  - Cross-database access (Order, Auth, Restaurant, Payment)
  - Direct data modification bypassing service layer

### RISK-10: CORS Wildcard (risk10-cors-wildcard.test.js)
- **Description**: Tests unrestricted cross-origin access vulnerabilities
- **Test Cases**: 9 scenarios, 18 tests total
- **Key Vulnerabilities**:
  - CORS wildcard allows requests from any origin
  - CSRF attacks possible
  - Data exfiltration from unauthorized origins
  - No origin whitelist validation

## Prerequisites

### 1. MongoDB Running
Ensure MongoDB container is running:
```bash
# From backend directory
docker-compose up -d mongo

# Verify MongoDB is running
docker ps | findstr mongo
```

### 2. Environment Configuration
The tests require MongoDB accessible at `localhost:27017`. The test script automatically sets `MONGO_URI=mongodb://localhost:27017/Order`.

## Running Tests

### Run All Integration Tests
```bash
npm run test:integration
```

This command:
- Sets MONGO_URI to localhost:27017
- Runs tests sequentially (--runInBand) to avoid connection conflicts
- Uses 30-second timeout for database operations

### Run Individual Test Files
```bash
# RISK-01: JWT Secret Mismatch
npm run test:integration -- risk01-jwt-secret-mismatch.test.js

# RISK-03: Ghost References
npm run test:integration -- risk03-ghost-references.test.js

# RISK-05: WebSocket Authentication
npm run test:integration -- risk05-websocket-auth.test.js

# RISK-07: Payment Status Sync
npm run test:integration -- risk07-payment-sync.test.js

# RISK-08: MongoDB Database Isolation
npm run test:integration -- risk08-mongodb-isolation.test.js

# RISK-10: CORS Wildcard
npm run test:integration -- risk10-cors-wildcard.test.js
```

### Manual Execution (Windows PowerShell)
```powershell
$env:MONGO_URI="mongodb://localhost:27017/Order"
npm test -- test/integration --runInBand
```

### Manual Execution (Linux/Mac)
```bash
MONGO_URI=mongodb://localhost:27017/Order npm test -- test/integration --runInBand
```

## Test Architecture

### Connection Management
Each test file:
1. Loads environment variables with `dotenv.config()`
2. Checks Mongoose connection state before connecting
3. Creates standalone Express app with routes
4. Connects to MongoDB in `beforeAll()` hook (30s timeout)
5. Cleans up test data in `afterAll()` hook
6. Closes MongoDB connection after tests complete

### Authentication
Tests generate JWT tokens using the same secret as the application:
```javascript
const JWT_SECRET = process.env.JWT_SECRET || '[fallback-secret]';
const token = jwt.sign(
    { id: 'test_user', role: 'customer' },
    JWT_SECRET,
    { expiresIn: '1h' }
);
```

### Test Data Naming
All test data uses prefixes to avoid conflicts:
- `cors_test_*` - CORS wildcard tests
- `ghost_*` or `FAKE_*` - Ghost reference tests
- `payment_sync_*` - Payment sync tests
- `isolation_test_*` - MongoDB isolation tests

## Expected Results

### Success Criteria
- **RISK-01**: 6/6 test cases pass (wrong secrets rejected, correct secrets accepted)
- **RISK-03**: 13/13 tests pass (ghost references allowed, demonstrating vulnerability)
- **RISK-05**: 13/13 tests pass (WebSocket vulnerabilities documented)
- **RISK-07**: 13/13 tests pass (orders progress without payment)
- **RISK-08**: 15/15 tests pass (cross-database access demonstrated)
- **RISK-10**: 17/18 tests pass (CORS wildcard allows unauthorized access)

### Known Issues
- **RISK-10**: One test fails due to invalid header character (test code issue, not application issue)
- **Performance**: Tests run sequentially to avoid MongoDB connection conflicts (slower but more reliable)

## Troubleshooting

### MongoDB Connection Timeouts
**Symptom**: `MongooseError: Operation orders.deleteMany() buffering timed out`

**Solutions**:
1. Verify MongoDB is running: `docker ps | findstr mongo`
2. Check MongoDB accessibility: `docker exec -it backend-mongo-1 mongosh --eval "db.adminCommand({ ping: 1 })"`
3. Ensure MONGO_URI uses `localhost:27017` not `mongo:27017`

### 401 Unauthorized Errors
**Symptom**: All requests return 401 status

**Cause**: JWT_SECRET not loaded from .env file

**Solution**: Verify `dotenv.config()` is called at the top of test file

### Port Already in Use
**Symptom**: EADDRINUSE: address already in use

**Cause**: Another MongoDB instance running on port 27017

**Solution**: Stop conflicting services or use different port

### Multiple Test Files Fail
**Symptom**: First test file passes, subsequent files timeout

**Cause**: Mongoose connection state issues when running in parallel

**Solution**: Use `--runInBand` flag to run sequentially

## Test Data Cleanup

Tests automatically clean up data in `afterAll()` hooks:
```javascript
await Order.deleteMany({ customerId: /^test_/ });
```

Manual cleanup if needed:
```javascript
docker exec -it backend-mongo-1 mongosh Order --eval "db.orders.deleteMany({ customerId: /^test_/ })"
```

## Contributing

When adding new integration tests:
1. Use unique test data prefixes
2. Include 30000ms timeout on `beforeAll`/`afterAll` hooks
3. Create standalone Express app (don't import index.js)
4. Clean up test data in `afterAll`
5. Document vulnerabilities with code line references
6. Follow existing test structure and naming conventions

## Documentation

See also:
- `../RISK_ANALYSIS.md` - Detailed analysis of all 10 integration risks
- `../../SETUP_GUIDE.md` - Service setup and Docker configuration
- `../../README.md` - Order service overview
