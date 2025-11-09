# 🚀 Quick Reference - Payment Flow

## 📍 Services & Ports

| Service | Port | Purpose |
|---------|------|---------|
| Auth | 5001 | Authentication & User Management |
| Restaurant | 5002 | Restaurants & Food Items |
| Order | 5005 | Order Management |
| Payment | 5004 | Payment Processing (Stripe) |
| MongoDB | 27018 | Database |

## 🔑 Test Accounts

```
Customer: customer@gmail.com / customer123
Admin: admin@gmail.com / admin123
Super Admin: superadmin@gmail.com / superadmin123
Restaurant: restaurant@gmail.com / restaurant123
```

## 💳 Stripe Test Cards

```
✅ Success: 4242 4242 4242 4242
❌ Decline: 4000 0000 0000 0002
💰 Insufficient: 4000 0000 0000 9995
Expiry: Any future date
CVC: Any 3 digits
```

## 📝 API Quick Test

### 1. Login
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@gmail.com","password":"customer123"}'
```

### 2. Get Restaurants
```bash
curl http://localhost:5002/api/restaurant/all
```

### 3. Create Order (Need Token)
```bash
curl -X POST http://localhost:5005/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customerId": "CUSTOMER_ID",
    "restaurantId": "RESTAURANT_ID",
    "items": [{"foodId": "FOOD_ID", "quantity": 1, "price": 10}],
    "deliveryAddress": "123 Main St",
    "totalPrice": 10
  }'
```

### 4. Process Payment
```bash
curl -X POST http://localhost:5004/api/payment/process \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER123",
    "userId": "USER_ID",
    "amount": 10,
    "currency": "usd",
    "email": "customer@example.com",
    "phone": "+1234567890"
  }'
```

## 🔄 Complete Flow

```
1. Customer Login → Get Token
2. Browse Restaurants → Add to Cart
3. View Cart → Click Checkout
4. Fill Delivery Info → Proceed to Payment
5. Enter Card Details → Submit Payment
6. Stripe Process → Payment Success
7. Create Order in DB → Success Message
8. View Order History
```

## 🗂️ MongoDB Collections

### Auth Database:
- `admins` - Admin users
- `customers` - Customer users
- `restaurantadmins` - Restaurant owners

### Restaurant Database:
- `restaurants` - Restaurant info
- `fooditems` - Menu items

### Order Database:
- `orders` - Customer orders

### Payment Database:
- `payments` - Payment records

## 🐛 Common Issues

### Issue: "Login failed"
**Fix**: Check auth-service on port 5001
```bash
docker ps | grep auth
docker logs backend-auth-service-1
```

### Issue: "Cannot create order"
**Fix**: Verify token is valid and user has customer role
```bash
# Decode JWT token
echo "TOKEN" | cut -d. -f2 | base64 -d
```

### Issue: "Payment failed"
**Fix**: Check Stripe API key in .env
```bash
docker exec -it backend-payment-service-1 env | grep STRIPE
```

### Issue: "No restaurants found"
**Fix**: Import restaurant data
```bash
docker exec -it backend-restaurant-service-1 node importData.js
```

## 🔧 Useful Commands

```bash
# Restart all services
cd backend && docker-compose restart

# View logs
docker logs backend-auth-service-1 --tail 50
docker logs backend-payment-service-1 --tail 50

# Check MongoDB data
docker exec -it backend-mongo-1 mongosh --eval "show dbs"
docker exec -it backend-mongo-1 mongosh --eval "use order" --eval "db.orders.find().pretty()"

# Rebuild specific service
docker-compose build auth-service
docker-compose up -d auth-service
```

## 📊 Payment Status Flow

```
Order Created → paymentStatus: "Pending"
    ↓
Payment Processing → Stripe PaymentIntent
    ↓
Card Authorized → payment: "Paid"
    ↓
Order Status Update → paymentStatus: "Paid"
    ↓
Order Fulfillment → status: "Confirmed" → "Preparing" → "Out for Delivery" → "Delivered"
```

## 🎯 Key Files

```
Backend:
- backend/docker-compose.yml
- backend/auth-service/seedUsers.js
- backend/payment-service/routes/paymentRoutes.js
- backend/order-service/controllers/orderController.js

Frontend:
- frontend/src/pages/auth/AuthLogin.jsx
- frontend/src/pages/payment/Checkout.js
- frontend/src/pages/orderManagement/CreateOrderFromCart.js
- frontend/src/pages/contexts/CartContext.js
```

## 📞 Support

Check full documentation:
- `PAYMENT_FLOW_DOCUMENTATION.md` - Detailed payment flow
- `SETUP_GUIDE.md` - Setup and configuration
- `README.md` - Project overview
