# 💳 Quy Trình Thanh Toán - Payment Flow Documentation

## 📋 Tổng quan

Quy trình thanh toán từ **đặt món** → **tạo order** → **thanh toán** trong hệ thống Food Delivery.

---

## 🔄 Luồng Hoạt Động (Flow Diagram)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KHÁCH HÀNG                                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BƯỚC 1: THÊM MÓN ĂN VÀO GIỎ HÀNG                                  │
│  - Chọn nhà hàng                                                     │
│  - Xem menu món ăn                                                   │
│  - Thêm món vào giỏ hàng (CartContext)                              │
│  - Lưu trong localStorage: 'cart'                                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BƯỚC 2: XEM GIỎ HÀNG VÀ CHUẨN BỊ ĐẶT HÀNG                         │
│  Page: /customer/cart                                                │
│  - Xem danh sách món đã chọn                                        │
│  - Kiểm tra tổng giá                                                │
│  - Click "Proceed to Checkout"                                       │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BƯỚC 3: NHẬP THÔNG TIN ĐƠN HÀNG                                    │
│  Page: /orders/create-from-cart                                      │
│  Component: CreateOrderFromCart.js                                   │
│                                                                      │
│  Frontend Actions:                                                   │
│  1. Tự động load thông tin khách hàng từ token                      │
│     GET /api/auth/customer/profile (Auth Service - Port 5001)       │
│                                                                      │
│  2. Lấy thông tin nhà hàng                                          │
│     GET /api/restaurant/:id (Restaurant Service - Port 5002)         │
│                                                                      │
│  3. Khách hàng nhập:                                                │
│     - Địa chỉ giao hàng (deliveryAddress)                           │
│     - Xác nhận thông tin                                            │
│                                                                      │
│  4. Tạo orderPayload:                                               │
│     {                                                                │
│       customerId: "từ JWT token",                                   │
│       restaurantId: "từ cart items",                                │
│       items: [                                                       │
│         {                                                            │
│           foodId: "ID món ăn",                                       │
│           quantity: 1,                                               │
│           price: giá món                                             │
│         }                                                            │
│       ],                                                             │
│       deliveryAddress: "địa chỉ nhập",                              │
│       totalPrice: tổng giá                                           │
│     }                                                                │
│                                                                      │
│  5. Lưu vào localStorage:                                           │
│     localStorage.setItem('pendingOrder', JSON.stringify(payload))    │
│                                                                      │
│  6. Chuyển sang trang thanh toán:                                   │
│     navigate("/checkout", { state: { orderData: payload } })         │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BƯỚC 4: THANH TOÁN (STRIPE)                                        │
│  Page: /checkout                                                     │
│  Component: Checkout.js                                              │
│                                                                      │
│  4.1. Tạo Payment Intent                                            │
│  ─────────────────────────────────────────────────────────────────  │
│  Frontend → Backend:                                                 │
│  POST http://localhost:5004/api/payment/process                     │
│                                                                      │
│  Request Body:                                                       │
│  {                                                                   │
│    orderId: "ORDER" + timestamp,     // Tạo mới                     │
│    userId: customerId,                                               │
│    amount: totalPrice,               // Đơn vị: dollars             │
│    currency: "usd",                                                  │
│    email: customerEmail,             // Từ auth profile             │
│    phone: customerPhone              // Từ auth profile             │
│  }                                                                   │
│                                                                      │
│  Backend Processing (payment-service):                               │
│  ├─ Kiểm tra orderId đã thanh toán chưa                            │
│  ├─ Nếu chưa: Tạo Stripe PaymentIntent                             │
│  │   stripe.paymentIntents.create({                                 │
│  │     amount: amount * 100,  // Convert to cents                   │
│  │     currency: "usd",                                              │
│  │     metadata: { orderId, userId }                                 │
│  │   })                                                              │
│  ├─ Lưu vào MongoDB (Database: payment):                            │
│  │   {                                                               │
│  │     orderId: unique,                                              │
│  │     userId,                                                       │
│  │     amount,                                                       │
│  │     status: "Pending",                                            │
│  │     stripePaymentIntentId,                                        │
│  │     stripeClientSecret                                            │
│  │   }                                                               │
│  └─ Return clientSecret                                              │
│                                                                      │
│  Response:                                                           │
│  {                                                                   │
│    clientSecret: "pi_xxx_secret_xxx",                               │
│    paymentId: "MongoDB _id",                                         │
│    disablePayment: false                                             │
│  }                                                                   │
│                                                                      │
│  4.2. Nhập thông tin thẻ                                            │
│  ─────────────────────────────────────────────────────────────────  │
│  Frontend hiển thị Stripe Elements:                                 │
│  - CardNumberElement: Số thẻ                                        │
│  - CardExpiryElement: Ngày hết hạn                                  │
│  - CardCvcElement: Mã CVC                                           │
│                                                                      │
│  4.3. Xử lý thanh toán                                              │
│  ─────────────────────────────────────────────────────────────────  │
│  Khách hàng click "Pay $XX.XX"                                      │
│                                                                      │
│  Frontend → Stripe:                                                  │
│  ├─ stripe.createPaymentMethod({ type: "card", card })             │
│  └─ stripe.confirmCardPayment(clientSecret, { payment_method })    │
│                                                                      │
│  Stripe xử lý:                                                       │
│  ├─ Xác thực thẻ                                                    │
│  ├─ Trừ tiền                                                        │
│  └─ Return paymentIntent.status = "succeeded"                       │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BƯỚC 5: TẠO ORDER TRONG DATABASE (SAU KHI THANH TOÁN THÀNH CÔNG)  │
│                                                                      │
│  Frontend → Backend:                                                 │
│  POST http://localhost:5005/api/orders                              │
│                                                                      │
│  Headers:                                                            │
│  Authorization: Bearer <token>                                       │
│                                                                      │
│  Request Body:                                                       │
│  {                                                                   │
│    customerId: "customer_id",                                       │
│    restaurantId: "restaurant_id",                                   │
│    items: [                                                          │
│      { foodId, quantity, price }                                    │
│    ],                                                                │
│    deliveryAddress: "địa chỉ giao hàng",                            │
│    totalPrice: tổng giá                                              │
│  }                                                                   │
│                                                                      │
│  Backend Processing (order-service):                                 │
│  ├─ Xác thực token (authMiddleware)                                │
│  ├─ Kiểm tra quyền customer (authorizeRoles)                       │
│  ├─ Validate dữ liệu                                                │
│  ├─ Tính toán totalPrice                                            │
│  └─ Lưu vào MongoDB (Database: order):                              │
│      {                                                               │
│        customerId,                                                   │
│        restaurantId,                                                 │
│        items: [...],                                                 │
│        totalPrice,                                                   │
│        paymentStatus: "Pending", // Sẽ update sau                   │
│        status: "Pending",         // Order status                    │
│        deliveryAddress,                                              │
│        timestamps                                                    │
│      }                                                               │
│                                                                      │
│  Response:                                                           │
│  {                                                                   │
│    _id: "order_id",                                                  │
│    customerId,                                                       │
│    restaurantId,                                                     │
│    items: [...],                                                     │
│    totalPrice,                                                       │
│    paymentStatus: "Pending",                                         │
│    status: "Pending",                                                │
│    deliveryAddress,                                                  │
│    createdAt,                                                        │
│    updatedAt                                                         │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BƯỚC 6: XÁC NHẬN VÀ DỌN DẸP                                        │
│                                                                      │
│  Frontend Actions:                                                   │
│  1. Hiển thị thông báo thành công                                   │
│  2. Xóa pendingOrder: localStorage.removeItem('pendingOrder')       │
│  3. Xóa giỏ hàng: localStorage.removeItem('cart')                   │
│  4. Clear CartContext                                                │
│  5. Chuyển hướng: navigate("/customer/order-history")               │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  HOÀN TẤT: KHÁCH HÀNG XEM ĐŠN HÀNG                                 │
│  Page: /customer/order-history                                      │
│                                                                      │
│  Backend (Webhook - Optional):                                       │
│  Stripe Webhook → POST /api/payment/webhook                         │
│  - Nhận event: payment_intent.succeeded                             │
│  - Update Payment status: "Paid"                                     │
│  - Update Order paymentStatus: "Paid"                                │
│  - Gửi thông báo (Email/SMS)                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Chi Tiết Các Services

### 1️⃣ **Auth Service** (Port 5001)
- **Database**: `Auth`
- **Collections**: `customers`, `admins`, `restaurantadmins`

**APIs:**
```javascript
GET /api/auth/customer/profile
Headers: Authorization: Bearer <token>
Response: {
  status: "success",
  data: {
    customer: {
      id, firstName, lastName, email, phone, location
    }
  }
}
```

### 2️⃣ **Restaurant Service** (Port 5002)
- **Database**: `restaurant`
- **Collections**: `restaurants`, `fooditems`

**APIs:**
```javascript
GET /api/restaurant/all
Response: {
  message: "Restaurants fetched successfully",
  restaurants: [...]
}

GET /api/restaurant/:id
Response: { restaurant details }

GET /api/food-items/all
Response: { fooditems: [...] }
```

### 3️⃣ **Order Service** (Port 5005)
- **Database**: `order`
- **Collections**: `orders`

**APIs:**
```javascript
POST /api/orders
Headers: Authorization: Bearer <token>
Body: {
  customerId, restaurantId, items, deliveryAddress, totalPrice
}
Response: { order object with _id }

GET /api/orders
Headers: Authorization: Bearer <token>
Response: [array of orders]

GET /api/orders/:id
Response: { order details }

PATCH /api/orders/:id
Body: { status: "Confirmed" | "Preparing" | ... }
```

### 4️⃣ **Payment Service** (Port 5004)
- **Database**: `payment`
- **Collections**: `payments`

**APIs:**
```javascript
POST /api/payment/process
Body: {
  orderId, userId, amount, currency, email, phone
}
Response: {
  clientSecret: "pi_xxx_secret_xxx",
  paymentId: "mongodb_id",
  disablePayment: false
}

POST /api/payment/webhook (Stripe Webhook)
Body: Stripe event data
Action: Update payment status to "Paid"
```

---

## 🔐 Authentication Flow

### JWT Token Structure:
```javascript
{
  id: "customer_id",
  role: "customer",
  iat: timestamp,
  exp: timestamp
}
```

### Token Usage:
1. **Login**: `POST /api/auth/login` → Nhận token
2. **Lưu**: `localStorage.setItem('token', token)`
3. **Sử dụng**: 
   ```javascript
   headers: {
     Authorization: `Bearer ${token}`
   }
   ```
4. **Middleware**: `protect` và `authorizeRoles` kiểm tra quyền

---

## 💾 Data Models

### Order Model:
```javascript
{
  customerId: String,
  restaurantId: String,
  items: [{
    foodId: String,
    quantity: Number,
    price: Number
  }],
  totalPrice: Number,
  paymentStatus: "Pending" | "Paid" | "Failed",
  status: "Pending" | "Confirmed" | "Preparing" | "Out for Delivery" | "Delivered" | "Canceled",
  deliveryAddress: String,
  timestamps: true
}
```

### Payment Model:
```javascript
{
  orderId: String (unique),
  userId: String,
  amount: Number,
  currency: String,
  status: "Pending" | "Paid" | "Failed",
  email: String,
  phone: String,
  stripePaymentIntentId: String (unique),
  stripeClientSecret: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## ⚠️ Vấn Đề Hiện Tại & Giải Pháp

### ❌ **Vấn đề 1: Order được tạo SAU khi thanh toán**
**Hiện tại:**
```
Thanh toán thành công → Tạo order → Nếu lỗi: Tiền mất, order không có
```

**Rủi ro:**
- Khách hàng đã trả tiền nhưng order không được tạo
- Cần support manual để xử lý

**✅ Giải pháp tốt hơn:**
```
Tạo order với paymentStatus="Pending" → Thanh toán → Update paymentStatus="Paid"
```

### ❌ **Vấn đề 2: Không có Webhook xử lý**
**Hiện tại:**
- Payment status chỉ update từ frontend
- Không đồng bộ với Stripe webhook

**✅ Giải pháp:**
- Implement webhook handler: `/api/payment/webhook`
- Update payment status khi nhận event từ Stripe
- Update order paymentStatus tương ứng

### ❌ **Vấn đề 3: Không có rollback mechanism**
**Hiện tại:**
- Nếu thanh toán thành công nhưng tạo order lỗi
- Không có cơ chế hoàn tiền tự động

**✅ Giải pháp:**
- Implement transaction pattern
- Tạo refund mechanism
- Log lỗi và alert admin

---

## 🧪 Testing Guide

### Test Case 1: Happy Path
1. Login: `customer@gmail.com` / `customer123`
2. Thêm món vào giỏ hàng
3. Checkout với địa chỉ hợp lệ
4. Thanh toán với thẻ test Stripe
5. Verify order được tạo trong database

### Test Case 2: Payment Failed
1. Sử dụng thẻ test bị từ chối
2. Verify không tạo order
3. Verify payment status = "Failed"

### Test Case 3: Duplicate Payment
1. Tạo order và thanh toán thành công
2. Thử thanh toán lại với cùng orderId
3. Verify trả về thông báo "already paid"

### Stripe Test Cards:
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Insufficient Funds: 4000 0000 0000 9995
```

---

## 📝 Checklist Triển Khai

- [x] Auth Service running (Port 5001)
- [x] Restaurant Service running (Port 5002)  
- [x] Order Service running (Port 5005)
- [x] Payment Service running (Port 5004)
- [x] MongoDB connected (Port 27018)
- [x] Stripe integration working
- [x] Frontend checkout flow working
- [ ] Webhook implementation
- [ ] Error handling & rollback
- [ ] Email/SMS notifications
- [ ] Order status tracking
- [ ] Admin dashboard for orders

---

## 🚀 Cải Tiến Đề Xuất

### Phase 1 (Critical):
1. ✅ Tạo order TRƯỚC khi thanh toán
2. ✅ Implement Stripe webhook
3. ✅ Update order paymentStatus từ webhook

### Phase 2 (Important):
4. Thêm transaction management
5. Implement refund mechanism
6. Thêm order status tracking realtime (WebSocket)
7. Email/SMS notifications

### Phase 3 (Nice to have):
8. Admin dashboard xem orders
9. Restaurant dashboard nhận orders
10. Delivery tracking system
11. Rating & review system

---

**Ngày tạo**: November 9, 2025  
**Version**: 1.0.0  
**Tác giả**: Senior NodeJS Developer
