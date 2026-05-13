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

## Tài liệu khác

- Tổng quan dự án, data stack, triển khai: [README.md](../README.md) và [DEPLOY_GUIDE.md](../DEPLOY_GUIDE.md)
- Thiết kế UI (nếu có): [design/DESIGN.md](./design/DESIGN.md)

## Build production

```bash
npm run build
```

Chi tiết cấu hình Vite / ESLint xem [Vite + React](https://vite.dev/guide/).
