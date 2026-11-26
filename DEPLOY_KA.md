# Rodo — სერვერზე გაშვება (OVH VPS)

ერთ VPS-ზე Docker-ში ეშვება: აპი, Postgres, შეტყობინებების რიგის დამმუშავებელი და (თუ 80/443 თავისუფალია) Caddy ავტომატური HTTPS-ით.
კოდს სერვერზე **GitHub Actions** ტვირთავს: ყოველი push `main`-ზე ჯერ მოწმდება (TypeScript, lint, build), მერე SSH-ით იტვირთება და საიტი ახლდება.
სერვერზე ხელით მხოლოდ ერთხელ, დასაწყისში შედიხართ.

> **გადახდები:** `PAYMENTS_MODE=off` — საიტზე მხოლოდ „ადგილზე გადახდაა“, სანამ ბანკთან ხელშეკრულება არ გვაქვს.
> **SMS:** სანამ `SMSOFFICE_API_KEY` ცარიელია, SMS არ იგზავნება (შეკვეთაზე ადმინში ჩანს „გამოტოვდა — SMS not configured“). ელფოსტაც ასევე, სანამ პაროლი არ არის.

## 1. სერვერის მომზადება (ერთხელ, ≈10 წუთი)

```bash
ssh ubuntu@SERVER_IP
curl -fsSL https://raw.githubusercontent.com/theasylumagency/tevo-store/main/deploy/bootstrap.sh -o bootstrap.sh
bash bootstrap.sh
```

სკრიპტი:
1. აყენებს Docker-ს (თუ არ არის);
2. ქმნის `/srv/rodo`-ს და `.env.production`-ს შემთხვევითი პაროლებით. გკითხავთ მხოლოდ: საიტის მისამართს, რევიუს რეჟიმს, `orders@rodo.ge`-ის პაროლს და Telegram ბოტის ტოკენს (ბოლო ორი შეიძლება გამოტოვოთ);
3. **ერთხელ აჩვენებს ადმინის პაროლს** — შეინახეთ;
4. ქმნის deploy-გასაღებს GitHub-ისთვის (მხოლოდ ბრძანებების გაშვება შეუძლია, ტერმინალის გახსნა — არა) და ბეჭდავს იმ ოთხ მნიშვნელობას, რომელიც GitHub-ში უნდა ჩაწეროთ;
5. firewall-ს თავისით არ რთავს (არასწორი წესი SSH-ს ჩაგიკეტავდათ) — თუ უკვე ჩართულია, მხოლოდ 80/443-ს ხსნის.

თუ 80/443 პორტებს უკვე იყენებს nginx (სხვა საიტები), Caddy არ ჩაირთვება — იხ. ქვემოთ „nginx“.

## 2. GitHub-ის საიდუმლოებები

GitHub → `theasylumagency/tevo-store` → **Settings → Secrets and variables → Actions → New repository secret** — ოთხივე მნიშვნელობა bootstrap-ის ბოლოს არის დაბეჭდილი:

| სახელი | რა |
|---|---|
| `DEPLOY_HOST` | სერვერის IP |
| `DEPLOY_USER` | მომხმარებელი (მაგ. `ubuntu`) |
| `DEPLOY_SSH_KEY` | პირადი გასაღები, `BEGIN`-დან `END`-მდე ჩათვლით |
| `DEPLOY_KNOWN_HOSTS` | სერვერის „თითის ანაბეჭდი“ — GitHub სხვა სერვერს ვერ შეერევა |

შემდეგ: GitHub → **Actions → check-and-deploy → Run workflow**. 5–8 წუთში საიტი გაეშვება. შემოწმება: `https://rodo.ge/api/health`.

## 3. ფოტოები

```bash
# Windows PowerShell:
scp -r "C:\...\AgroTrade_Legacy_Media\originals\*" ubuntu@SERVER_IP:/srv/rodo/media/originals/
# შემდეგ სერვერზე, ქეშის განახლება:
cd /srv/rodo && set -a && . ./.env.production && set +a
curl -X POST -H "Authorization: Bearer $CRON_TOKEN" "http://127.0.0.1:3000/api/revalidate?tag=media"
```

კატალოგი პირველ ჯერზე ავტომატურად იწერება `catalog/catalog.json`-ში; განახლებისას ჩაანაცვლეთ ფაილი და იგივე ბრძანება `?tag=catalog`-ით.

## 4. ადმინში (პირველ დღეს)

`https://rodo.ge/admin` → **პარამეტრები**:
- **გამყიდველი და კონტაქტი** — ჩანს იურიდიულ გვერდებზე, საიტის ქვედა ნაწილში და მყიდველის წერილებში. ყოველი შენახვა ისტორიაში იწერება.
- **თანამშრომლების ელფოსტები** ახალი შეკვეთისთვის.
- **Telegram** — „ბოტის ჩართვა ამ საიტზე“, მერე „დაკავშირების ბმულის შექმნა“: თანამშრომელი ხსნის ბმულს და აჭერს Start-ს (ან ბოტს ჯგუფში ამატებს). ბმული ერთჯერადია, 30 წუთი მოქმედებს. „სატესტო შეტყობინება“ ამოწმებს, რომ ყველაფერი მუშაობს.

Telegram ბოტის შექმნა: Telegram-ში @BotFather → `/newbot` → სახელი (მაგ. „Rodo შეკვეთები“) და username (მაგ. `rodo_orders_bot`) → ტოკენი ჩაწერეთ სერვერზე `.env.production`-ში (`TELEGRAM_BOT_TOKEN=`) და გაუშვით `./deploy/update.sh --no-pull`.

### nginx (თუ სერვერზე უკვე მუშაობს)

```bash
sudo cp /srv/rodo/deploy/nginx.conf.example /etc/nginx/sites-available/rodo.ge
sudo ln -s /etc/nginx/sites-available/rodo.ge /etc/nginx/sites-enabled/
sudo certbot --nginx -d rodo.ge -d www.rodo.ge
sudo nginx -t && sudo systemctl reload nginx
```

აპი მხოლოდ `127.0.0.1:3000`-ზე უსმენს — გარედან მხოლოდ Caddy/nginx-ის გავლით მიიღწევა.

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
| კოდის განახლება | ავტომატურად: ყოველი push `main`-ზე → GitHub Actions (შემოწმება → ატვირთვა → build → restart). ხელით: GitHub → Actions → check-and-deploy → Run workflow |
| ახალი ფოტოები | ფოტოები `media/originals/`-ში, შემდეგ:<br>`curl -X POST -H "Authorization: Bearer $CRON_TOKEN" "http://127.0.0.1:3000/api/revalidate?tag=media"` |
| ახალი კატალოგი | `catalog/catalog.json`-ის ჩანაცვლება, შემდეგ იგივე ბრძანება `?tag=catalog`-ით |
| ლოგები | `docker compose --env-file .env.production logs app -f` |
| რომელი ვერსიაა საიტზე | `https://rodo.ge/api/health` → `version` (commit-ის ნომერი) |
| SMS/ელფოსტის რიგი | `notifier` სერვისი ყოველ წუთს ცდის ვერგაგზავნილს — ცალკე cron არ სჭირდება |

## 7. ბანკების შემდეგ (შემდეგი ეტაპი)

ხელშეკრულების და sandbox-ის მიღების შემდეგ: `.env.production`-ში `BOG_…_RODO` / `TBC_…_RODO`, `PAYMENTS_MODE=live` და `./deploy/update.sh --no-pull`. checkout-ში ავტომატურად გამოჩნდება მხოლოდ ის მეთოდები, რომელთა credentials-იც მითითებულია.
Callback მისამართები ბანკისთვის: `https://rodo.ge/api/payments/bog/callback` და `https://rodo.ge/api/payments/tbc/callback`.
