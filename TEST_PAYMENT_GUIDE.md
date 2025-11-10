# 🧪 Hướng Dẫn Test Payment với Stripe Test Cards

## ✅ Test Case 1: Thanh toán thành công

### Dữ liệu nhập:
```
Card Number:    4242 4242 4242 4242
Expiry Date:    12/25
CVC:            123
```

### Kết quả mong đợi:
- ✅ Payment thành công
- ✅ Hiển thị thông báo "Payment Successful!"
- ✅ Đơn hàng được tạo trong database
- ✅ Status chuyển sang "Paid"

---

## ❌ Test Case 2: Thẻ không đủ tiền (Insufficient Funds)

### Dữ liệu nhập:
```
Card Number:    4000 0000 0000 9995
Expiry Date:    12/25
CVC:            123
```

### Kết quả mong đợi:
- ❌ Payment thất bại
- ❌ Hiển thị lỗi "Your card has insufficient funds."
- ❌ Đơn hàng không được tạo

---

## ❌ Test Case 3: Thẻ bị từ chối (Generic Decline)

### Dữ liệu nhập:
```
Card Number:    4000 0000 0000 0002
Expiry Date:    12/25
CVC:            123
```

### Kết quả mong đợi:
- ❌ Payment thất bại
- ❌ Hiển thị lỗi "Your card was declined."
- ❌ Đơn hàng không được tạo

---

## 🔐 Test Case 4: Thẻ yêu cầu xác thực (3D Secure)

### Dữ liệu nhập:
```
Card Number:    4000 0025 0000 3155
Expiry Date:    12/25
CVC:            123
```

### Kết quả mong đợi:
- 🔐 Hiển thị popup xác thực 3D Secure
- ✅ Sau khi xác thực thành công → Payment thành công
- ❌ Nếu không xác thực → Payment thất bại

---

## ❌ Test Case 5: Sai CVC

### Dữ liệu nhập:
```
Card Number:    4000 0000 0000 0127
Expiry Date:    12/25
CVC:            123
```

### Kết quả mong đợi:
- ❌ Payment thất bại
- ❌ Hiển thị lỗi về CVC không hợp lệ

---

## ⏰ Test Case 6: Thẻ hết hạn

### Dữ liệu nhập:
```
Card Number:    4000 0000 0000 0069
Expiry Date:    12/25
CVC:            123
```

### Kết quả mong đợi:
- ❌ Payment thất bại
- ❌ Hiển thị lỗi "Your card has expired."

---

## 🌍 Test Case 7: Thẻ quốc tế khác nhau

### Visa (US):
```
Card Number:    4242 4242 4242 4242
Expiry Date:    12/25
CVC:            123
```

### Visa (Debit):
```
Card Number:    4000 0566 5566 5556
Expiry Date:    12/25
CVC:            123
```

### Mastercard:
```
Card Number:    5555 5555 5555 4444
Expiry Date:    12/25
CVC:            123
```

### American Express:
```
Card Number:    3782 822463 10005
Expiry Date:    12/25
CVC:            1234 (4 digits cho Amex)
```

---

## 📊 Danh Sách Thẻ Test Đầy Đủ

| Scenario | Card Number | Expiry | CVC |
|----------|-------------|--------|-----|
| ✅ Success | 4242 4242 4242 4242 | Future | Any |
| ❌ Declined | 4000 0000 0000 0002 | Future | Any |
| ❌ Insufficient Funds | 4000 0000 0000 9995 | Future | Any |
| ❌ Lost Card | 4000 0000 0000 9987 | Future | Any |
| ❌ Stolen Card | 4000 0000 0000 9979 | Future | Any |
| ❌ Expired Card | 4000 0000 0000 0069 | Future | Any |
| ❌ Incorrect CVC | 4000 0000 0000 0127 | Future | Any |
| ❌ Processing Error | 4000 0000 0000 0119 | Future | Any |
| 🔐 3D Secure Auth | 4000 0025 0000 3155 | Future | Any |
| 🔐 3D Secure Required | 4000 0027 6000 3184 | Future | Any |

---

## 🚀 Quy Trình Test Hoàn Chỉnh

### Bước 1: Tạo đơn hàng
1. Đăng nhập với tài khoản: `customer@gmail.com` / `customer123`
2. Thêm món ăn vào giỏ hàng
3. Checkout và điền địa chỉ giao hàng
4. Nhấn "Place Order"

### Bước 2: Test Payment
1. Được chuyển đến trang `/checkout`
2. Kiểm tra Order Summary hiển thị đúng thông tin
3. Nhập thẻ test theo scenario muốn test
4. Nhấn nút "Pay $X.XX"

### Bước 3: Xác nhận kết quả
1. Kiểm tra thông báo trên UI
2. Kiểm tra payment status trong database
3. Kiểm tra order được tạo (nếu payment thành công)
4. Kiểm tra logs trong terminal/console

---

## 🔍 Debug & Monitoring

### Kiểm tra logs Payment Service:
```bash
docker logs payment-service --tail 100 -f
```

### Kiểm tra logs Frontend:
```bash
docker logs frontend-app --tail 100 -f
```

### Kiểm tra trong MongoDB:
```bash
docker exec -it <mongo-container> mongosh
use payment
db.payments.find().pretty()
```

### Kiểm tra Stripe Dashboard:
https://dashboard.stripe.com/test/payments

---

## 📝 Notes

- ⚠️ **Chỉ sử dụng trong môi trường TEST**
- ⚠️ **Không sử dụng thẻ thật trong test mode**
- ⚠️ **Expiry date phải là ngày trong tương lai**
- ⚠️ **CVC có thể là bất kỳ số nào (3 hoặc 4 digits)**
- ⚠️ **ZIP code có thể là bất kỳ nếu được yêu cầu**

---

## 🔗 Tài liệu tham khảo

- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Stripe Payment Intents](https://stripe.com/docs/payments/payment-intents)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)

---

**Happy Testing! 🎉**
