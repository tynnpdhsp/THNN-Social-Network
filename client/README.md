# Client — THNN Social Network

Giao diện web của dự án: **React 19** + **Vite** + **React Router**.

## Chạy nhanh

```bash
cd client
cp .env.example .env.local   # Điền VITE_API_BASE, VITE_MINIO_PUBLIC_URL
npm install
npm run dev
```

Mặc định: `http://localhost:5173`

## Unit test (Vitest)

Cấu hình trong [`vitest.config.js`](./vitest.config.js). Test nằm trong `tests/unit/**/*.test.{js,jsx}` (setup: `tests/unit/setup.js`).

```bash
npm test                 # vitest run (một lần)
npm run test:watch       # vitest ở chế độ watch
npm run test:coverage    # chạy test + coverage (V8)
```

Kế hoạch và phạm vi test UI: [docs/UNIT_TEST_PLAN_FRONTEND.md](./docs/UNIT_TEST_PLAN_FRONTEND.md).

## Tài liệu khác

- Tổng quan dự án, data stack, triển khai: [README.md](../README.md) và [DEPLOY_GUIDE.md](../DEPLOY_GUIDE.md)
- Thiết kế UI (nếu có): [design/DESIGN.md](./design/DESIGN.md)

## Build production

```bash
npm run build
```

Chi tiết cấu hình Vite / ESLint xem [Vite + React](https://vite.dev/guide/).
