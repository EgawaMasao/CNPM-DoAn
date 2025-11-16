# 🚀 Backend Services Setup Guide

## 📋 Tổng quan

Project này bao gồm 4 microservices chạy trên Docker:

| Service | Port | Database | Mô tả |
|---------|------|----------|-------|
| **Restaurant Service** | 5002 | `restaurant` | Quản lý nhà hàng và món ăn |
| **Order Service** | 5005 | `order` | Quản lý đơn hàng |
| **Payment Service** | 5004 | `payment` | Xử lý thanh toán |
| **Auth Service** | 5001 | `Auth` | Xác thực và phân quyền |
| **MongoDB** | 27018 | - | Database chung |

---

## 🛠️ Cài đặt và Chạy

### 1️⃣ Khởi động tất cả services

```bash
cd D:\cnpm_ro\CNPM-DoAn\backend
docker-compose up -d --build
```

### 2️⃣ Import dữ liệu mẫu

#### Ghi chú trước khi chạy
- Tên container có thể khác tùy `docker-compose` project name; luôn kiểm tra bằng `docker ps` trước khi chạy `docker exec`.
- Thông thường khi khởi bằng `docker-compose` trong repo này container name mặc định là: `restaurant-service`, `auth-service`, `order-service`, `payment-service`, `frontend-app`, `mongo`.

#### Thứ tự recommended để seed/import dữ liệu
1. Import restaurants & food items (nếu có file JSON):
```powershell
docker exec -it restaurant-service node importData.js
```

2. Seed super-admin cho restaurant-service (nếu kịch bản có):
```powershell
docker exec -it restaurant-service node seedSuperAdmin.js
```

3. Seed thêm dữ liệu nhà hàng (food items, sample data):
```powershell
docker exec -it restaurant-service node seedData.js
```

4. Seed tài khoản auth (Super Admin, Admin, Customer, Restaurant Admin):
```powershell
docker exec -it auth-service node seedUsers.js
```

Ghi chú: nếu `seedData.js` báo lỗi "No restaurant found", chạy `importData.js` trước (bước 1).

### 3️⃣ Kiểm tra services đang chạy

```bash
docker ps
```

### 4️⃣ Xem logs (nếu cần)

```powershell
docker logs restaurant-service
docker logs order-service
docker logs payment-service
docker logs auth-service
```

---

## 👥 Tài khoản mẫu

### 🔴 Super Admin
- **Email**: `superadmin@gmail.com`
- **Password**: `superadmin123`
- **Quyền**: Toàn quyền quản trị (users, restaurants, orders, delivery, payments)

### 🟠 Admin
- **Email**: `admin@gmail.com`
- **Password**: `admin123`
- **Quyền**: Quản lý users, restaurants, orders

### 🟢 Customer (Khách hàng)
- **Email**: `customer@gmail.com`
- **Password**: `customer123`
- **Tên**: Nguyen Van A
- **Địa chỉ**: Ho Chi Minh City

### 🟡 Restaurant Admin (Chủ nhà hàng)
- **Email**: `restaurant@gmail.com`
- **Password**: `restaurant123`
- **Business License**: BL-2025-001
- **Trạng thái**: Đã được phê duyệt

---

## 🔌 Kết nối MongoDB Compass

**Connection String:**
```
mongodb://localhost:27018
```

### Databases có sẵn:

#### 📁 **Auth** - Quản lý tài khoản
- `admins` - Super Admin & Admin
- `customers` - Khách hàng
- `restaurantadmins` - Chủ nhà hàng

#### 📁 **restaurant** - Quản lý nhà hàng
- `restaurants` - Danh sách nhà hàng
- `fooditems` - Danh sách món ăn

#### 📁 **order** - Quản lý đơn hàng
- Collections liên quan đến orders

#### 📁 **payment** - Quản lý thanh toán
- Collections liên quan đến payments

---

## 🧪 Test API Endpoints

### Auth Service (Port 5001)

#### Login Customer:
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@gmail.com","password":"customer123"}'
```

#### Register Customer:
```bash
curl -X POST http://localhost:5001/api/auth/register/customer \
  -H "Content-Type: application/json" \
  -d '{
    "firstName":"Test",
    "lastName":"User",
    "email":"test@gmail.com",
    "phone":"0999999999",
    "password":"test123",
    "location":"Ha Noi"
  }'
```

### Restaurant Service (Port 5002)

#### Lấy danh sách nhà hàng:
```bash
curl http://localhost:5002/api/restaurant/all
```

#### Lấy danh sách món ăn:
```bash
curl http://localhost:5002/api/food-items/all
```

### Order Service (Port 5005)
```bash
curl http://localhost:5005/api/orders
```

### Payment Service (Port 5004)
```bash
curl http://localhost:5004/
```

---

## 🛑 Dừng Services

```bash
docker-compose down
```

### Dừng và xóa volumes (xóa toàn bộ dữ liệu):
```bash
docker-compose down -v
```

---

## 🔄 Restart Services

```bash
docker-compose restart
```

### Restart một service cụ thể:
```bash
docker-compose restart auth-service
docker-compose restart restaurant-service
```

---

## 📊 Kiểm tra dữ liệu trong MongoDB

### Xem tất cả databases:
```powershell
docker exec -it mongo mongosh --eval "show dbs"
```

### Đếm số lượng restaurants:
```powershell
docker exec -it mongo mongosh --eval "use restaurant; print(db.restaurants.countDocuments())"
```

### Xem danh sách admins:
```powershell
docker exec -it mongo mongosh --eval "use Auth; db.admins.find({}, {password: 0}).pretty()"
```

### Xem danh sách customers:
```powershell
docker exec -it mongo mongosh --eval "use Auth; db.customers.find({}, {password: 0}).pretty()"
```

---

## ⚠️ Lưu ý quan trọng

1. **Port 27017 vs 27018**: 
   - MongoDB Windows Service chạy trên port `27017` (local, trống)
   - MongoDB Docker chạy trên port `27018` (có dữ liệu project)
   - Khi kết nối MongoDB Compass, sử dụng port **27018**

2. **Import dữ liệu sau khi restart**:
   - Nếu dừng containers với `-v` flag, dữ liệu sẽ bị xóa
   - Cần chạy lại `importData.js` và `seedUsers.js`

3. **File không đụng vào**:
   - Source code gốc không bị thay đổi
   - Chỉ thêm file `seedUsers.js` trong auth-service
   - Cập nhật `docker-compose.yml` để thêm auth-service

---

## 🎯 Architecture

```
┌─────────────────┐
│   Frontend      │
│  (Port 3000)    │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────────┐
│           API Gateway / CORS           │
└────────────────────────────────────────┘
         │
         ├─────────────┬─────────────┬─────────────┬──────────────┐
         ▼             ▼             ▼             ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Restaurant   │ │  Order   │ │ Payment  │ │   Auth   │ │   MongoDB    │
│  Service     │ │ Service  │ │ Service  │ │ Service  │ │              │
│ Port: 5002   │ │Port: 5005│ │Port: 5004│ │Port: 5001│ │ Port: 27018  │
└──────┬───────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────────┘
       │              │             │             │
       └──────────────┴─────────────┴─────────────┘
                      │
              ┌───────▼────────┐
              │   Database     │
              │   - Auth       │
              │   - restaurant │
              │   - order      │
              │   - payment    │
              └────────────────┘
```

---

## 📞 Support

Nếu gặp vấn đề, kiểm tra:
1. Docker containers có đang chạy không: `docker ps`
2. Logs của service: `docker logs <container-name>`
3. MongoDB có kết nối được không: `docker exec -it backend-mongo-1 mongosh --eval "show dbs"`

---

**Ngày tạo**: November 9, 2025  
**Version**: 1.0.0
