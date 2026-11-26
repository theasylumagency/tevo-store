#!/usr/bin/env sh
# Pull the latest code, rebuild and restart, then refresh caches. Run from the project folder on the server:
#   ./deploy/update.sh
set -eu
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose --env-file .env.production up -d --build
set -a; . ./.env.production; set +a
echo "waiting for the app…"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    curl -fsS -X POST -H "Authorization: Bearer $CRON_TOKEN" http://127.0.0.1:3000/api/revalidate && echo
    echo "ok: $(curl -fsS http://127.0.0.1:3000/api/health)"
    exit 0
  fi
  sleep 2
done
echo "app did not become healthy — see: docker compose logs app --tail 100" >&2
exit 1
