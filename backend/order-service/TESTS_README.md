## Tổng quan về các test (order-service)

File này mô tả unit tests và integration tests hiện có trong `backend/order-service`.

## Tools
- Jest, Supertest, Mongoose

## Unit tests
- `test/unit/orderModel.test.js` — kiểm tra schema, validation và helper methods của Order model.
- `test/unit/orderController.test.js` — kiểm tra flow tạo/đọc order, validate input, xử lý lỗi.
- `test/unit/orderRoutes.test.js` — test routing, middleware integration (có mock auth middleware).
- `test/unit/userModel.test.js`, `test/unit/userController.test.js`, `test/unit/userRoutes.test.js`, `test/unit/authMiddleware.test.js` — kiểm tra các phần liên quan đến user/authentication.

## Integration tests (đường dẫn & mục tiêu)
Đường dẫn: `test/integration/` với README chi tiết.

- `risk01-jwt-secret-mismatch.test.js` — kiểm tra token signed bởi auth-service nhưng verify ở order-service với secret khác.
- `risk03-ghost-references.test.js` — tạo orders với customer/restaurant/food IDs không tồn tại; kiểm tra thiếu validation foreign keys.
- `risk05-websocket-auth.test.js` — đánh giá xác thực WebSocket (CORS, origin, auth) và broadcast authorization.
- `risk07-payment-sync.test.js` — kiểm tra luồng đồng bộ trạng thái order khi payment thay đổi; mô tả mất sync nếu webhook thiếu.
- `risk08-mongodb-isolation.test.js` — chứng minh rủi ro khi nhiều services chia sẻ DB hoặc không có isolation.
- `risk10-cors-wildcard.test.js` — kiểm tra CORS cấu hình wildcard cho phép origin bất kỳ.

## Chạy test

```powershell
cd backend/order-service
$env:MONGO_URI="mongodb://localhost:27017/Order"; npm run test:integration -- --runInBand
```

Ghi chú: Integration tests yêu cầu MongoDB; chạy tuần tự để tránh connection pool / race issues.

## Mục tiêu tests
- Các integration tests chủ yếu hướng tới rủi ro cross-service và data integrity hơn là unit behavior thuần túy.
