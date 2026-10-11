#!/usr/bin/env bash
# Restores a dump made by scripts/backup.sh into the running compose stack. THIS REPLACES THE CURRENT DATABASE.
# Usage: bash scripts/restore.sh backups/avshesh-20260101-120000.dump [--yes]
set -euo pipefail
cd "$(dirname "$0")/.."
file="${1:?usage: restore.sh <dump-file> [--yes]}"
[ -s "$file" ] || { echo "no such dump: $file" >&2; exit 1; }
if [ "${2:-}" != "--yes" ]; then
  read -r -p "This replaces ALL data in the running database with $file. Type 'restore' to continue: " answer
  [ "$answer" = "restore" ] || { echo "cancelled"; exit 1; }
fi
# Stop the app so nothing writes while the schema is being replaced; the database stays up.
docker compose stop backend
docker compose exec -T db psql -U avshesh -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS avshesh WITH (FORCE)" -c "CREATE DATABASE avshesh OWNER avshesh"
docker compose exec -T db pg_restore -U avshesh -d avshesh --no-owner --exit-on-error < "$file"
docker compose start backend
echo "restored from $file"
