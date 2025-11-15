## Tổng quan tests (frontend)

Hiện tại `frontend` repository có ít hoặc không có unit tests trong kho mã (không tìm thấy `__tests__` hay `*.test.js`). Các file `TEST_UNIT.md` và `TEST_INTEGRATION.md` trống.

## Khuyến nghị
- Thêm unit tests cho React components bằng Jest + React Testing Library.
- Thêm e2e tests (Playwright hoặc Cypress) nếu muốn kiểm thử flows (đăng ký, đặt hàng, thanh toán).

## Gợi ý cấu trúc test nhanh
- Unit tests: `src/__tests__/` hoặc `src/components/__tests__/`.
- Npm scripts (example):

```json
"scripts": {
  "test": "react-scripts test",
  "test:unit": "react-scripts test --env=jsdom",
  "test:coverage": "react-scripts test --coverage"
}
```

## Mẫu test component (gợi ý)
- Test render component, interactions (click, input), và snapshot.

## Muốn tôi làm gì tiếp?
- A: Tạo 2-3 unit tests mẫu cho `frontend` (component đơn giản).
- B: Scaffold Jest + RTL config (nếu chưa có).
- C: Không cần, tiếp tục với backend.
