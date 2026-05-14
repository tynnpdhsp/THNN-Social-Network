# Server — Social Networking and Learning App

Tài liệu tổng quan: [README.md](../README.md) · Triển khai server: [DEPLOY_GUIDE.md](../DEPLOY_GUIDE.md) · Seed dữ liệu mẫu: [README_SEEDING.md](./README_SEEDING.md)

## Backend của dự án được xây dựng với FastAPI, sử dụng Prisma làm ORM chính kết nối với **MongoDB** (Kiến trúc hợp nhất 35 collections). Hệ thống sử dụng Redis cho caching, rate limiting và xử lý sự kiện realtime qua Pub/Sub.

## Trạng thái dự án (Module đã hoàn thiện)

Hiện tại, hệ thống đã triển khai xong 6 phân hệ cốt lõi:

1.  **Module Tài khoản (Account)**:
    - Đăng ký theo luồng: Đăng ký trước -> Xác thực OTP sau.
    - Đăng nhập (JWT), Quên mật khẩu, Quản lý hồ sơ.
    - Bảo mật: Rate Limiting theo IP/Email, Refresh Token Blacklist.
2.  **Module Mạng xã hội (Social)**:
    - **Newsfeed**: Đăng bài (ảnh/văn bản), Like, Bình luận nested (2 cấp).
    - **Bạn bè**: Gửi/Chấp nhận lời mời, quản lý danh sách bạn bè, hủy kết bạn.
    - **Quyền riêng tư**: Chặn người dùng, cài đặt ai được xem bài viết/nhắn tin.
3.  **Module Bảng tin (Board)**:
    - Đăng bài theo thẻ phân loại (Tìm trọ, Mất đồ, Hỏi đáp...).
    - Lọc bài viết theo thẻ, tích hợp hệ thống báo cáo (Report) vi phạm.
4.  **Module Thông báo (Notification)**:
    - Hệ thống thông báo thời gian thực (Like, Comment, Reply, Friend Request).
    - Đếm số thông báo chưa đọc, đánh giá mức độ ưu tiên.
5.  **Module Tin nhắn (Messaging)**:
    - Chat riêng tư và chat nhóm thời gian thực (WebSocket).
    - Tích hợp Redis Pub/Sub để đồng bộ tin nhắn giữa các instance.
6.  **Module Quản trị (Admin Dashboard)**:
    - Thống kê hệ thống: User, Posts, Reports, **Doanh thu**.
    - Quản lý người dùng: Khóa/Mở khóa tài khoản, **Phân quyền (Role)**.
    - Xử lý báo cáo: Duyệt vi phạm, ẩn nội dung hoặc khóa tác giả vi phạm.

---

## Yêu cầu hệ thống (Prerequisites)

- **Python 3.10+** (Khuyên dùng 3.13)
- **MongoDB 7+** (Bắt buộc chạy ở chế độ **Replica Set** để hỗ trợ Prisma Transactions. Xem [Hướng dẫn cấu hình DB](prisma/DB_Setup_Guide.md))
- **Redis Server** (Dùng cho Rate Limiting, Pub/Sub và Caching)
  - Cách 1 (Cài đặt vào hệ thống): Tải tại [tporadowski/redis/releases](https://github.com/tporadowski/redis/releases) Sau khi cài đặt gõ `redis-server` trong cmd để chạy
  - Cách 2 (Chạy nhanh bằng PowerShell):
    ```powershell
    Invoke-WebRequest -Uri "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip" -OutFile "redis.zip"; Expand-Archive -Path "redis.zip" -DestinationPath "redis"; Remove-Item "redis.zip"
    ```
  - Lệnh chạy (cho Cách 2):
    ```powershell
    .\redis\redis-server.exe
    ```
- **SMTP Server**: Cần tài khoản Gmail App Password để gửi OTP thực tế.
- **MinIO**: Dùng để lưu trữ hình ảnh bài đăng và vật phẩm (S3 compatible).
  - Tải `minio.exe` từ [Min.io](https://dl.min.io/server/minio/release/windows-amd64/minio.exe) hoặc dùng PowerShell:
    ```powershell
    Invoke-WebRequest -Uri "https://dl.min.io/server/minio/release/windows-amd64/minio.exe" -OutFile "minio.exe"
    ```
  - Chạy Server (tại thư mục chứa file `.exe`):
    ```powershell
    $env:MINIO_ROOT_USER="admin"; $env:MINIO_ROOT_PASSWORD="password123"; .\minio.exe server .\minio_data --console-address ":9001"
    ```

---

## Cài đặt (Setup)

### 1. Môi trường và Thư viện

```bash
cd server
python -m venv venv
# Windows: .\venv\Scripts\activate
# Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
```

### 2. Cấu hình biến môi trường

Copy .env.example thành .env và điền các thông tin:

- MONGO_DATABASE_URL: Phải có ?replicaSet=rs0.
- REDIS_URL: redis://localhost:6379.
- MAIL\_...: Thông tin tài khoản gửi OTP.

### 3. Khởi tạo Database & Seed dữ liệu

```bash
# Tạo Prisma Client và đồng bộ schema
prisma generate --schema prisma/schema.prisma
prisma db push --schema prisma/schema.prisma

# Nạp dữ liệu mẫu (xóa dữ liệu cũ trước khi seed — chỉ dùng dev)
# Bắt buộc chạy từ thư mục server với PYTHONPATH=. để import app.*
PYTHONPATH=. python prisma/seed.py
```

Chi tiết tài khoản mẫu và nội dung seed: [README_SEEDING.md](./README_SEEDING.md).

---

## Chạy Server

Chạy backend:

```bash
uvicorn app.main:app --reload
```

- Swagger UI: http://localhost:8000/docs

Giao diện đầy đủ: chạy frontend trong thư mục `client` (`npm run dev`). Xem [client/README.md](../client/README.md).

---

## Unit test & integration test (pytest)

Cấu hình marker trong [`pytest.ini`](./pytest.ini):

- **`unit`**: test nhanh, mock/fake — không yêu cầu MongoDB, Redis hay SMTP thật.
- **`integration`**: test HTTP + Prisma, cần dịch vụ đang chạy (xem `tests/integration/`).

**Chỉ unit test** (giống stage Jenkins *Backend unit tests*):

```bash
cd server
pip install -r requirements.txt
python -m prisma generate --schema prisma/schema.prisma
python -m pytest tests/unit --confcutdir=tests/unit -q -m unit
```

**Toàn bộ test trong repo** (unit + integration — integration cần môi trường đầy đủ, xem từng file trong `tests/integration/`):

```bash
cd server
python -m pytest tests -q
```

---

## Cấu trúc thư mục (Module-based)

- app/core/: Cấu hình hệ thống, Bảo mật, Exception handler.
- app/modules/account/: Logic tài khoản, OTP, Profile.
- app/modules/social/: Logic mạng xã hội, bài đăng, board, bạn bè.
- app/modules/notification/: Logic thông báo hệ thống.
- app/modules/messaging/: Logic tin nhắn realtime.
- app/modules/admin/: Logic quản trị và thống kê.
- prisma/: Schema định nghĩa DB và script Seed.
- tests/unit/: Unit test theo module (pytest `-m unit`).
- tests/integration/: Integration test (pytest `-m integration`).
