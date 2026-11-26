# Rodo — სერვერზე გაშვება (OVH VPS)

ეს ინსტრუქცია ერთ VPS-ზე უშვებს: აპს, Postgres-ს, SMS/ელფოსტის რიგის დამმუშავებელს და (სურვილისამებრ) Caddy-ს HTTPS-ით.
ყველაფერი Docker-შია, სერვერზე Node.js ან Postgres ცალკე დაყენება არ სჭირდება.

> **გადახდები:** ამ ეტაპზე `PAYMENTS_MODE=off`. საიტზე მხოლოდ „ადგილზე გადახდაა“. ბანკები sandbox-ისთვის მოქმედ საიტს ითხოვენ — ეს საიტი იქნება ის მისამართი, რომელსაც BOG-სა და TBC-ს მივაწვდით.

## 0. რა უნდა იყოს მზად

| რა | ვისგან |
|---|---|
| VPS (Ubuntu 22.04/24.04, მინ. 2 GB RAM, 20 GB დისკი) და SSH წვდომა | OVH |
| DNS: `rodo.ge` და `www.rodo.ge` → VPS-ის IP (A ჩანაწერი) | დომენის რეგისტრატორი |
| smsoffice.ge API გასაღები და დარეგისტრირებული გამგზავნის სახელი | smsoffice.ge |
| საფოსტო ყუთი (მაგ. `orders@rodo.ge`) და პაროლი | Purelymail |
| გამყიდველის იურიდიული მონაცემები (`src/config/store.ts`) | დამკვეთი |

## 1. სერვერის მომზადება (ერთხელ)

```bash
ssh ubuntu@SERVER_IP
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && exit        # ხელახლა შედით, რომ ჯგუფი ამოქმედდეს
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

## 2. კოდი და პარამეტრები

```bash
sudo mkdir -p /srv/rodo && sudo chown $USER /srv/rodo
git clone https://github.com/theasylumagency/tevo-store.git /srv/rodo
cd /srv/rodo
cp .env.production.example .env.production
nano .env.production
```

`.env.production`-ში აუცილებლად შეავსეთ (საიდუმლოები: `openssl rand -hex 32`):
`POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `CRON_TOKEN`, `OUTBOX_TOKEN`, `SMSOFFICE_API_KEY`, `SMTP_PASS`, `STAFF_EMAILS`, `STAFF_PHONES`.

რევიუსთვის (ლიკა ხედავს შენიშვნებს, Google ვერ ხედავს საიტს) — `REVIEW_MODE=1`. საჯარო გაშვებაზე — `0`.
`STORE_ID`, `PUBLIC_BASE_URL` და `REVIEW_MODE` build-ის დროსაც გამოიყენება: მათი შეცვლის შემდეგ საჭიროა `./deploy/update.sh`.

## 3. კატალოგი და ფოტოები

კატალოგი და ფოტოები image-ში არ შედის — სერვერზე ცალკე საქაღალდეებშია, რომ განახლებისთვის rebuild არ დაგვჭირდეს.

```bash
mkdir -p catalog media
cp data/catalog.json catalog/
```

ფოტოები თქვენი კომპიუტერიდან (საქაღალდე, რომელშიც `originals/` არის):

```bash
# Windows PowerShell (OpenSSH-ით):
scp -r "C:\...\AgroTrade_Legacy_Media\originals" ubuntu@SERVER_IP:/srv/rodo/media/
# macOS/Linux:
rsync -av --delete AgroTrade_Legacy_Media/originals/ ubuntu@SERVER_IP:/srv/rodo/media/originals/
```

## 4. გაშვება

**ა) სერვერზე სხვა არაფერი უსმენს 80/443 პორტებს** (ახალი VPS) — Caddy-ით, HTTPS სერტიფიკატი ავტომატურად:

```bash
docker compose --env-file .env.production --profile caddy up -d --build
```

**ბ) სერვერზე უკვე მუშაობს nginx** (მაგ. სხვა საიტები) — Caddy-ის გარეშე:

```bash
docker compose --env-file .env.production up -d --build
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/rodo.ge
sudo ln -s /etc/nginx/sites-available/rodo.ge /etc/nginx/sites-enabled/
sudo certbot --nginx -d rodo.ge -d www.rodo.ge
sudo nginx -t && sudo systemctl reload nginx
```

აპი მხოლოდ `127.0.0.1:3000`-ზე უსმენს — გარედან მხოლოდ Caddy/nginx-ის გავლით მიიღწევა.

შემოწმება:

```bash
docker compose ps                                  # ყველა სერვისი "healthy" / "running"
curl -s http://127.0.0.1:3000/api/health          # {"ok":true,"products":215,...}
docker compose logs app --tail 50
```

შემდეგ ბრაუზერში: `https://rodo.ge`, `https://rodo.ge/admin` (პაროლი — `ADMIN_PASSWORD`), სატესტო შეკვეთა „ადგილზე გადახდით“ → უნდა მოვიდეს SMS და ელფოსტა.

## 5. ბექაპი

```bash
crontab -e
# ყოველდღე 03:15-ზე:
15 3 * * * cd /srv/rodo && ./deploy/backup.sh >> backups/backup.log 2>&1
```

ბექაპები `backups/`-შია, 14 დღე ინახება. **ასლი სერვერის გარეთაც გადაიტანეთ** (OVH Object Storage ან სხვა კომპიუტერი) — სერვერის დაკარგვისას იმავე დისკზე არსებული ბექაპი არ გადარჩება.

აღდგენა:

```bash
gunzip -c backups/ფაილი.sql.gz | docker compose --env-file .env.production exec -T db psql -U rodo -d rodo
```

## 6. ყოველდღიური საქმეები

| რა | როგორ |
|---|---|
| კოდის განახლება | `./deploy/update.sh` (git pull → build → restart → ქეშის განახლება) |
| ახალი ფოტოები | ფოტოები `media/originals/`-ში, შემდეგ:<br>`curl -X POST -H "Authorization: Bearer $CRON_TOKEN" "http://127.0.0.1:3000/api/revalidate?tag=media"` |
| ახალი კატალოგი | `catalog/catalog.json`-ის ჩანაცვლება, შემდეგ იგივე ბრძანება `?tag=catalog`-ით |
| ლოგები | `docker compose logs app -f` |
| SMS/ელფოსტის რიგი | `notifier` სერვისი ყოველ წუთს ცდის ვერგაგზავნილს — ცალკე cron არ სჭირდება |

## 7. ბანკების შემდეგ (შემდეგი ეტაპი)

ხელშეკრულების და sandbox-ის მიღების შემდეგ: `.env.production`-ში `BOG_…_RODO` / `TBC_…_RODO`, `PAYMENTS_MODE=live` და `./deploy/update.sh`. checkout-ში ავტომატურად გამოჩნდება მხოლოდ ის მეთოდები, რომელთა credentials-იც მითითებულია.
Callback მისამართები ბანკისთვის: `https://rodo.ge/api/payments/bog/callback` და `https://rodo.ge/api/payments/tbc/callback`.
