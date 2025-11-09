# GitHub Actions Integration Tests Setup

## Tổng Quan

Workflow GitHub Actions này tự động chạy integration tests cho cả **Restaurant Service** và **Payment Service** mỗi khi có thay đổi code.

## Cấu Trúc Workflow

### 1. Triggers (Kích Hoạt)

Workflow chạy khi:
```yaml
- Push code lên branches: main, develop
- Tạo Pull Request vào main, develop
- Có thay đổi trong: backend/restaurant-service/**, backend/payment-service/**
- Chạy thủ công (workflow_dispatch)
```

### 2. Jobs

#### 🏪 **restaurant-service-tests**
- **Mục đích**: Test 42 integration tests cho Restaurant Service
- **Database**: MongoDB 6.0
- **Node.js**: 18.x
- **Thời gian**: ~3-4 phút
- **Risks tested**: RISK-01 đến RISK-06

#### 💳 **payment-service-tests**
- **Mục đích**: Test 51 integration tests cho Payment Service
- **Database**: MongoDB 6.0
- **Node.js**: 18.x
- **Thời gian**: ~5-6 phút
- **Risks tested**: RISK-PAYMENT-01, 02, 03, 04, 09, 10

#### 🔒 **security-analysis**
- **Mục đích**: Phân tích và báo cáo kết quả security risks
- **Chạy sau**: Cả 2 jobs test hoàn thành
- **Output**: GitHub Step Summary với chi tiết từng risk

#### 📢 **notification**
- **Mục đích**: Thông báo kết quả cuối cùng
- **Chạy sau**: Tất cả jobs
- **Status**: Success ✅ hoặc Failure ❌

## MongoDB Service Container

```yaml
services:
  mongodb:
    image: mongo:6.0
    ports:
      - 27017:27017
    options: >-
      --health-cmd "mongosh --quiet --eval 'db.adminCommand({ ping: 1 })'"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 10
```

**Lưu ý**: Health checks đảm bảo MongoDB sẵn sàng trước khi chạy tests.

## Environment Variables

### Restaurant Service
```bash
MONGO_URI=mongodb://localhost:27017/Restaurant
JWT_SECRET=test_secret_key_for_integration_tests_ci_cd
PORT=5002
NODE_ENV=test
```

### Payment Service
```bash
MONGO_URI=mongodb://localhost:27017/Restaurant
STRIPE_SECRET_KEY=sk_test_mock_key_for_testing
STRIPE_WEBHOOK_SECRET=whsec_test_mock_webhook_secret
JWT_SECRET=test_secret_key_for_integration_tests_ci_cd
PORT=5003
NODE_ENV=test
```

## Test Commands

### Restaurant Service
```bash
npm test -- test/integration --verbose
```

### Payment Service
```bash
npm run test:integration -- --verbose
```

**⚠️ Quan trọng**: Payment Service PHẢI dùng `npm run test:integration` (có `--runInBand` built-in) để tránh race conditions.

## Quy Trình Test Flow

```
┌─────────────────────────────────────────┐
│  1. Trigger (Push/PR/Manual)            │
└────────────┬────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌───────────┐   ┌───────────┐
│Restaurant │   │ Payment   │
│  Service  │   │  Service  │
│  Tests    │   │  Tests    │
│ (42 tests)│   │ (51 tests)│
└─────┬─────┘   └─────┬─────┘
      │               │
      └───────┬───────┘
              ▼
      ┌───────────────┐
      │  Security     │
      │  Analysis     │
      └───────┬───────┘
              ▼
      ┌───────────────┐
      │ Notification  │
      └───────────────┘
```

## Test Results Summary

Khi tất cả tests pass, bạn sẽ thấy:

```
✅ All Integration Tests Passed

Total: 93 integration tests passed successfully!

📋 Restaurant Service (42 tests):
- ✓ RISK-01: JWT Secret Mismatch (7 tests)
- ✓ RISK-02: String-Based Foreign Keys (6 tests)
- ✓ RISK-03: Restaurant Availability (7 tests)
- ✓ RISK-04: FoodItem Availability (8 tests)
- ✓ RISK-05: Price Manipulation (8 tests)
- ✓ RISK-06: Payment-Order Status Sync (7 tests)

📋 Payment Service (51 tests):
- ✓ RISK-PAYMENT-01: Client Secret Leakage (6 tests)
- ✓ RISK-PAYMENT-02: Duplicate OrderId Race (8 tests)
- ✓ RISK-PAYMENT-03: Price Manipulation (10 tests)
- ✓ RISK-PAYMENT-04: Webhook Signature (10 tests)
- ✓ RISK-PAYMENT-09: Sensitive Logging (10 tests)
- ✓ RISK-PAYMENT-10: No Idempotency Key (10 tests)
```

## Artifacts

Workflow tự động upload các artifacts:

### Restaurant Service
```
integration-test-results-node-18.x/
├── coverage/
└── *.log
```

### Payment Service
```
payment-service-test-results-node-18.x/
├── coverage/
└── *.log
```

**Retention**: 7 ngày

## Troubleshooting

### ❌ "Jest worker encountered 4 child process exceptions"

**Nguyên nhân**: Tests chạy song song gây MongoDB connection conflicts

**Giải pháp**: 
- Payment Service: Luôn dùng `npm run test:integration` (có `--runInBand`)
- Restaurant Service: Thêm `--runInBand` nếu cần

### ❌ "MongoDB Connection Error"

**Nguyên nhân**: MongoDB service chưa sẵn sàng

**Giải pháp**: 
- Kiểm tra health checks trong workflow
- Tăng `health-start-period` nếu cần
- Thêm sleep delay trong "Wait for MongoDB" step

### ❌ Tests pass locally nhưng fail trên CI

**Nguyên nhân**: 
- Timing differences
- Environment variables khác nhau
- Parallel execution issues

**Giải pháp**:
1. Kiểm tra environment variables trong workflow
2. Đảm bảo `.env.test` được load đúng
3. Thêm delays cho database operations
4. Sử dụng `--runInBand` cho tests có database

## Best Practices

### ✅ DO

- ✅ Sử dụng `--runInBand` cho integration tests với database
- ✅ Mock tất cả external services (Stripe, Twilio, Email)
- ✅ Clean up test data trong `beforeEach`/`afterEach`
- ✅ Sử dụng unique IDs cho mỗi test
- ✅ Thêm timeout phù hợp (30s cho integration tests)
- ✅ Kiểm tra health của MongoDB trước khi chạy tests

### ❌ DON'T

- ❌ Chạy integration tests song song mà không có isolation
- ❌ Hard-code environment variables trong test files
- ❌ Gọi real external APIs trong tests
- ❌ Bỏ qua database cleanup
- ❌ Sử dụng `process.exit()` trong test environment
- ❌ Share database state giữa các tests

## Monitoring

### View Test Results

1. Vào repository trên GitHub
2. Click **Actions** tab
3. Select **Integration Tests** workflow
4. Click vào run cụ thể
5. Xem logs và artifacts

### GitHub Step Summary

Workflow tự động tạo summary với:
- ✅/❌ Status của từng test suite
- 📊 Số lượng tests passed/failed
- 🔒 Security risks được validate
- 💡 Recommendations

## Local Testing

Trước khi push code, test local:

```bash
# Restaurant Service
cd backend/restaurant-service
npm test -- test/integration

# Payment Service
cd backend/payment-service
npm run test:integration
```

## Maintenance

Khi thêm tests mới:

1. ✅ Đảm bảo tests chạy với `--runInBand` nếu cần
2. ✅ Update test count trong workflow summary
3. ✅ Thêm environment variables nếu cần
4. ✅ Test local trước khi commit
5. ✅ Update documentation

## Links

- [Workflow File](.github/workflows/integration-tests.yml)
- [Restaurant Service Tests](backend/restaurant-service/test/integration/)
- [Payment Service Tests](backend/payment-service/__tests__/integration/)
- [Payment Service Integration README](backend/payment-service/__tests__/integration/README.md)

## Contact

Nếu có vấn đề với CI/CD, kiểm tra:
1. GitHub Actions logs
2. Test artifacts
3. MongoDB service logs
4. Environment variables configuration
