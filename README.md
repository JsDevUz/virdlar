# Peshqadam — Kunlik Virdlar Bot

Qizlar uchun kunlik virdlarni kuzatish Telegram boti va WebApp.

## Deploy (VPS)

1. Clone repo va `.env` yaratish:
```bash
git clone <repo> peshqadam && cd peshqadam
cp .env.example .env
# .env ni to'ldirish: BOT_TOKEN, ADMIN_IDS, WEBHOOK_SECRET, WEBAPP_URL
```

2. Caddy config ga qo'shish:
```
peshqadam.jamm.uz {
  encode gzip zstd
  reverse_proxy peshqadam:3000
}
```

3. Docker network mavjudligini tekshirish:
```bash
docker network ls | grep caddy_net
# Agar yo'q bo'lsa: docker network create caddy_net
```

4. Ishga tushirish:
```bash
docker compose up -d
```
