#!/usr/bin/env bash
# Dumps the Avshesh database from the running compose stack into backups/avshesh-<timestamp>.dump
# (PostgreSQL custom format: compressed, restorable with scripts/restore.sh).
# Usage: bash scripts/backup.sh [output-dir]      Keep the files somewhere other than this laptop/server.
set -euo pipefail
cd "$(dirname "$0")/.."
out_dir="${1:-backups}"
mkdir -p "$out_dir"
file="$out_dir/avshesh-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T db pg_dump -U avshesh -d avshesh --format=custom --no-owner > "$file"
# An empty or truncated dump is worse than none: refuse it.
if [ ! -s "$file" ] || ! docker compose exec -T db pg_restore --list < "$file" > /dev/null; then
  rm -f "$file"
  echo "backup failed: dump is empty or unreadable" >&2
  exit 1
fi
echo "backup written: $file ($(wc -c < "$file") bytes)"
