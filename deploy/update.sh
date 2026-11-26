#!/usr/bin/env sh
# Start / update the store on the server, then refresh caches.
#   ./deploy/update.sh --image ghcr.io/theasylumagency/tevo-store:<sha>   (GitHub Actions: pull the ready image)
#   ./deploy/update.sh                                                    (restart with the last deployed image, e.g. after editing .env.production)
#   BUILD_LOCAL=1 ./deploy/update.sh                                      (build on this server — needs ~2 GB free RAM)
set -eu
cd "$(dirname "$0")/.."
[ -f .env.production ] || { echo ".env.production is missing — run deploy/bootstrap.sh first" >&2; exit 1; }
IMAGE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --image) IMAGE="$2"; shift 2 ;;
    --no-pull) shift ;;                                  # kept for older instructions
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
set -a; . ./deploy/site.env; . ./.env.production; set +a
mkdir -p catalog media/originals backups
[ -f catalog/catalog.json ] || cp data/catalog.json catalog/catalog.json   # first deploy: start with the bundled catalog
C="docker compose --env-file .env.production"

# remember the running image, so later manual "docker compose …" commands use it too
if [ -n "$IMAGE" ]; then echo "APP_IMAGE=$IMAGE" > .deployed.env; fi
[ -f .deployed.env ] && [ -z "$IMAGE" ] && [ "${BUILD_LOCAL:-}" != 1 ] && IMAGE="$(sed -n 's/^APP_IMAGE=//p' .deployed.env)"

if [ -n "$IMAGE" ]; then
  export APP_IMAGE="$IMAGE"
  $C pull --quiet app
  $C up -d --no-build --remove-orphans
else
  export BUILD_SHA="${BUILD_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo manual)}"
  $C up -d --build --remove-orphans
fi
docker image prune -f >/dev/null 2>&1 || true

PORT="${APP_PORT:-3000}"
echo "waiting for the app on 127.0.0.1:$PORT…"
for i in $(seq 1 45); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    curl -fsS -X POST -H "Authorization: Bearer $CRON_TOKEN" "http://127.0.0.1:$PORT/api/revalidate" && echo
    echo "ok: $(curl -fsS "http://127.0.0.1:$PORT/api/health")"
    exit 0
  fi
  sleep 2
done
echo "app did not become healthy — see: $C logs app --tail 100" >&2
exit 1
