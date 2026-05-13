# Hướng dẫn deploy Social Networking App (chi tiết)

Tài liệu này là bản hướng dẫn triển khai đầy đủ theo đúng cách bạn đã làm thực tế:

- Ubuntu 22.04
- Docker + Docker Compose
- Jenkins (Pipeline from SCM + Poll SCM)
- Nginx reverse proxy
- SSL Let's Encrypt
- Grafana + Prometheus + Loki để giám sát và xem log
- Không dùng aaPanel/WAF

---

## 1) Kiến trúc triển khai

- Domain public: `https://social.hcmue.info.vn`
- SSH server: cổng `26266`
- Jenkins UI: truy cập qua SSH tunnel `127.0.0.1:8080`
- Container ứng dụng:
  - `social-frontend` -> `127.0.0.1:3000`
  - `social-backend` -> `127.0.0.1:8000`
- Container dữ liệu:
  - `social-mongodb` -> `127.0.0.1:27017`
  - `social-redis` -> `127.0.0.1:6379`
  - `social-minio` -> `127.0.0.1:9000`
  - MinIO console -> `127.0.0.1:9001`
- Monitoring:
  - Grafana -> `127.0.0.1:3001`
  - Prometheus -> `127.0.0.1:9090`
  - Loki -> `127.0.0.1:3100`

---

## 2) Chuẩn bị server

### 2.1 Kiểm tra Docker

```bash
docker --version
docker compose version
```

### 2.2 Mở cổng cần thiết (mức hệ điều hành)

Giữ public:

- `26266` (SSH)
- `80` (HTTP)
- `443` (HTTPS)

Không public:

- `3000`, `8000`, `27017`, `6379`, `9000`, `9001`, `3001`, `9090`, `3100`

### 2.3 Tạo thư mục triển khai

```bash
sudo mkdir -p /opt/social-app/{data,app,monitoring}
sudo chown -R jenkins:jenkins /opt/social-app
```

---

## 3) Deploy data stack: MongoDB + Redis + MinIO

Sử dụng file trong repo:

- `deploy/data/docker-compose.yml`
- `deploy/data/env.example`

### 3.1 Tạo file `.env` cho data stack

```bash
cd /opt/social-app/data
cp env.example .env
nano .env
chmod 600 .env
```

Điền giá trị thật cho:

- `MONGO_ROOT_USER`
- `MONGO_ROOT_PASSWORD`
- `REDIS_PASSWORD`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`

### 3.2 Tạo Mongo keyfile (bắt buộc cho replica set + auth)

```bash
cd /opt/social-app/data
openssl rand -base64 756 > mongo-keyfile
sudo chown 999:999 mongo-keyfile
sudo chmod 400 mongo-keyfile
```

### 3.3 Khởi động data stack

```bash
cd /opt/social-app/data
docker compose pull
docker compose up -d
docker compose ps
```

### 3.4 Khởi tạo replica set MongoDB (chạy 1 lần)

```bash
cd /opt/social-app/data
set -a; . ./.env; set +a
docker compose exec mongodb mongosh -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval '
  try { rs.status() } catch (e) {
    rs.initiate({_id:"rs0",members:[{_id:0,host:"mongodb:27017"}]})
  }
'
```

Khi thành công thường có dạng `{ ok: 1 }`.

### 3.5 Kiểm tra cổng chỉ bind nội bộ

```bash
ss -tlnp | grep -E '27017|6379|9000|9001'
```

Kỳ vọng: tất cả bind `127.0.0.1:*`

---

## 4) Deploy app stack: Backend + Frontend Docker

Sử dụng file:

- `deploy/app/docker-compose.yml`
- `deploy/app/env.example`
- `deploy/app/nginx.frontend.conf`
- `server/Dockerfile`
- `server/docker-entrypoint.sh`
- `client/Dockerfile`

### 4.1 Tạo file `.env` cho app stack

```bash
cd /opt/social-app/app
cp env.example .env
nano .env
chmod 600 .env
```

Các biến quan trọng phải đúng:

- `MONGO_DATABASE_URL` trỏ `mongodb:27017` + `replicaSet=rs0`
- `REDIS_URL` trỏ `redis:6379`
- `MINIO_ENDPOINT=minio:9000`
- `CORS_ORIGINS=["https://social.hcmue.info.vn"]`
- `VITE_API_BASE=/api/v1`
- `VITE_MINIO_PUBLIC_URL=https://social.hcmue.info.vn/storage`

### 4.2 Chạy app stack

```bash
cd /opt/social-app/app
BUILD_CONTEXT=/path/to/SocialNetworking-And-Learning-App \
docker compose --env-file .env up -d --build
docker compose ps
```

### 4.3 Kiểm tra backend/frontend nội bộ

```bash
curl -fsS http://127.0.0.1:8000/health
curl -I http://127.0.0.1:3000
```

---

## 5) Cấu hình Jenkins CI/CD

## 5.1 Truy cập Jenkins qua tunnel

Từ máy local:

```bash
ssh -L 8080:127.0.0.1:8080 root@social.hcmue.info.vn -p 26266
```

Mở trình duyệt: `http://127.0.0.1:8080`

### 5.2 Cấu hình job

Tạo job kiểu **Pipeline** và cấu hình:

- Definition: `Pipeline script from SCM`
- SCM: `Git`
- Repository URL: `git@github.com:omokiet/SocialNetworking-And-Learning-App.git`
- Credentials: SSH deploy key
- Branch Specifier: `*/main`
- Script Path: `Jenkinsfile`

Trigger:

- tick `Poll SCM`
- Schedule: `H/5 * * * *`

### 5.3 Quyền cho Jenkins user

```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
sudo -u jenkins docker ps
```

Kỳ vọng: không lỗi permission.

### 5.4 Lần build đầu

Trong Jenkins bấm `Build Now`.

Nếu lỗi `Permission denied` ghi vào `/opt/social-app`, chạy:

```bash
sudo chown -R jenkins:jenkins /opt/social-app
sudo chmod -R u+rwX /opt/social-app
```

---

## 6) Cấu hình Nginx reverse proxy

Dùng file mẫu: `deploy/nginx/social.hcmue.info.vn.conf`

### 6.1 Áp cấu hình site

```bash
sudo cp deploy/nginx/social.hcmue.info.vn.conf /etc/nginx/sites-available/social.hcmue.info.vn
sudo ln -s /etc/nginx/sites-available/social.hcmue.info.vn /etc/nginx/sites-enabled/social.hcmue.info.vn
sudo rm -f /etc/nginx/sites-enabled/default
```

### 6.2 Kiểm tra và reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 6.3 Test route HTTP

```bash
curl -I http://social.hcmue.info.vn/
curl -I http://social.hcmue.info.vn/api/v1/shop/categories
curl -I http://social.hcmue.info.vn/storage/
```

Ghi chú:

- `/storage/` có thể trả `400/403/404` tùy object/bucket policy, miễn là route đi đúng MinIO upstream.

---

## 7) Cấp SSL Let's Encrypt

### 7.1 Cài certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2 Cấp chứng chỉ

```bash
sudo certbot --nginx -d social.hcmue.info.vn
```

Trong wizard:

- nhập email
- đồng ý terms
- chọn redirect HTTP -> HTTPS

### 7.3 Kiểm tra sau cấp SSL

```bash
curl -I https://social.hcmue.info.vn/
curl -I https://social.hcmue.info.vn/api/v1/shop/categories
curl -I http://social.hcmue.info.vn/
```

Kỳ vọng:

- HTTPS trả 200/304
- HTTP tự redirect sang HTTPS

### 7.4 Kiểm tra auto renew

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

## 8) Monitoring + logs: Grafana, Prometheus, Loki

### 8.1 Chuẩn bị compose monitoring

Trong `/opt/social-app/monitoring` tạo:

- `docker-compose.yml`
- `prometheus/prometheus.yml`
- `promtail/config.yml`

Stack gồm:

- `grafana`
- `prometheus`
- `loki`
- `promtail`
- `node-exporter`
- `cadvisor`

### 8.2 Khởi động stack monitoring

```bash
cd /opt/social-app/monitoring
docker compose up -d
docker compose ps
```

### 8.3 Truy cập Grafana qua tunnel

```bash
ssh -L 33001:127.0.0.1:3001 root@social.hcmue.info.vn -p 26266
```

Mở: `http://127.0.0.1:33001`

### 8.4 Add datasource

Trong Grafana:

- Prometheus: `http://prometheus:9090`
- Loki: `http://loki:3100`

### 8.5 Dashboard gợi ý

- ID `1860` (Node Exporter Full)
- ID `193` (Docker/cAdvisor)

---

## 9) Các file quan trọng trong repo

- `Jenkinsfile`
- `deploy/data/docker-compose.yml`
- `deploy/data/env.example`
- `deploy/app/docker-compose.yml`
- `deploy/app/env.example`
- `deploy/nginx/social.hcmue.info.vn.conf`
- `server/Dockerfile`
- `server/docker-entrypoint.sh`
- `client/Dockerfile`

---

## 10) Vận hành và backup

- Không commit `.env` thật lên Git
- Backup định kỳ:
  - `/opt/social-app/data/.env`
  - `/opt/social-app/app/.env`
  - Docker volumes (`mongo`, `redis`, `minio`, `grafana`)
  - `/etc/nginx`
- Theo dõi:
  - Sức khỏe hệ thống qua Grafana
  - Log ứng dụng qua Loki

---