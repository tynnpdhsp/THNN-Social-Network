<div align="center">

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=40&pause=1000&color=6366F1&center=true&vCenter=true&width=620&lines=THNN+Social+Network)](https://git.io/typing-svg)

<img src="https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge" alt="Version" />
<img src="https://img.shields.io/badge/license-Apache_2.0-green?style=for-the-badge" alt="License" />
<img src="https://img.shields.io/badge/status-Active-success?style=for-the-badge" alt="Status" />

<br/>

![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-009485?style=for-the-badge&logo=fastapi&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB_7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis_7-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C72E49?style=for-the-badge&logo=minio&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Jenkins](https://img.shields.io/badge/Jenkins-D24939?style=for-the-badge&logo=jenkins&logoColor=white)

**Mạng xã hội và học tập dành cho sinh viên - kết nối, chia sẻ tài liệu, quản lý thời khoá biểu và mua sắm trong một nền tảng.**

</div>

---

## Giới thiệu

THNN Social Network là ứng dụng full-stack dành cho sinh viên, bao gồm các tính năng:

- **Mạng xã hội**: Đăng bài, reactions, bình luận, kết bạn.
- **Nhắn tin**: Chat thời gian thực qua WebSocket.
- **Tài liệu học tập**: Chia sẻ và tìm kiếm tài liệu học tập.
- **Thời khoá biểu**: Quản lý lịch học và nhắc nhở tự động.
- **Bản đồ địa điểm**: Khám phá địa điểm học tập qua Leaflet.
- **Shop**: Mua bán vật phẩm với thanh toán VNPay.
- **Thông báo**: Hệ thống thông báo realtime.
- **Admin**: Quản trị hệ thống và người dùng.

---

## Cấu trúc thư mục

```
SocialNetworking-And-Learning-App/
├── client/                         # Giao diện (React 19 + Vite)
│   ├── src/
│   │   ├── components/             # Auth, Common, Map, Shop, Social, StudyDocs, Timetable...
│   │   ├── context/                # AuthContext
│   │   ├── services/               # API calls
│   │   └── config/                 # Cấu hình API endpoint
│   ├── Dockerfile
│   └── .env.example
│
├── server/                         # API Backend (FastAPI)
│   ├── app/
│   │   ├── main.py                 # Entry point, đăng ký routers & lifespan
│   │   ├── core/                   # Config, security, Redis, cache, dependencies
│   │   ├── modules/                # account, social, messaging, notification,
│   │   │                           # documents, schedule, place, shop, admin
│   │   └── utils/                  # Storage (MinIO), email, OTP
│   ├── prisma/                     # Schema, seed, hướng dẫn DB
│   ├── tests/
│   ├── Dockerfile
│   └── .env.example
│
├── deploy/
│   ├── app/                        # docker-compose backend + frontend
│   ├── data/                       # docker-compose MongoDB + Redis + MinIO
│   └── nginx/                      # Nginx reverse proxy config (host)
│
├── Jenkinsfile                     # CI/CD pipeline
├── DEPLOY_GUIDE.md                 # Hướng dẫn triển khai chi tiết
└── LICENSE
```

---

## Yêu cầu

| | Local | Docker / Server |
|---|---|---|
| Runtime | Python 3.10+, Node.js 18+ | Docker 24+, Docker Compose v2 |
| Database | MongoDB 7 (replica set), Redis 7, MinIO | — (chạy qua data stack) |
| OS | — | Ubuntu 22.04 |

---

## Chạy local

```bash
git clone https://github.com/omokiet/SocialNetworking-And-Learning-App.git
cd SocialNetworking-And-Learning-App
```

**1. Khởi động data stack:**

```bash
cd deploy/data
cp env.example .env          # Điền MONGO_ROOT_USER/PASSWORD, REDIS_PASSWORD, MINIO_ROOT_USER/PASSWORD
openssl rand -base64 756 > mongo-keyfile && chmod 400 mongo-keyfile
docker compose --env-file .env up -d
```

**2. Backend:**

```bash
cd server
cp .env.example .env         # Điền đầy đủ giá trị
pip install -r requirements.txt
prisma generate --schema prisma/schema.prisma
prisma db push --schema prisma/schema.prisma
uvicorn app.main:app --reload
```

> API docs: `http://localhost:8000/docs` | Health: `http://localhost:8000/health`

**3. Frontend:**

```bash
cd client
cp .env.example .env.local   # Điền VITE_API_BASE, VITE_MINIO_PUBLIC_URL
npm install && npm run dev
```

> Truy cập: `http://localhost:5173`

---

## Cấu hình môi trường

### Backend (`server/.env`)

| Biến | Mô tả |
|------|-------|
| `MONGO_DATABASE_URL` | Connection string MongoDB (cần `replicaSet=rs0`) |
| `REDIS_URL` | Connection string Redis |
| `JWT_SECRET_KEY` | Khoá bí mật JWT |
| `SMTP_USER` / `SMTP_PASSWORD` | Tài khoản Gmail (App Password) |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Thông tin MinIO |
| `VNPAY_TMN_CODE` / `VNPAY_HASH_SECRET` / `VNPAY_RETURN_URL` | Thông tin VNPay |

Xem đầy đủ tại [`server/.env.example`](./server/.env.example).

### Frontend (`client/.env.local`)

| Biến | Mô tả |
|------|-------|
| `VITE_API_BASE` | URL REST API backend |
| `VITE_WS_BASE` | URL WebSocket (tuỳ chọn) |
| `VITE_MINIO_PUBLIC_URL` | URL public để hiển thị ảnh từ MinIO |

Xem đầy đủ tại [`client/.env.example`](./client/.env.example).

---

## Triển khai

Hướng dẫn triển khai đầy đủ lên server (Ubuntu + Docker + Jenkins + Nginx + SSL + Monitoring): **[DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)**

Tóm tắt kiến trúc:

```
Internet → Nginx (host) :443/:80
             ├── /          → social-frontend  :3000
             ├── /api/v1    → social-backend   :8000
             └── /storage   → social-minio     :9000
```

CI/CD tự động qua **Jenkins** (Poll SCM `H/5 * * * *`) — mỗi push lên `main` sẽ build và deploy lại toàn bộ app stack.

---

<div align="center">

<img src="https://img.shields.io/badge/License-Apache_2.0-orange?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="Apache 2.0 License" />

<br/>

Dự án này được phát hành theo giấy phép **Apache License 2.0**

</div>
