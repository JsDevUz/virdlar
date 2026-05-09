# Peshqadam — Kunlik Virdlar Telegram Bot & WebApp

**Sana:** 2026-05-09  
**Holat:** Tasdiqlangan

---

## 1. Umumiy tavsif

Qizlar uchun kunlik virdlarni kuzatish Telegram boti va WebApp ilovasi. Foydalanuvchi har kuni virdlarini belgilab boradi, 23:00 da kiritish yopiladi, 23:10 da adminlarga hisobot yuboriladi.

---

## 2. Texnologiya steki

| Qatlam | Texnologiya |
|--------|-------------|
| Bot | Telegraf.js (Node.js) |
| API | Express.js |
| DB | SQLite (`better-sqlite3`) |
| Scheduler | `node-cron` (Toshkent UTC+5) |
| Frontend | React (Vite) + Telegram WebApp SDK |
| Deploy | Docker Compose + Caddy |
| Domain | `peshqadam.jamm.uz` |

Hamma Node.js — bitta `package.json` (monorepo yoki workspace).

---

## 3. Papka tuzilmasi

```
peshqadam/
├── src/
│   ├── bot/
│   │   ├── index.js          # Telegraf bot, webhook setup
│   │   ├── handlers.js       # /start, callback query handlers
│   │   └── scheduler.js      # node-cron jobs
│   ├── api/
│   │   ├── index.js          # Express server entry
│   │   ├── routes/
│   │   │   ├── virdlar.js    # GET /api/virdlar, POST /api/virdlar
│   │   │   └── admin.js      # GET /api/admin/users, GET /api/admin/virdlar
│   │   └── auth.js           # Telegram initData HMAC-SHA256 validatsiya
│   └── db/
│       ├── index.js          # better-sqlite3 connection + helpers
│       └── schema.sql        # CREATE TABLE statements
├── webapp/                   # React Vite SPA
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── VirdlarPage.jsx   # Asosiy virdlar sahifasi
│   │   │   └── AdminPage.jsx     # Admin panel
│   │   └── components/
│   │       ├── VirdCard.jsx      # Yagona vird kartasi
│   │       ├── CommentModal.jsx  # Comment kiritish modali
│   │       └── UsersList.jsx     # Admin: users panel
│   └── vite.config.js
├── data/                     # SQLite fayl (Docker volume)
│   └── peshqadam.db
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## 4. Ma'lumotlar bazasi

```sql
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER UNIQUE NOT NULL,
  first_name  TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE virdlar (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  vird_key   TEXT NOT NULL,   -- 'tahajjud', 'zuho', ...
  date       TEXT NOT NULL,   -- 'YYYY-MM-DD' (Toshkent sanasi)
  status     TEXT NOT NULL DEFAULT 'not_done', -- 'done' | 'not_done'
  comment    TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, vird_key, date)
);
```

---

## 5. Virdlar ro'yxati (12 ta)

| `vird_key` | Ko'rinish (WebApp) | Hisobotdagi emoji |
|---|---|---|
| `tahajjud` | 🌃 Таҳажжуд | 🌃 |
| `zuho` | 🌄 Зуҳо | 🌄 |
| `zikrlar` | 📿 Зикрлар | 📿 |
| `yasin` | ❤️ Ясин | ❤️ |
| `takror` | 🔄 Такрор | 🔄 |
| `tavba` | 🧎‍♀️ Тавба | 🧎‍♀️ |
| `mulk` | 📖💰 Мулк | 📖💰 |
| `duolar` | 🤲 Дуолар | 🤲 |
| `oyatlar` | 📑 285-286 | 📑 |
| `mutolaa` | 📚 Мутолаа | 📚 |
| `muhosaba` | 🧠 Муҳосаба | 🧠 |
| `qazo` | ⏳ Қазо рўза | ⏳ |

---

## 6. Bot oqimi

### `/start`
1. Foydalanuvchi `users` jadvaliga qo'shiladi (yoki mavjud bo'lsa yangilanadi)
2. Xabar: `Assalomu Alaykum, [first_name] xonim! 👋`
3. Inline keyboard: `[ 📿 Virdlarni kiritish ]` → Telegram WebApp URL

### WebApp URL
```
https://peshqadam.jamm.uz/?tgWebAppStartParam=...
```
Telegram WebApp SDK orqali `initData` uzatiladi.

### Scheduler (node-cron, UTC+5)

| Vaqt | Harakat |
|------|---------|
| `0 22 * * *` | Barcha foydalanuvchilarga push: *"Bugungi virdlarni kiritishga 1 soat qoldi ⏰"* |
| `0 23 * * *` | Bugungi sana `locked` deb belgilanadi — yangi kiritish bloklanadi |
| `10 23 * * *` | Adminlarga hisobot yuboriladi |

---

## 7. API endpointlar

Barcha endpointlar `Authorization: Telegram initData` header orqali autentifikatsiya qilinadi.

### Foydalanuvchi endpointlari

| Method | URL | Tavsif |
|--------|-----|--------|
| `GET` | `/api/virdlar?date=YYYY-MM-DD` | Bugungi (yoki o'tgan) virdlar |
| `POST` | `/api/virdlar` | Vird statusini yangilash |

**POST body:**
```json
{
  "vird_key": "tahajjud",
  "date": "2026-05-09",
  "status": "done",
  "comment": "Ixtiyoriy izoh"
}
```

### Admin endpointlari (faqat ADMIN_IDS)

| Method | URL | Tavsif |
|--------|-----|--------|
| `GET` | `/api/admin/users` | Barcha foydalanuvchilar ro'yxati |
| `GET` | `/api/admin/virdlar?user_id=&date=&month=&year=` | Filter bilan virdlar |

---

## 8. Telegram WebApp autentifikatsiyasi

`initData` HMAC-SHA256 bilan Telegram serveri tomonidan imzolanadi. Har bir API so'rovda:
1. `initData` string parse qilinadi
2. `hash` field chiqarib olinadi
3. Qolgan fieldlar saralanib `data-check-string` tuziladi
4. `HMAC-SHA256(secret_key, data-check-string)` hisoblandi va `hash` bilan solishtiriladi
5. `auth_date` 24 soatdan eski bo'lsa rad etiladi

---

## 9. WebApp UI

### VirdlarPage
- Telegram WebApp ranglar sxemasiga moslashgan (dark/light)
- Yuqorida: sana + `[first_name] xonim` + **Admin** tugmasi (faqat admin uchun)
- Virdlar: 2 ustunli grid, har biri `VirdCard`
- `VirdCard`: katta emoji + qisqa nom + status rang
  - `done` → yashil background ✅
  - `not_done` → kulrang
- Bosish → toggle status + API call
- Uzun bosish yoki 💬 icon → `CommentModal`
- 23:00 dan keyin: hamma card disabled + sariq banner *"Bugungi virdlar yopildi 🔒"*

### AdminPage
- Split layout: chap `UsersList` (260px) + o'ng virdlar jadvali
- Yuqorida: **Yil / Oy / Kun** uchta `<select>` filter
- Jadval: foydalanuvchi satr, virdlar ustun
- Cell rangi: yashil (done) / kulrang (not_done) / oq (kiritilmagan)
- Cell bosish → comment modal (agar comment mavjud bo'lsa)

---

## 10. Hisobot formati

```
📅 09.05.2026

🌃 Таҳажжуд
🌄 Зуҳо намоз
📿 Зикрлар
❤️ Ясин
🔄 Такрор
🧎‍♀️ Тавба намоз
📖💰 Мулк сураси
🤲 Қуръоний дуолар
📑 285-286 оятлар
📚 Бир пора мутолаа
🧠 Муҳосаба
⏳ Қазо рўза

Nigora — 🌃,📿,❤️,🔄
Malika — 🌄,🧠,⏳
...
```

Faqat `done` statusdagi virdlar emojilar bilan ko'rsatiladi.

---

## 11. Docker & Deploy

### Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build   # webapp Vite build
EXPOSE 3000
CMD ["node", "src/api/index.js"]
```

### docker-compose.yml
```yaml
services:
  peshqadam:
    build: .
    env_file: .env
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  caddy:
    # mavjud Caddy instancega qo'shiladi
    # yoki network orqali ulangan
```

### Caddy config (mavjud config ga qo'shimcha)
```
peshqadam.jamm.uz {
  encode gzip zstd
  reverse_proxy peshqadam:3000
}
```

### .env.example
```
BOT_TOKEN=
ADMIN_IDS=123456789,987654321
WEBHOOK_SECRET=
WEBAPP_URL=https://peshqadam.jamm.uz
DATABASE_PATH=./data/peshqadam.db
PORT=3000
TZ=Asia/Tashkent
```

---

## 12. Xavfsizlik

- Barcha API so'rovlari Telegram `initData` HMAC validatsiyasidan o'tadi
- Admin endpointlari qo'shimcha `ADMIN_IDS` tekshiruviga ega
- `auth_date` 24 soatdan eski initData rad etiladi
- SQLite faylga faqat container ichidan kirish mumkin (volume mount)
- Webhook endpoint `/webhook/${WEBHOOK_SECRET}` secret path bilan himoyalangan
