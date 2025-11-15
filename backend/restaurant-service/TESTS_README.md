## Tổng quan về các test (restaurant-service)

Đây là tóm tắt unit/integration test cho `backend/restaurant-service` — bao gồm mục đích test, cách test vận hành và các lưu ý khi chạy.

## Tools
- Jest, Supertest, Mongoose

## Integration tests chính (đường dẫn)
Đường dẫn: `test/integration/` (README chi tiết có sẵn).

- `risk01-jwt-secret-mismatch.test.js`
  - Kiểm tra tính nhất quán `JWT_SECRET` giữa services.
- `risk02-string-based-foreign-keys.test.js`
  - Kiểm tra ứng dụng chấp nhận string foreign keys mà không validate existence.
- `risk03-restaurant-availability-not-validated.test.js`
  - Kiểm tra order có thể tạo cho nhà hàng đang đóng/không khả dụng.
- `risk04-fooditem-availability-not-validated.test.js`
  - Kiểm tra order chấp nhận food items hết hàng.
- `risk05-price-manipulation.test.js`
  - Kiểm tra client-controlled pricing.
- `risk06-payment-order-status-sync.test.js`
  - Kiểm tra payment webhook sync với order status.

## Unit tests
- Repo hiện ít unit test rõ rệt cho restaurant-service (nhiều test tập trung ở integration). Nếu cần, tôi có thể scaffold vài unit tests cho controller/model.

## Chạy test

```powershell
cd backend/restaurant-service
$env:MONGO_URI="mongodb://localhost:27017/Restaurant"; npm run test:integration -- --runInBand
```

## Lưu ý
- Integration tests mô tả các lỗ hổng bảo mật/kiến trúc: passing test = vulnerability được xác nhận (README ghi rõ mục đích này).
- Test cần MongoDB và `JWT_SECRET` thích hợp.
