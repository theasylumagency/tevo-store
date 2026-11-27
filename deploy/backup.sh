#!/usr/bin/env bash
# Daily database and administrator-uploaded photo backup. Host crontab (crontab -e):
#   15 3 * * * cd /srv/rodo && ./deploy/backup.sh >> backups/backup.log 2>&1
# Keeps 14 days locally. Copy backups/ off this server too (OVH Object Storage, another machine) —
# a backup on the same disk does not survive losing the server.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
mkdir -p backups
set -a; . ./.env.production; set +a
stamp="$(date +%Y%m%d-%H%M)"
file="backups/${POSTGRES_DB:-rodo}-${stamp}.sql.gz"
media_file="backups/home-media-${stamp}.tar.gz"
docker compose --env-file .env.production exec -T db pg_dump -U "${POSTGRES_USER:-rodo}" -d "${POSTGRES_DB:-rodo}" --no-owner | gzip > "$file.part"
mv "$file.part" "$file"
# Files are immutable and written before the draft references them, so copying them after
# the database snapshot includes all uploads referenced by that snapshot.
docker compose --env-file .env.production exec -T app tar -czf - -C /app/.data/home-media . > "$media_file.part"
mv "$media_file.part" "$media_file"
find backups -name '*.sql.gz' -mtime +14 -delete
find backups -name 'home-media-*.tar.gz' -mtime +14 -delete
echo "$(date -Is) backup ok: $file ($(du -h "$file" | cut -f1))"
echo "$(date -Is) photos ok: $media_file ($(du -h "$media_file" | cut -f1))"
# Restore:  gunzip -c backups/FILE.sql.gz | docker compose --env-file .env.production exec -T db psql -U rodo -d rodo
# Photos:   docker compose --env-file .env.production exec -T app tar -xzf - -C /app/.data/home-media < backups/home-media-STAMP.tar.gz
