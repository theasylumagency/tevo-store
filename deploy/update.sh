#!/usr/bin/env sh
# Rebuild and restart, then refresh caches. Run from the project folder on the server:
#   ./deploy/update.sh            (git checkout: pulls first)
#   ./deploy/update.sh --no-pull  (code was uploaded by GitHub Actions)
set -eu
cd "$(dirname "$0")/.."
[ -f .env.production ] || { echo ".env.production is missing — run deploy/bootstrap.sh first" >&2; exit 1; }
if [ "${1:-}" != "--no-pull" ] && [ -d .git ]; then git pull --ff-only; fi
set -a; . ./.env.production; set +a
mkdir -p catalog media/originals backups
[ -f catalog/catalog.json ] || cp data/catalog.json catalog/catalog.json   # first deploy: start with the bundled catalog
export BUILD_SHA="${BUILD_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo manual)}"
docker compose --env-file .env.production up -d --build --remove-orphans
docker image prune -f >/dev/null 2>&1 || true
echo "waiting for the app…"
for i in $(seq 1 45); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    curl -fsS -X POST -H "Authorization: Bearer $CRON_TOKEN" http://127.0.0.1:3000/api/revalidate && echo
    echo "ok: $(curl -fsS http://127.0.0.1:3000/api/health)"
    exit 0
  fi
  sleep 2
done
echo "app did not become healthy — see: docker compose --env-file .env.production logs app --tail 100" >&2
exit 1
