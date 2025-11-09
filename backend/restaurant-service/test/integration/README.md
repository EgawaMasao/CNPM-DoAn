# Integration Tests for Restaurant Service - Risk Analysis

## Overview
These integration tests validate 6 critical integration risks identified in the restaurant-service microservices architecture. Tests demonstrate real vulnerabilities without modifying production code.

## Test Files

### RISK-01: JWT Secret Mismatch Across Services
**File:** `risk01-jwt-secret-mismatch.test.js`
- Tests authentication token validation between services
- Verifies JWT_SECRET consistency requirements
- Demonstrates cross-service authentication failures

### RISK-02: String-Based Foreign Keys - No Validation
**File:** `risk02-string-based-foreign-keys.test.js`
- Tests that orders accept non-existent restaurantId and foodId
- Demonstrates lack of referential integrity
- Shows cascade delete issues

### RISK-03: Restaurant Availability Not Validated During Order
**File:** `risk03-restaurant-availability-not-validated.test.js`
- Tests orders created for closed/unavailable restaurants
- Demonstrates missing availability checks
- Shows concurrent order issues during status changes

### RISK-04: FoodItem Availability Not Validated
**File:** `risk04-fooditem-availability-not-validated.test.js`
- Tests orders containing unavailable/out-of-stock items
- Demonstrates lack of inventory validation
- Shows concurrent ordering without stock management

### RISK-05: Price Manipulation - Client-Controlled Pricing
**File:** `risk05-price-manipulation.test.js`
- Tests client-provided prices accepted without validation
- Demonstrates zero, negative, and manipulated pricing
- Shows price arbitrage and revenue loss scenarios

### RISK-06: Payment-Order Status Sync Failure
**File:** `risk06-payment-order-status-sync.test.js`
- Tests payment status not syncing to order status
- Demonstrates missing webhook mechanism
- Shows duplicate payment attempts

## Prerequisites

### Required Services
```bash
# Start MongoDB
docker-compose up -d mongo

# OR use local MongoDB
mongod --dbpath /data/db
```

### Environment Variables
Create `.env` file in `backend/restaurant-service/`:
```bash
MONGO_URI=mongodb://localhost:27017/Restaurant
JWT_SECRET=test_secret_key_for_integration_tests
PORT=5002
NODE_ENV=test
```

### Dependencies
```bash
cd backend/restaurant-service
npm install
```

## Running Tests

### Run All Integration Tests
```bash
npm test -- test/integration
```

### Run Individual Test Files
```bash
# RISK-01: JWT Secret Mismatch
npm test -- test/integration/risk01-jwt-secret-mismatch.test.js

# RISK-02: String-Based Foreign Keys
npm test -- test/integration/risk02-string-based-foreign-keys.test.js

# RISK-03: Restaurant Availability
npm test -- test/integration/risk03-restaurant-availability-not-validated.test.js

# RISK-04: FoodItem Availability
npm test -- test/integration/risk04-fooditem-availability-not-validated.test.js

# RISK-05: Price Manipulation
npm test -- test/integration/risk05-price-manipulation.test.js

# RISK-06: Payment-Order Sync
npm test -- test/integration/risk06-payment-order-status-sync.test.js
```

### Run with Coverage
```bash
npm test -- --coverage test/integration
```

### Run in Watch Mode
```bash
npm test -- --watch test/integration
```

## Docker Environment

### Using Docker Compose
```bash
# Start all services
docker-compose up -d

# Run tests inside container
docker exec -it restaurant-service npm test -- test/integration

# View logs
docker logs restaurant-service
```

### Test Database Connection
```bash
# Verify MongoDB connection
docker exec -it mongo mongosh --eval "db.adminCommand('ping')"

# Check Restaurant database
docker exec -it mongo mongosh Restaurant --eval "db.restaurants.countDocuments()"
```

## Test Results Interpretation

### Expected Outcomes
All tests **SHOULD PASS** because they demonstrate **existing vulnerabilities**:

✅ **Passing tests = Vulnerabilities confirmed**
- Tests prove the risks exist in production code
- Each passing test validates a security/integration issue

❌ **Failing tests = Need investigation**
- May indicate test environment issues
- Check MongoDB connection and environment variables

### Sample Output
```
PASS test/integration/risk01-jwt-secret-mismatch.test.js
  ✓ Should reject token signed with wrong JWT_SECRET (45ms)
  ✓ Should accept token signed with correct JWT_SECRET (23ms)
  ✓ Should detect JWT_SECRET mismatch in cross-service scenario (12ms)

PASS test/integration/risk02-string-based-foreign-keys.test.js
  ✓ Should demonstrate lack of foreign key validation for restaurantId (67ms)
  ✓ Should demonstrate lack of foreign key validation for foodId (54ms)

PASS test/integration/risk05-price-manipulation.test.js
  ✓ Should accept client-provided price instead of server price (89ms)
  ✓ Should allow zero-price orders (45ms)
  ✓ Should allow negative price orders (34ms)

Test Suites: 6 passed, 6 total
Tests:       42 passed, 42 total
```

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
docker ps | grep mongo

# Restart MongoDB
docker-compose restart mongo

# Check connection string
echo $MONGO_URI
```

### Port Conflicts
```bash
# Check if port 27017 is in use
netstat -an | findstr :27017

# Kill process using port (Windows)
taskkill /F /PID <PID>
```

### Test Timeout Issues
Increase Jest timeout in test files:
```javascript
jest.setTimeout(30000); // 30 seconds
```

### Clean Test Data
```bash
# Drop test database
docker exec -it mongo mongosh Restaurant --eval "db.dropDatabase()"

# Or manually clean collections
docker exec -it mongo mongosh Restaurant --eval "db.restaurants.deleteMany({})"
docker exec -it mongo mongosh Restaurant --eval "db.fooditems.deleteMany({})"
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:6.0
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend/restaurant-service
          npm install
      
      - name: Run integration tests
        run: |
          cd backend/restaurant-service
          npm test -- test/integration
        env:
          MONGO_URI: mongodb://localhost:27017/Restaurant
          JWT_SECRET: test_secret_key
          NODE_ENV: test
```

## Security Notice

⚠️ **IMPORTANT**: These tests demonstrate real security vulnerabilities:

1. **JWT Secret Mismatch** - Can cause authentication bypass
2. **No Foreign Key Validation** - Allows data integrity issues
3. **Missing Availability Checks** - Orders for closed restaurants
4. **No Stock Validation** - Overselling inventory
5. **Price Manipulation** - Revenue loss from client-side pricing
6. **Payment Sync Failure** - Orders without payment confirmation

## Recommended Fixes

### Priority 1 (Critical)
- [ ] Implement server-side price validation (RISK-05)
- [ ] Add payment webhook handler (RISK-06)
- [ ] Centralize JWT_SECRET configuration (RISK-01)

### Priority 2 (High)
- [ ] Add restaurant availability validation before order creation (RISK-03)
- [ ] Add food item availability checks (RISK-04)
- [ ] Implement referential integrity with ObjectId refs (RISK-02)

### Priority 3 (Medium)
- [ ] Add database triggers for cascade deletes
- [ ] Implement inventory management system
- [ ] Add real-time availability sync

## Contributing

When adding new integration tests:
1. Name files descriptively: `risk##-description.test.js`
2. Document the risk being tested
3. Include reproduction steps in comments
4. Add test to this README

## License

Internal QA Testing Documentation - Not for public distribution
