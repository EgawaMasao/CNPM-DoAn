# Grafana Dashboard Import Guide

## Cách tạo Dashboard để xem Test Failures

### Bước 1: Vào Grafana
- Truy cập: http://localhost:30300/
- Login: admin / admin123

### Bước 2: Tạo Dashboard mới
1. Click **Dashboards** → **Create** → **New dashboard**
2. Click **Add new panel**

### Bước 3: Query Loki Logs

#### Panel 1: Tất cả workflow logs
```
{job=~"restaurant-service|order-service|payment-service|auth-service|frontend"}
```

#### Panel 2: Failed tests only
```
{status="FAILED"}
```

#### Panel 3: Restaurant Service
```
{job="restaurant-service"}
```

#### Panel 4: Order Service
```
{job="order-service"}
```

#### Panel 5: Payment Service
```
{job="payment-service"}
```

#### Panel 6: Auth Service
```
{job="auth-service"}
```

#### Panel 7: Frontend
```
{job="frontend"}
```

### Cách xem test failures chi tiết:
1. Xem logs trong mỗi panel
2. Click **Show details** để xem full log output
3. Tìm "FAILED" hoặc "Error" trong logs
4. Xem test case nào fail, step nào fail

### Cách filter theo node version:
```
{job="restaurant-service", node_version="20.x"}
```

### Cách filter theo GitHub run ID:
```
{github_run="12345"}
```

---

## Quick Tips:
- **Refresh**: Click refresh icon hoặc set auto-refresh (5s recommended)
- **Time range**: Adjust time range (last 6 hours, 24 hours, etc.)
- **Search**: Use search box để filter logs
- **Save**: Click Save dashboard để lưu lại

---

## Nếu không thấy logs:

1. **Check ngrok vẫn chạy**: Terminal ngrok phải còn open
2. **Check GitHub workflow**: Vào GitHub xem workflow có chạy xong không
3. **Check Loki connection**: Vào Grafana → Configuration → Data Sources → Test Loki connection
4. **Check Loki logs**: `docker logs loki --tail 50`
