# Hướng Dẫn Khởi Tạo Database (MongoDB + Prisma)

Tài liệu này ghi chú các bước ngắn gọn để khởi tạo, đồng bộ cấu trúc (schema) và sinh (generate) Prisma Client cho dự án backend.

## Yêu cầu ban đầu

1. Cài đặt Python và tạo môi trường ảo (virtual environment) trong thư mục `server`.
2. Cài đặt đầy đủ các gói requirements bằng lệnh `pip install -r requirements.txt`.
3. **MongoDB phải được cấu hình chạy ở chế độ Replica Set (bắt buộc cho Prisma & MongoDB transactions)**.
4. Windows: Nên có sẵn `.env` (chứa `PYTHONUTF8=1` nội bộ hoặc đã lưu file `schema.prisma` bỏ dấu tiếng Việt để không dính lỗi mã hóa khi chạy prisma).

## Cấu hình MongoDB Replica Set (Bắt buộc)

Prisma yêu cầu MongoDB phải chạy dưới dạng Replica Set để hỗ trợ transactions. Dưới đây là cách setup Single-Node Replica Set:

### Cách 1: Sử dụng Docker (Khuyên dùng)

Nếu bạn có Docker, chỉ cần chạy các lệnh sau:

```bash
# Chạy container MongoDB với tham số replSet
docker run --name mongo-rs -p 27017:27017 -d mongo --replSet rs0

# Khởi tạo Replica Set
docker exec -it mongo-rs mongosh --eval "rs.initiate()"
```

### Cách 2: Cài đặt trực tiếp trên Windows

1. Mở file cấu hình của MongoDB (thường nằm ở `C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg`).
2. Thêm hoặc mở comment cấu hình replication:
   ```yaml
   replication:
     replSetName: "rs0"
   ```
3. Khởi động lại service MongoDB trong `services.msc` (tìm MongoDB Server -> Restart).
4. Mở terminal, gõ `mongosh` và chạy lệnh (Nếu không có Mongosh, phải tự cài trên mạng và config ở system path):
   ```javascript
   rs.initiate();
   ```

**Lưu ý:** Chuỗi kết nối trong file `server/.env` phải có tham số `replicaSet`, ví dụ:
`MONGO_DATABASE_URL="mongodb://localhost:27017/mxh_thnn?replicaSet=rs0"`

## Các Bước Khởi Tạo Database

### Bước 1: Mở Terminal ở thư mục `server`

Sử dụng PowerShell hoặc Command Prompt và trỏ đường dẫn tới `server`.

```powershell
cd server
```

### Bước 2: Kích hoạt môi trường ảo (Virtual Environment)

Prisma CLI được cài đặt thông qua Python (`prisma-client-py`), do đó bạn **BẮT BUỘC** phải bật môi trường ảo trước để hệ thống nhận diện đúng lệnh `prisma`.

Trên Windows (PowerShell):

```powershell
.\venv\Scripts\Activate.ps1
```

Trên MacOS/Linux:

```bash
source venv/bin/activate
```

### Bước 3: Đồng bộ Schema với Database

Để tạo các bộ siêu dữ liệu và index Mongo, chạy lệnh push của Prisma:

```powershell
prisma db push
```

Lệnh này sẽ:

1. Đọc file `server/prisma/schema.prisma`.
2. Kết nối tới database (theo `MONGO_DATABASE_URL`).
3. Tạo ra các collection và build các index (`@unique`, `@@index`,...).
4. Sau khi push thành công, nó sẽ tự động chạy `prisma generate` để sinh Prisma Client cho Python nằm trong thư mục `venv/Lib/site-packages/prisma`.

### Bước 4 (Tùy chọn): Generate Prisma Client thủ công

Chỉ dùng nếu bạn cập nhật code `prisma` trên nhánh mới nhưng chưa muốn db bị ghi đè, hoặc khi schema.prisma của bạn có thay đổi nhưng tự bạn tạo các metadata khác.

```powershell
prisma generate
```

## Khắc Phục Lỗi Thường Gặp

- **`Error: spawn prisma-client-py ENOENT`**: Do bạn chưa active venv. Vui lòng làm lại Bước 2.
- **`UnicodeEncodeError: 'charmap' codec can't encode character...`**: Là lỗi in ấn cp1258 của Python trên máy Windows. Đã được khắc phục trong source bằng cách parse schema thành chuẩn ASCII, bạn không cần làm gì thêm.
- **Không kết nối được Data (Error P1001)**: Kiểm tra lại xem MongoDB chạy chưa và chuỗi kết nối trong `server/.env` đã đúng cổng chưa.
