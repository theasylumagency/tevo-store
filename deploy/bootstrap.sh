#!/usr/bin/env bash
# One-time server setup for the store (Ubuntu/Debian). Run as the SSH user that will own the site:
#   curl -fsSL https://raw.githubusercontent.com/theasylumagency/tevo-store/main/deploy/bootstrap.sh -o bootstrap.sh
#   bash bootstrap.sh
# It installs Docker, creates /srv/rodo with .env.production (random secrets), and a deploy key for GitHub Actions.
# Safe to run again: existing files are kept.
set -euo pipefail
DEST="${DEST:-/srv/rodo}"
ME="$(id -un)"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
rand() { openssl rand -hex "${1:-32}"; }

say "1/5  Packages"
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sudo sh; fi
sudo apt-get install -y -q rsync curl openssl >/dev/null
if ! id -nG "$ME" | grep -qw docker; then sudo usermod -aG docker "$ME"; NEED_RELOGIN=1; fi

say "2/5  Folders ($DEST)"
sudo mkdir -p "$DEST" && sudo chown "$ME":"$ME" "$DEST"
mkdir -p "$DEST"/{media/originals,catalog,backups}

say "3/5  .env.production"
ENVF="$DEST/.env.production"
if [ -f "$ENVF" ]; then
  echo "exists — not touched ($ENVF)"
else
  read -rp "Order mailbox [orders@rodo.ge]: " SMTPU; SMTPU="${SMTPU:-orders@rodo.ge}"
  read -rsp "Mailbox password (Purelymail; Enter = e-mail off for now): " SMTPP; echo
  case "$SMTPP" in *"'"*) echo "the password contains ' — add it to $DEST/.env.production by hand later"; SMTPP="";; esac
  read -rp "Telegram bot token from @BotFather (Enter = later): " TGT
  ADMINP="$(rand 9)"
  # another app on this server (e.g. Khidi) may already use port 3000 and the web ports
  APP_PORT=3000
  if command -v ss >/dev/null; then
    while sudo ss -ltnH "( sport = :$APP_PORT )" | grep -q .; do APP_PORT=$((APP_PORT + 1)); done
  fi
  PROFILES=""
  WEB="$(command -v ss >/dev/null && sudo ss -ltnpH '( sport = :80 or sport = :443 )' || true)"
  if [ -z "$WEB" ]; then PROFILES="caddy"; fi
  umask 077
  cat > "$ENVF" <<ENV
# store id, public address and review mode live in the repo: deploy/site.env
CATALOG_SOURCE=file
CATALOG_PATH=catalog/catalog.json
# caddy = built-in HTTPS (ports 80/443 were free); empty = an existing nginx proxies to 127.0.0.1:3000
COMPOSE_PROFILES=$PROFILES
APP_PORT=$APP_PORT

POSTGRES_DB=rodo
POSTGRES_USER=rodo
POSTGRES_PASSWORD=$(rand 24)

PAYMENTS_MODE=off

ADMIN_PASSWORD=$ADMINP
SESSION_SECRET=$(rand 32)
CRON_TOKEN=$(rand 24)
OUTBOX_TOKEN=$(rand 24)

# SMS: off until the company's smsoffice.ge key is added
SMSOFFICE_API_KEY=
SMS_SENDER=Rodo

SMTP_HOST=smtp.purelymail.com
SMTP_PORT=465
SMTP_USER=$SMTPU
SMTP_PASS='$SMTPP'
EMAIL_FROM="Rodo <$SMTPU>"

TELEGRAM_BOT_TOKEN='$TGT'
TELEGRAM_WEBHOOK_SECRET=$(rand 24)
ENV
  echo "written: $ENVF (only you can read it)"
  echo "Admin password: $ADMINP   ← save it now; it is also in $ENVF"
  echo "App port: 127.0.0.1:$APP_PORT"
  if [ -n "$WEB" ]; then
    echo; echo "Ports 80/443 are already in use (another site, e.g. Khidi):"; echo "$WEB" | sed 's/^/  /'
    echo "→ add rodo.ge to that web server and proxy it to 127.0.0.1:$APP_PORT (DEPLOY_KA.md, section 5)."
  else
    echo "Ports 80/443 are free → the bundled Caddy will serve rodo.ge with automatic HTTPS."
  fi
fi

say "4/5  Deploy key for GitHub Actions"
KEY="$HOME/.ssh/rodo_deploy"
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
if [ ! -f "$KEY" ]; then
  ssh-keygen -q -t ed25519 -N "" -C "github-actions-deploy" -f "$KEY"
  # this key may only run commands — no port forwarding, no agent, no terminal
  echo "no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty $(cat "$KEY.pub")" >> "$HOME/.ssh/authorized_keys"
  chmod 600 "$HOME/.ssh/authorized_keys"
fi
IP="$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
cat <<INFO

Add these in GitHub → theasylumagency/tevo-store → Settings → Secrets and variables → Actions:

  DEPLOY_HOST         $IP
  DEPLOY_USER         $ME
  DEPLOY_KNOWN_HOSTS  $(ssh-keyscan -t ed25519 localhost 2>/dev/null | sed "s/^localhost/$IP/")
  DEPLOY_SSH_KEY      (everything between the lines below, including BEGIN/END)
-----------------------------------------------------------------
$(cat "$KEY")
-----------------------------------------------------------------
INFO

say "5/5  Firewall"
# never switches a firewall on (a wrong SSH rule would lock you out) — only opens web ports if one is already active
if command -v ufw >/dev/null && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow 80,443/tcp >/dev/null && echo "ufw: opened 80/443"
else
  echo "no active ufw — nothing changed (OVH's network firewall, if used, must allow 80/443)"
fi

echo
echo "Done. Next: copy photos into $DEST/media/originals and the catalog into $DEST/catalog/ (see DEPLOY_KA.md),"
echo "add the GitHub secrets, then re-run the latest workflow in GitHub → Actions (or push to main)."
[ "${NEED_RELOGIN:-}" = 1 ] && echo "Log out and back in once, so your user can run docker."
exit 0
