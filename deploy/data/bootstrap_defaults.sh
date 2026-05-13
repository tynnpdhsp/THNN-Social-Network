#!/usr/bin/env bash
set -euo pipefail

# Bootstrap default lookup/master data (idempotent).
# Safe to run many times.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/docker-compose.yml}"
DB_NAME="${DB_NAME:-thnn_social_network}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env not found at: $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${MONGO_ROOT_USER:-}" || -z "${MONGO_ROOT_PASSWORD:-}" ]]; then
  echo "ERROR: MONGO_ROOT_USER / MONGO_ROOT_PASSWORD is missing in $ENV_FILE"
  exit 1
fi

DEFAULT_BOOTSTRAP_ADMIN_BCRYPT='$2b$12$eebkrZbmBQmnHIAYZnhAveIjJ6aSNBMEPAjlPzdJnV9sXWqIBaGmu'
if [[ -n "${BOOTSTRAP_ADMIN_PASSWORD_HASH:-}" ]]; then
  BOOTSTRAP_ADMIN_BCRYPT="$BOOTSTRAP_ADMIN_PASSWORD_HASH"
else
  BOOTSTRAP_ADMIN_BCRYPT="$DEFAULT_BOOTSTRAP_ADMIN_BCRYPT"
fi
BOOTSTRAP_ADMIN_EMAIL="${BOOTSTRAP_ADMIN_EMAIL:-admin@thnn.com}"
BOOTSTRAP_ADMIN_PHONE="${BOOTSTRAP_ADMIN_PHONE:-0888999000}"
BOOTSTRAP_ADMIN_FULL_NAME="${BOOTSTRAP_ADMIN_FULL_NAME:-Quản trị viên hệ thống}"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d mongodb

echo "Bootstrapping default data into '$DB_NAME'..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mongodb \
  mongosh -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval "
    const dbApp = db.getSiblingDB('$DB_NAME');
    const now = new Date();

    // Roles (Prisma Role model has no createdAt)
    dbApp.roles.updateOne({role:'student'}, {\$set:{role:'student'}}, {upsert:true});
    dbApp.roles.updateOne({role:'admin'}, {\$set:{role:'admin'}}, {upsert:true});

    // Admin user (idempotent: chỉ tạo khi chưa có email; không ghi đè user đã tồn tại)
    const adminRole = dbApp.roles.findOne({role: 'admin'});
    const adminEmail = '${BOOTSTRAP_ADMIN_EMAIL}';
    const adminHash = '${BOOTSTRAP_ADMIN_BCRYPT}';
    const adminPhone = '${BOOTSTRAP_ADMIN_PHONE}';
    const adminFullName = '${BOOTSTRAP_ADMIN_FULL_NAME}';
    if (adminRole && !dbApp.users.findOne({email: adminEmail})) {
      dbApp.users.insertOne({
        email: adminEmail,
        phone_number: adminPhone,
        password_hash: adminHash,
        full_name: adminFullName,
        role: adminRole._id,
        email_verified: true,
        is_locked: false,
        created_at: now,
        updated_at: now
      });
      print('Seeded admin user: ' + adminEmail);
    } else if (!adminRole) {
      print('WARN: admin role missing; skipped admin user seed');
    } else {
      print('Admin user already exists (email): ' + adminEmail);
    }

    // Shop categories — Prisma requires non-null created_at (@map created_at)
    const itemCategories = [
      {name:'Giáo trình', description:'Sách giáo trình, tài liệu môn học'},
      {name:'Đồ dùng học tập', description:'Vở, bút, máy tính cầm tay, dụng cụ học tập'},
      {name:'Thiết bị điện tử', description:'Laptop, tablet, phụ kiện công nghệ'},
      {name:'Đồ sinh hoạt', description:'Đồ dùng cá nhân, ký túc xá, nhà trọ'},
      {name:'Việc làm thêm', description:'Dịch vụ hỗ trợ học tập, việc làm part-time'}
    ];
    itemCategories.forEach((c) => {
      dbApp.item_categories.updateOne(
        {name:c.name},
        {\$set:{name:c.name, description:c.description, created_at: now}},
        {upsert:true}
      );
    });

    // Document categories
    const documentCategories = [
      'Giáo trình',
      'Slide bài giảng',
      'Đề thi - Đáp án',
      'Bài tập lớn',
      'Tài liệu tham khảo',
      'Luận văn - Đồ án'
    ];
    documentCategories.forEach((name) => {
      dbApp.document_categories.updateOne(
        {name:name},
        {\$set:{name:name, created_at: now}},
        {upsert:true}
      );
    });

    // Board tags
    const boardTags = [
      {name:'Tìm trọ', slug:'tim-tro'},
      {name:'Tìm ở ghép', slug:'tim-o-ghep'},
      {name:'Mất đồ', slug:'mat-do'},
      {name:'Nhặt được đồ', slug:'nhat-duoc-do'},
      {name:'Hỏi đáp', slug:'hoi-dap'},
      {name:'Tìm người học nhóm', slug:'tim-nguoi-hoc-nhom'},
      {name:'Mua bán đồ cũ', slug:'mua-ban-do-cu'}
    ];
    boardTags.forEach((t) => {
      dbApp.board_tags.updateOne(
        {slug:t.slug},
        {\$set:{name:t.name, slug:t.slug, created_at: now}},
        {upsert:true}
      );
    });

    // Place categories
    const placeCategories = [
      {name:'Quán ăn', icon:'utensils'},
      {name:'Quán cà phê', icon:'coffee'},
      {name:'Nhà sách', icon:'book'},
      {name:'In ấn - Photocopy', icon:'printer'},
      {name:'Ký túc xá - Nhà trọ', icon:'home'},
      {name:'Bãi gửi xe', icon:'car'},
      {name:'Y tế - Nhà thuốc', icon:'hospital'}
    ];
    placeCategories.forEach((c) => {
      dbApp.place_categories.updateOne(
        {name:c.name},
        {\$set:{name:c.name, icon:c.icon, created_at: now}},
        {upsert:true}
      );
    });

    print('Roles: ' + dbApp.roles.countDocuments());
    print('Admin users (by role): ' + (adminRole ? dbApp.users.countDocuments({role: adminRole._id}) : 0));
    print('Item categories: ' + dbApp.item_categories.countDocuments());
    print('Document categories: ' + dbApp.document_categories.countDocuments());
    print('Board tags: ' + dbApp.board_tags.countDocuments());
    print('Place categories: ' + dbApp.place_categories.countDocuments());
  "

echo "Done bootstrap default data."
echo "Admin login (if vừa seed / email chưa có user): $BOOTSTRAP_ADMIN_EMAIL — default password: ChangeMeAdmin123! (unless BOOTSTRAP_ADMIN_PASSWORD_HASH set in .env)"
