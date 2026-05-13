#!/usr/bin/env sh
set -eu

if [ "${RUN_DB_PUSH:-true}" = "true" ]; then
  echo "[backend] Running prisma db push..."
  prisma db push
fi

echo "[backend] Starting uvicorn on :8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
