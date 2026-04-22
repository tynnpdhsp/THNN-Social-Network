# 🚀 Server - Social Networking and Learning App

Backend của dự án được xây dựng với **FastAPI**, sử dụng **Prisma** làm ORM cho **MongoDB**, **Redis** cho caching/rate limiting và **MinIO** cho lưu trữ file.

---

## 🛠 Yêu cầu hệ thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo bạn đã cài đặt:

- **Python 3.10+**
- **MongoDB** (hoặc sử dụng MongoDB Atlas)
- **Redis Server**
- **MinIO** (để upload ảnh/file)

---

## Cài đặt (Setup)

### 1. Tạo môi trường ảo

```bash
# Di chuyển vào thư mục server (nếu đang ở root dự án)
cd server

# Tạo venv
python -m venv venv

# Kích hoạt venv
# Trên Windows:
.\venv\Scripts\activate
# Trên Linux/macOS:
source venv/bin/activate
```

### 2. Cài đặt thư viện

```bash
pip install -r requirements.txt
```

### 3. Cấu hình biến môi trường

Copy file mẫu `.env.example` thành `.env` và cập nhật các giá trị phù hợp:

```bash
cp .env.example .env
```

_Lưu ý: Đảm bảo các kết nối tới MongoDB, Redis và MinIO đã chính xác._

### 4. Thiết lập Cơ sở dữ liệu (Prisma)

Sử dụng Prisma để khởi tạo và đồng bộ schema với MongoDB:

```bash
# Tạo prisma client
prisma generate

# Push schema lên database (nếu cần sync schema)
prisma db push
```

---

## Chạy Server

Khởi chạy server ở chế độ development:

```bash
uvicorn app.main:app --reload
```

Server sẽ chạy tại: [http://localhost:8000](http://localhost:8000)

- **Tài liệu API (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Tài liệu API (ReDoc):** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Chạy Tests

Dự án sử dụng `pytest` để kiểm thử:

```bash
pytest
```

---

## Cấu trúc thư mục

- `app/api/`: Các endpoint của API.
- `app/core/`: Cấu hình hệ thống, security, JWT.
- `app/models/`: Định dạng dữ liệu (Pydantic models).
- `app/services/`: Logic xử lý nghiệp vụ.
- `prisma/`: Schema định nghĩa cơ sở dữ liệu.
- `tests/`: Bộ mã nguồn kiểm thử.
