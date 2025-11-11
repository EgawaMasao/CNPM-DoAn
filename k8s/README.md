# Kubernetes Deployment Guide

## Yêu cầu

1. **Kubernetes cluster** đang chạy (Minikube, Docker Desktop, hoặc cloud provider)
2. **kubectl** đã được cài đặt và cấu hình
3. **Docker images** đã được build cho tất cả services

## Bước 1: Build Docker Images

Trước tiên, build tất cả Docker images:

```bash
# Build Auth Service
docker build -t auth-service:latest ./backend/auth-service

# Build Order Service
docker build -t order-service:latest ./backend/order-service

# Build Restaurant Service
docker build -t restaurant-service:latest ./backend/restaurant-service

# Build Payment Service
docker build -t payment-service:latest ./backend/payment-service

# Build Frontend
docker build -t frontend:latest ./frontend
```

### Nếu sử dụng Minikube

Nếu bạn đang sử dụng Minikube, bạn cần load images vào Minikube:

```bash
minikube image load auth-service:latest
minikube image load order-service:latest
minikube image load restaurant-service:latest
minikube image load payment-service:latest
minikube image load frontend:latest
```

## Bước 2: Cấu hình Secrets

**QUAN TRỌNG**: Trước khi deploy, bạn cần cập nhật file `secret.yaml` với các giá trị thực tế của bạn:

1. Mở file `k8s/secret.yaml`
2. Thay thế các giá trị placeholder với thông tin thực tế:
   - `JWT_SECRET`: Secret key cho JWT
   - `STRIPE_SECRET_KEY`: Stripe secret key
   - `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
   - `REACT_APP_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
   - `TWILIO_ACCOUNT_SID`: Twilio account SID
   - `TWILIO_AUTH_TOKEN`: Twilio auth token
   - `TWILIO_PHONE_NUMBER`: Twilio phone number
   - `RESEND_API_KEY`: Resend API key

## Bước 3: Deploy lên Kubernetes

Deploy các resources theo thứ tự:

```bash
# 1. Tạo namespace
kubectl apply -f k8s/namespace.yaml

# 2. Tạo ConfigMap và Secret
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 3. Deploy MongoDB
kubectl apply -f k8s/mongodb-deployment.yaml

# 4. Đợi MongoDB ready
kubectl wait --for=condition=ready pod -l app=mongodb -n cnpm-food-delivery --timeout=300s

# 5. Deploy các services
kubectl apply -f k8s/auth-service-deployment.yaml
kubectl apply -f k8s/order-service-deployment.yaml
kubectl apply -f k8s/restaurant-service-deployment.yaml
kubectl apply -f k8s/payment-service-deployment.yaml

# 6. Deploy Frontend
kubectl apply -f k8s/frontend-deployment.yaml

# 7. Deploy Ingress (tùy chọn)
kubectl apply -f k8s/ingress.yaml
```

## Bước 4: Cài đặt Ingress Controller (nếu chưa có)

Nếu bạn sử dụng Minikube và chưa có Ingress controller:

```bash
minikube addons enable ingress
```

Hoặc cài đặt NGINX Ingress Controller:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```

## Bước 5: Kiểm tra trạng thái

```bash
# Xem tất cả pods
kubectl get pods -n cnpm-food-delivery

# Xem tất cả services
kubectl get services -n cnpm-food-delivery

# Xem logs của một service cụ thể
kubectl logs -f deployment/auth-service -n cnpm-food-delivery

# Xem chi tiết pod
kubectl describe pod <pod-name> -n cnpm-food-delivery
```

## Bước 6: Truy cập ứng dụng

### Sử dụng NodePort (đơn giản nhất)

Nếu bạn muốn truy cập trực tiếp mà không dùng Ingress, thay đổi service type thành NodePort:

```bash
# Port forward để test
kubectl port-forward service/frontend 3000:3000 -n cnpm-food-delivery
kubectl port-forward service/auth-service 5001:5001 -n cnpm-food-delivery
kubectl port-forward service/order-service 5005:5005 -n cnpm-food-delivery
kubectl port-forward service/restaurant-service 5002:5002 -n cnpm-food-delivery
kubectl port-forward service/payment-service 5004:5004 -n cnpm-food-delivery
```

Sau đó truy cập:
- Frontend: http://localhost:3000
- Auth Service: http://localhost:5001
- Order Service: http://localhost:5005
- Restaurant Service: http://localhost:5002
- Payment Service: http://localhost:5004

### Sử dụng Ingress

Nếu sử dụng Ingress, thêm vào file hosts của bạn:

**Windows** (`C:\Windows\System32\drivers\etc\hosts`):
**Linux/Mac** (`/etc/hosts`):

```
127.0.0.1 food-delivery.local
```

Nếu dùng Minikube, lấy IP:
```bash
minikube ip
```

Sau đó truy cập: http://food-delivery.local

## Bước 7: Scaling (Tùy chọn)

Scale số lượng replicas:

```bash
# Scale auth-service lên 3 replicas
kubectl scale deployment auth-service --replicas=3 -n cnpm-food-delivery

# Scale tất cả services
kubectl scale deployment --all --replicas=3 -n cnpm-food-delivery
```

## Troubleshooting

### Pod không start được

```bash
# Xem logs
kubectl logs <pod-name> -n cnpm-food-delivery

# Xem events
kubectl get events -n cnpm-food-delivery --sort-by='.lastTimestamp'

# Describe pod để xem chi tiết
kubectl describe pod <pod-name> -n cnpm-food-delivery
```

### Image pull error

Nếu gặp lỗi "ImagePullBackOff":
- Đảm bảo images đã được build
- Với Minikube, đảm bảo đã load images vào Minikube
- Kiểm tra `imagePullPolicy` trong deployment files

### MongoDB connection issues

```bash
# Test kết nối MongoDB
kubectl exec -it deployment/mongodb -n cnpm-food-delivery -- mongosh

# Check MongoDB logs
kubectl logs deployment/mongodb -n cnpm-food-delivery
```

## Dọn dẹp

Để xóa tất cả resources:

```bash
# Xóa toàn bộ namespace (sẽ xóa tất cả resources trong đó)
kubectl delete namespace cnpm-food-delivery
```

Hoặc xóa từng resource:

```bash
kubectl delete -f k8s/ingress.yaml
kubectl delete -f k8s/frontend-deployment.yaml
kubectl delete -f k8s/payment-service-deployment.yaml
kubectl delete -f k8s/restaurant-service-deployment.yaml
kubectl delete -f k8s/order-service-deployment.yaml
kubectl delete -f k8s/auth-service-deployment.yaml
kubectl delete -f k8s/mongodb-deployment.yaml
kubectl delete -f k8s/configmap.yaml
kubectl delete -f k8s/secret.yaml
kubectl delete -f k8s/namespace.yaml
```

## Production Considerations

Khi deploy lên production, bạn nên:

1. **Sử dụng external MongoDB** thay vì MongoDB trong cluster
2. **Cấu hình TLS/SSL** cho Ingress
3. **Sử dụng Secrets management** (như Vault, AWS Secrets Manager)
4. **Cấu hình Resource limits** phù hợp
5. **Thiết lập Monitoring** (Prometheus, Grafana)
6. **Cấu hình Logging** tập trung (ELK Stack, Loki)
7. **Thiết lập CI/CD pipeline**
8. **Sử dụng Container Registry** (Docker Hub, ECR, GCR)
9. **Cấu hình Auto-scaling** (HPA)
10. **Backup MongoDB** định kỳ

## Monitoring

### Xem resource usage

```bash
# CPU và Memory usage
kubectl top pods -n cnpm-food-delivery
kubectl top nodes
```

### Horizontal Pod Autoscaling (HPA)

```bash
# Tạo HPA cho auth-service
kubectl autoscale deployment auth-service --cpu-percent=70 --min=2 --max=10 -n cnpm-food-delivery

# Xem HPA
kubectl get hpa -n cnpm-food-delivery
```
