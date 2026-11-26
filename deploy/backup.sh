#!/usr/bin/env sh
# Daily database backup. Host crontab (crontab -e):
#   15 3 * * * cd /srv/rodo && ./deploy/backup.sh >> backups/backup.log 2>&1
# Keeps 14 days locally. Copy backups/ off this server too (OVH Object Storage, another machine) —
# a backup on the same disk does not survive losing the server.
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
set -a; . ./.env.production; set +a
file="backups/${POSTGRES_DB:-rodo}-$(date +%Y%m%d-%H%M).sql.gz"
docker compose --env-file .env.production exec -T db pg_dump -U "${POSTGRES_USER:-rodo}" -d "${POSTGRES_DB:-rodo}" --no-owner | gzip > "$file.part"
mv "$file.part" "$file"
find backups -name '*.sql.gz' -mtime +14 -delete
echo "$(date -Is) backup ok: $file ($(du -h "$file" | cut -f1))"
# Restore:  gunzip -c backups/FILE.sql.gz | docker compose --env-file .env.production exec -T db psql -U rodo -d rodo
