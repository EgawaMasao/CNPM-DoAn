Tổng quan kiểm thử 

- **Tổng số service**: 5 (4 backend microservices: `auth-service`, `order-service`, `payment-service`, `restaurant-service` + 1 frontend webapp `frontend`).

- **Tổng số unit tests (file count)**: 32
- **Tổng số integration tests (file count)**: 22

- **`auth-service`**:

 - **`auth-service`**:
 **Unit tests — tổng file: 8**
 	  - `auth.test.js`: unit test chi tiết cho middleware `protect` (xác thực JWT), bao phủ trường hợp token hợp lệ, token hỏng, token hết hạn, header thiếu/malformed, và xác thực population của `req.userId`/`req.userRole`.
 	  - `authRoutes.test.js`: kiểm tra các route liên quan authentication (register/login), validation input, response code cho happy-path và error-path.
 	  - `adminController.test.js`: kiểm tra logic controller cho admin (tạo admin, cập nhật quyền, xử lý lỗi validation/DB).
 	  - `Admin.test.js`: kiểm tra model `Admin` (schema, validation trường bắt buộc, method liên quan nếu có).
 	  - `restaurantAdminController.test.js`: kiểm tra controller cho restaurant admin (business logic quản lý admin nhà hàng, phân quyền, xử lý lỗi).
 	  - `RestaurantAdmin.test.js`: kiểm tra model `RestaurantAdmin` (schema & methods cơ bản).
 	  - `customerController.test.js`: kiểm tra controller khách hàng (đăng ký, cập nhật thông tin, validaton input, xử lý lỗi DB).
 	  - `Customer.test.js`: kiểm tra model `Customer` (hash password, comparePassword, validate trường, phương thức kiếm tra dữ liệu mẫu).

**Integration tests — tổng file: 4**
 	  - `auth01-jwt-secret-mismatch.test.js`: kiểm tra rủi ro khi `JWT_SECRET` không đồng bộ giữa các service — mô phỏng tạo token bởi auth-service và xác thực trên các service khác để thấy failure khi secret khác nhau.
 	  - `auth02-weak-password-validation.test.js`: kiểm tra policy mật khẩu ở tầng đăng ký — thử đăng ký với password yếu để xác định service có validate/deny hay chấp nhận (vấn đề bảo mật nếu quá lỏng).
 	  - `auth04-no-rate-limiting.test.js`: kiểm tra thiếu rate-limiting trên endpoints auth (login/register) để mô phỏng brute-force hoặc credential stuffing — mục tiêu là chỉ ra rủi ro và đề xuất mitigations.
 	  - `auth06-plaintext-credentials.test.js`: kiểm tra rủi ro lưu/truyền credentials ở dạng plaintext (ví dụ logging, DB field, hoặc truyền trong network) — đảm bảo mật khẩu không bị lộ.

 	- **Tập trung (tóm tắt)**:
 	  - Unit: cô lập logic auth (middleware, controllers, models) — dùng mock để kiểm tra luồng xử lý, edge-cases, và cách phản hồi HTTP.
 	  - Integration: kiểm tra rủi ro bảo mật & tích hợp (JWT secret synchronization, password policy, rate-limiting, không lộ credentials) — các test này mô phỏng môi trường cross-service hoặc tương tác với DB/HTTP thực.

- **`order-service`**:

 - **`order-service`**:
**Unit tests — tổng file: 7**
 	  - `userRoutes.test.js`: kiểm tra các route liên quan tới user (mounting route, validation input, response codes).
 	  - `userModel.test.js`: kiểm tra model `User` (validation, methods nếu có, lưu/đọc dữ liệu mẫu bằng mock hoặc DB test).
 	  - `userController.test.js`: kiểm tra logic controller cho user (tạo, cập nhật, xử lý lỗi trả về HTTP phù hợp).
 	  - `orderRoutes.test.js`: kiểm tra route liên quan tới orders (đa số là mapping route → controller, middleware gọi trước khi controller).
 	  - `orderModel.test.js`: kiểm tra model `Order` (schema, helper methods, tính toàn vẹn dữ liệu khi lưu/lookup).
 	  - `orderController.test.js`: kiểm tra logic xử lý order (tạo order, tính `totalPrice`, cập nhật order, xử lý trường hợp thiếu trường, xử lý lỗi DB). Đây là file chứa nhiều unit test mô phỏng behavior business logic.
 	  - `authMiddleware.test.js`: kiểm tra middleware xác thực/authorization dùng trong order-service (đảm bảo trả 401 khi token thiếu/không hợp lệ và cho phép khi token hợp lệ).

 	- **Integration tests — tổng file: 6**
 	  - `risk01-jwt-secret-mismatch.test.js`: mô phỏng token JWT được tạo bởi `auth-service` với secret khác — kiểm tra rằng order-service từ chối token không cùng secret (rủi ro cross-service auth mismatch).
 	  - `risk03-ghost-references.test.js`: kiểm tra ghost references/tham chiếu rỗng trong DB (khi một order tham chiếu tới resource đã bị xóa), đảm bảo service xử lý graceful hoặc trả lỗi rõ ràng.
 	  - `risk05-websocket-auth.test.js`: kiểm tra authentication cho websocket (nếu có), đảm bảo chỉ client hợp lệ mới được kết nối và các event realtime (ví dụ updateOrder) chỉ gửi tới client đã xác thực.
 	  - `risk07-payment-sync.test.js`: kiểm tra đồng bộ trạng thái giữa order và payment (khi nhận event từ payment-service), đảm bảo order status cập nhật chính xác (Paid, Failed, Pending).
 	  - `risk10-cors-wildcard.test.js`: kiểm tra cấu hình CORS (nếu để wildcard có thể gây rủi ro), đảm bảo trình duyệt/clients không vô tình truy cập trái phép.
 	  - `risk08-mongodb-isolation.test.js`: kiểm tra isolation của MongoDB trong môi trường test (ví dụ dùng test DB riêng, đảm bảo test không ảnh hưởng DB production, và cuộc kiểm tra race/isolation giữa các test song song).

 	- **Tập trung (tóm tắt)**:
 	  - Unit: validate input ở tầng route/controller (customerId, items), tính toán `totalPrice`, cập nhật trạng thái order, xử lý lỗi DB; hầu hết test dùng mock để cô lập logic.
 	  - Integration: kiểm tra rủi ro tích hợp (JWT secret mismatch, tham chiếu DB bị mất, đồng bộ với payment-service, websocket auth, và cấu hình hạ tầng như CORS/Mongo isolation).


- **`payment-service`**:

 - **`payment-service`**:
**Unit tests — tổng file: 6**
 	  - `paymentService.test.js`: kiểm tra endpoint xử lý thanh toán (happy-path), tạo payment intent (Stripe) và phản hồi chứa `clientSecret`; mock DB và dịch vụ bên ngoài (Twilio/Stripe) để kiểm tra luồng chính và xử lý lỗi khi gửi SMS/email thất bại.
 	  - `paymentRoutes.test.js`: kiểm tra mapping route → controller, trạng thái HTTP trả về cho các trường hợp (200/400/500) và middleware trước khi vào controller.
 	  - `PaymentModel.test.js`: kiểm tra các phương thức model (findOne, findOneAndUpdate, save), trạng thái payment lưu vào DB và chuyển trạng thái (Pending → Success/...).
 	  - `emailService.test.js`: kiểm tra logic gửi email/notification (mock) — xử lý success/failure và cách service xử lý lỗi ngoài (retry hoặc trả lỗi mềm).
 	  - `webhookRoutes.test.js`: unit test cho endpoint webhook (xử lý body, trả 200 khi event hợp lệ), mô phỏng `stripe.webhooks.constructEvent` bằng mock để kiểm tra luồng xử lý event.
 	  - `twilioService.test.js`: kiểm tra service gửi SMS (mock), bao gồm kịch bản khi Twilio trả lỗi để đảm bảo service bắt và log/không làm sập endpoint.

**Integration tests — tổng file: 6**
 	  - `risk01-client-secret-leakage.test.js`: kiểm tra rủi ro rò rỉ `client_secret` hoặc các secret khác qua logs/response — đảm bảo không trả secret về client và không log thông tin nhạy cảm.
 	  - `risk02-duplicate-orderid-race.test.js`: mô phỏng race condition khi nhiều request cùng orderId được gửi đồng thời — kiểm tra idempotency/khóa tránh duplicate payment/order records.
 	  - `risk03-price-manipulation.test.js`: kiểm tra server chấp nhận/không chấp nhận giá do client gửi (price manipulation). Test xác minh Stripe được gọi với amount theo server-side calculation hoặc theo client (phát hiện lỗ hổng nếu server dùng giá do client gửi).
 	  - `risk04-webhook-signature-verification.test.js`: kiểm tra xác thực signature webhook (Stripe) — webhook hợp lệ xử lý event, signature sai bị từ chối và không thay đổi DB.
 	  - `risk09-sensitive-logging.test.js`: kiểm tra rằng logs không chứa thông tin nhạy cảm (secret, thẻ, token) khi lỗi xảy ra hoặc khi xử lý webhook/payment.
 	  - `risk10-no-idempotency-key.test.js`: kiểm tra hậu quả khi không truyền idempotency key — đảm bảo hệ thống có behavior an toàn (reject or dedupe) hoặc document rủi ro nếu không có idempotency.

 	- **Ghi chú**: nhiều integration test mô phỏng tương tác với Stripe/Twilio/MongoDB; một số tài liệu (ví dụ `INTEGRATION_TEST_FIXES.md`) báo số lượng test lớn hơn số file hiện có — có thể repo giữ test cases bổ sung trong CI hoặc đã gom nhiều test case trong một file.

- **`restaurant-service`**:
	- **Unit tests (tc folder) — tổng file: 11**
	 - `foodItem.test.js`: kiểm tra API `GET /api/food-items/restaurant/:restaurantId` trả về đúng danh sách món ăn của nhà hàng, dạng dữ liệu, và tham chiếu `restaurant` đúng _id (kiểm tra format/shape của response).
	`foodItemRoutes.test.js`: kiểm tra các route liên quan tới food items (mount route, validation input, response codes cho các trường hợp lỗi/happy-path).
	`restaurant.test.js`: kiểm tra model/validation của Restaurant (tạo, cập nhật, trường bắt buộc, và tính hợp lệ của dữ liệu mẫu).
 	  - `restaurantController.test.js`: kiểm tra logic controller (CRUD), xử lý lỗi khi DB trả về null/exception, và phản hồi HTTP phù hợp.
 	  - `restaurantRoutes.test.js`: kiểm tra mapping giữa route và controller, middleware được gọi (ví dụ auth) và response status code.
 	  - `superAdmin.test.js`: kiểm tra các hành vi liên quan tới tài khoản super admin (tạo, quyền truy cập, validation dữ liệu admin).
 	  - `superAdminRoutes.test.js`: kiểm tra route cho super admin (bảo đảm endpoints chỉ mở cho vai trò phù hợp và trả lỗi khi không hợp lệ).
 	  - `superAdminController.test.js`: kiểm tra controller cho super admin (business logic: tạo/phan-quyen/disable admin…)
 	  - `auth.test.js`: unit tests cho chức năng auth nội bộ của service (ví dụ đăng nhập, đăng ký, hash password, validate creds) — tập trung vào logic chứ không gọi các service khác.
 	  - `authMiddleware.test.js`: kiểm tra middleware xác thực/authorization (xử lý token, kiểm tra roles, trả 401 khi thiếu hoặc không đúng token).
 	  - `uploadMiddleware.test.js`: kiểm tra middleware upload (xác thực file, xử lý lỗi upload, path lưu file, response khi file không hợp lệ).
 
**Integration tests — tổng file: 6**
 	  - `risk01-jwt-secret-mismatch.test.js`: kiểm tra rủi ro khi JWT_SECRET giữa các service không đồng bộ — đảm bảo token do `auth-service` sinh ra có/không thể xác thực bởi `restaurant-service` nếu secret khác, mô phỏng secret rotation và misconfiguration.
 	  - `risk02-string-based-foreign-keys.test.js`: kiểm tra validation/consistency khi foreign key được truyền là chuỗi (string) thay vì ObjectId — phát hiện ghost reference hoặc lỗi khi lookup trong MongoDB.
 	  - `risk03-restaurant-availability-not-validated.test.js`: kiểm tra rằng trạng thái `availability` của nhà hàng/food item được validate đúng khi đặt hàng hoặc truy vấn (ngăn trả món/nhà hàng không khả dụng).
 	  - `risk04-fooditem-availability-not-validated.test.js`: tương tự trên mức món ăn — đảm bảo server từ chối thao tác trên food item không khả dụng và phản hồi hợp lý.
 	  - `risk05-price-manipulation.test.js`: mô phỏng/kiểm tra rủi ro khi client/other service gửi giá/price không hợp lệ (manipulated price) — integration test kiểm tra luồng khi order/payment tương tác với restaurant-service (ví dụ xác thực giá server-side).
 	  - `risk06-payment-order-status-sync.test.js`: kiểm tra đồng bộ trạng thái order <-> payment (khi thanh toán thành công/không thành công) và đảm bảo restaurant-service nhận được event hoặc trạng thái cập nhật hợp lệ.
 
 	- **Ghi chú**: các unit tests trong `tc/` chủ yếu mock hoặc dùng test DB cục bộ; integration tests tập trung vào rủi ro nghiệp vụ/bảo mật và tương tác giữa service với DB hoặc với các service khác.

- **`frontend`**:
	- **Unit tests**: 0 (không thấy file test thực thi; có `TEST_UNIT.md` nhưng rỗng)
	- **Integration tests**: 0
	- **Tập trung**: không có test tự động trong repo; chỉ có tài liệu test trống.

Ghi chú ngắn:
- Tổng số test được đếm bằng cách tìm file test (`*.test.js`, `__tests__`, thư mục `test/integration` hoặc `test/unit`) trong các thư mục service tương ứng.


