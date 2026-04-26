# Server - Social Networking and Learning App

Backend của dự án được xây dựng với FastAPI, sử dụng Prisma làm ORM chính kết nối với **MongoDB** (Kiến trúc hợp nhất 35 collections). Hệ thống sử dụng Redis cho caching, rate limiting và xử lý sự kiện realtime qua Pub/Sub. Toàn bộ thông báo và phản hồi API đã được bản địa hóa sang Tiếng Việt.

---

## Trạng thái dự án (Module đã hoàn thiện)

Hiện tại, hệ thống đã triển khai xong 4 phân hệ cốt lõi:

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

---

## Yêu cầu hệ thống (Prerequisites)

- **Python 3.10+** (Khuyên dùng 3.13)
- **MongoDB 7+** (Bắt buộc chạy ở chế độ **Replica Set** để hỗ trợ Prisma Transactions. Xem [Hướng dẫn cấu hình DB](prisma/DB_Setup_Guide.md))
- **Redis Server 7+** (Dùng cho Rate Limiting, Pub/Sub và Caching)
- **SMTP Server**: Cần tài khoản Gmail App Password để gửi OTP thực tế.
- **MinIO**: Dùng để lưu trữ hình ảnh bài đăng và vật phẩm (S3 compatible).

---

## Cài đặt (Setup)

### 1. Môi trường và Thư viện

```bash
cd server
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Cấu hình biến môi trường

Copy .env.example thành .env và điền các thông tin:

- MONGO_DATABASE_URL: Phải có ?replicaSet=rs0.
- REDIS_URL: redis://localhost:6379.
- MAIL\_...: Thông tin tài khoản gửi OTP.

### 3. Khởi tạo Database & Seed dữ liệu

```bash
# Tạo Prisma Client
.\venv\Scripts\python -m prisma generate

# Nạp dữ liệu mẫu (20 người dùng, bài viết, tags, v.v.)
$env:PYTHONPATH="."; .\venv\Scripts\python prisma/seed.py
```

---

## Chạy Server & Test

Chay Backend:

```bash
uvicorn app.main:app --reload
```

- Swagger UI: http://localhost:8000/docs

Chạy Test Client (Giao diện đơn giản):
Dự án có sẵn file test_client.html ở thư mục gốc để bạn test nhanh các tính năng mà không cần cài đặt Frontend phức tạp.

1.  Chạy lệnh: python -m http.server 3000 (ở thư mục gốc).
2.  Truy cập: http://localhost:3000/test_client.html

---

## Cấu trúc thư mục (Module-based)

- app/core/: Cấu hình hệ thống, Bảo mật, Exception handler.
- app/modules/account/: Logic tài khoản, OTP, Profile.
- app/modules/social/: Logic mạng xã hội, bài đăng, board, bạn bè.
- app/modules/notification/: Logic thông báo hệ thống.
- prisma/: Schema định nghĩa DB và script Seed.
- tests/: Integration tests cho các module.
