#!/usr/bin/env bash
set -euo pipefail

# Reset clean MongoDB app database for this project.
# - Drops the configured app DB only (default: thnn_social_network)
# - Keeps root/admin DB and container volumes intact
# - Re-initializes replica set if needed

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/docker-compose.yml}"
DB_NAME="${DB_NAME:-thnn_social_network}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env not found at: $ENV_FILE"
  echo "Hint: cp \"$SCRIPT_DIR/env.example\" \"$SCRIPT_DIR/.env\" and fill values first."
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: docker-compose.yml not found at: $COMPOSE_FILE"
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

echo "=============================================="
echo "Database reset plan"
echo "Compose file : $COMPOSE_FILE"
echo "Env file     : $ENV_FILE"
echo "Target DB    : $DB_NAME"
echo "Mongo service: mongodb"
echo "=============================================="
echo
read -r -p "Type RESET to confirm dropping database '$DB_NAME': " CONFIRM
if [[ "$CONFIRM" != "RESET" ]]; then
  echo "Cancelled."
  exit 0
fi

echo "[1/6] Ensuring data stack is up..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d mongodb

echo "[2/6] Waiting MongoDB ready..."
for i in {1..30}; do
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mongodb \
    mongosh -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin \
    --eval "db.runCommand({ ping: 1 }).ok" >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "ERROR: MongoDB is not ready after retries."
    exit 1
  fi
  sleep 2
done

echo "[3/6] Dropping app database '$DB_NAME'..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mongodb \
  mongosh -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin \
  --eval "db = db.getSiblingDB('$DB_NAME'); printjson(db.dropDatabase())"

echo "[4/6] Ensuring replica set (rs0) is initialized..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mongodb \
  mongosh -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval '
    try {
      rs.status();
      print("Replica set already configured.");
    } catch (e) {
      rs.initiate({_id:"rs0",members:[{_id:0,host:"mongodb:27017"}]});
      print("Replica set initiated.");
    }
  '

echo "[5/6] Bootstrapping default roles/categories/tags..."
bash "$SCRIPT_DIR/bootstrap_defaults.sh"

echo "[6/6] Verifying defaults..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mongodb \
  mongosh -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --eval "
    db = db.getSiblingDB('$DB_NAME');
    print('Current roles:');
    printjson(db.roles.find({}, {role:1}).toArray());
    print('Current item categories: ' + db.item_categories.countDocuments());
    print('Current document categories: ' + db.document_categories.countDocuments());
    print('Current board tags: ' + db.board_tags.countDocuments());
    print('Current place categories: ' + db.place_categories.countDocuments());
  "

echo
echo "Done. Database '$DB_NAME' has been reset cleanly."
echo "Default master data initialized. You can register and use core app features immediately."
echo "Recommended: restart backend container to refresh app state."
