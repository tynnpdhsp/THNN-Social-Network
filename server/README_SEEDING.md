# Database Seeding Guide

Script seed thực tế của dự án là [`prisma/seed.py`](./prisma/seed.py). Script **xóa toàn bộ dữ liệu** trong các collection liên quan trước khi tạo lại — chỉ dùng môi trường dev.

## Điều kiện

- MongoDB đang chạy (replica set nếu dùng Prisma transaction như production).
- Đã `prisma generate` và `prisma db push` (hoặc migrate tương đương).
- File `.env` trong thư mục `server` có `MONGO_DATABASE_URL` đúng.

## Chạy seed

Từ thư mục **`server`** (bắt buộc `PYTHONPATH=.` vì script import `app.core.security`):

```bash
cd server
PYTHONPATH=. python prisma/seed.py
```

Windows (PowerShell):

```powershell
cd server
$env:PYTHONPATH="."
python prisma/seed.py
```

## Tài khoản mẫu

Mật khẩu mặc định mọi tài khoản: **`password123`**

| Email | Vai trò | Ghi chú |
|-------|---------|---------|
| `admin@thnn.com` | admin | Quản trị |
| `student1@thnn.com` … `student20@thnn.com` | student | 20 tài khoản sinh viên |

## Dữ liệu được tạo (tóm tắt)

1. **Roles**: `admin`, `student`
2. **Users**: 1 admin + 20 sinh viên (privacy + notification settings)
3. **Social**: Bạn bè (Sinh viên 1 kết bạn với SV 2–10), thẻ bảng tin, ~15 bài viết (feed + board), like mẫu
4. **Messaging**: Một cuộc hội thoại 1-1 giữa SV1 và SV2, vài tin nhắn
5. **Shop**: Một danh mục, một mặt hàng mẫu, một đơn đã thanh toán
6. **Documents / Places**: Vài bản ghi mẫu (tài liệu, địa điểm, review)
7. **Reports**: Báo cáo user và bài viết mẫu (trạng thái pending)

Chi tiết logic nằm trong `prisma/seed.py` (có thể chỉnh trực tiếp file này để thêm dữ liệu).

## Master data (không thuộc seed.py)

Danh mục hệ thống (roles, categories, tags…) có thể bootstrap qua script ở data stack — xem [`../deploy/data/bootstrap_defaults.sh`](../deploy/data/bootstrap_defaults.sh) và [DEPLOY_GUIDE.md](../DEPLOY_GUIDE.md).

## Gọi API sau khi seed

Ví dụ đăng nhập (đổi email nếu cần):

```bash
curl -X POST "http://localhost:8000/api/v1/account/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=student1@thnn.com&password=password123"
```

## Xử lý sự cố

- **ImportError: app**: Chạy lại với `PYTHONPATH=.` từ thư mục `server`.
- **Lỗi kết nối MongoDB**: Kiểm tra `MONGO_DATABASE_URL` trong `.env` (replica set nếu bắt buộc).
- **Prisma client**: `prisma generate --schema prisma/schema.prisma`
