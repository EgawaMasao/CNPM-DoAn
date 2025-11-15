## Tổng quan về các test (auth-service)

File này mô tả các unit test và integration test hiện có trong `backend/auth-service` — mục đích của từng test, cách test hoạt động và cách chạy.

## Tools chính
- Jest (unit + integration)
- Supertest (integration: gọi endpoints)
- Mongoose (kết nối DB trong integration)
- Mocking: `jest.mock()` để mock models, jwt, các thư viện bên ngoài

## Unit tests (đường dẫn)
- `test/unit/restaurantAdminController.test.js`
  - Kiểm tra: register/login cho restaurant-admin (happy path), validation, duplicate email/businessLicense, JWT signing, lỗi DB.
  - Cách test: mock `RestaurantAdmin` model và `jsonwebtoken`. Gọi trực tiếp các hàm controller với `req`, `res` giả và assert trạng thái/JSON trả về.
  - Ghi chú: nhiều test mô tả các edge-case (null/undefined/empty strings) và exception handling (next(error)).
- `test/unit/adminController.test.js`, `test/unit/customerController.test.js`, `test/unit/authRoutes.test.js`, `test/unit/auth.test.js`, `test/unit/Customer.test.js`, `test/unit/Admin.test.js`, `test/unit/RestaurantAdmin.test.js`
  - Kiểm tra: logic business nhỏ, middleware, validation, password compare, v.v.
  - Cách test: mocking model methods (findOne, create, select, comparePassword) và kiểm tra luồng xử lý.

## Integration tests (đường dẫn)
- `test/integration/auth01-jwt-secret-mismatch.test.js`
  - Kiểm tra: rủi ro JWT_SECRET không đồng bộ giữa services (token được sign ở auth nhưng bị verify bởi service khác với secret khác).
  - Cách test: tạo các Express app nhỏ (không import toàn bộ app), sign token bằng một secret, verify bằng secret khác; dùng `supertest` để gửi request và assert 401 vs 201.
  - Ghi chú: test chạy thật với MongoDB để tạo customer records (xóa data trước/sau).
- `test/integration/auth02-weak-password-validation.test.js`, `test/integration/auth04-no-rate-limiting.test.js`, `test/integration/auth06-plaintext-credentials.test.js`
  - Kiểm tra các rủi ro bảo mật (mật khẩu yếu, thiếu rate limit, plaintext credentials) bằng các scenario tương ứng.

## Chạy test — local
- Unit tests (fast, mocks):

```powershell
cd backend/auth-service
npm run test:unit
```

- Integration tests (cần MongoDB, chạy tuần tự):

```powershell
$env:MONGO_URI="mongodb://localhost:27017/Auth"; npm run test:integration -- --runInBand
```

## Yêu cầu môi trường
- MongoDB (cho integration)
- Biến môi trường: `JWT_SECRET` cho các scenario so sánh; `NODE_ENV=test` khuyến nghị

## Recommend fixes / notes
- Unit tests có coverage tốt cho controller; integration test chủ yếu tập trung vào rủi ro cross-service JWT và validation.
- Nếu muốn: tôi có thể thêm file `TESTS_README.md` chi tiết hơn với mapping test -> lines nếu cần.
