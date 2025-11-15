## Tổng quan về các test (payment-service)

File này tóm tắt unit và integration tests trong `backend/payment-service` — mục tiêu test, cách test hoạt động và điều kiện chạy.

## Tools chính
- Jest
- Supertest
- Mongoose
- Mocking: Stripe, Twilio, Email services được mock trong integration tests

## Unit tests (đường dẫn)
- `__tests__/PaymentModel.test.js` — kiểm tra schema/validation và helper của Payment model.
- `__tests__/paymentService.test.js` — kiểm tra logic xử lý thanh toán (tạo payment intent, tính toán amount, lỗi local).
- `__tests__/paymentRoutes.test.js`, `__tests__/webhookRoutes.test.js` — kiểm tra các route handler bằng mocking request/res trả về.
- `__tests__/emailService.test.js`, `__tests__/twilioService.test.js` — kiểm tra rằng khi gọi hàm service, các phương thức được gọi đúng (sử dụng jest.mock).

## Integration tests (đường dẫn & mục đích)
Đường dẫn: `__tests__/integration/` — có README chi tiết (`integration/README.md`).

- `risk01-client-secret-leakage.test.js`
  - Kiểm tra: client secret (Stripe) bị lưu/hiện trong DB hoặc responses.
  - Cách test: gọi API tạo payment, assert client secret không xuất hiện trong API response hoặc DB khi không cần thiết.

- `risk02-duplicate-orderid-race.test.js`
  - Kiểm tra: race condition khi nhiều request cùng orderId tạo nhiều payment intents.
  - Cách test: gửi nhiều request song song / tuần tự, kiểm tra duplicate payment intents.

- `risk03-price-manipulation.test.js` — kiểm tra client gửi amount bị thay đổi; test các giá trị 0, âm, decimal.
- `risk04-webhook-signature-verification.test.js` — kiểm tra webhook signature verification (mismatch, missing, valid); file mẫu sử dụng `stripe.webhooks.constructEvent` mock.
- `risk09-sensitive-logging.test.js` — kiểm tra sensitive data không được log.
- `risk10-no-idempotency-key.test.js` — kiểm tra thiếu idempotency key gây duplicate charges.

## Chạy test — local
- Cài dependencies & chạy unit tests:

```powershell
cd backend/payment-service
npm ci
npm run test:unit
```

- Integration tests (cần MongoDB, chạy tuần tự):

```powershell
$env:MONGO_URI="mongodb://localhost:27017/Payment"; npm run test:integration -- --runInBand
```

## Yêu cầu môi trường & lưu ý
- MongoDB local hoặc container phải chạy.
- Integration README trong `__tests__/integration/README.md` nêu rõ: runInBand bắt buộc để tránh xung đột DB; external services (Stripe/Twilio/Email) được mock.
- Thời gian timeout test thường đặt ~30000ms.

## Ghi chú
- Integration tests nhắm tới rủi ro bảo mật và nghiệp vụ thanh toán. Chúng mô phỏng hành vi tấn công / misconfiguration để chứng minh lỗi.
