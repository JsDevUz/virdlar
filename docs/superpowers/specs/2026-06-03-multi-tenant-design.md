# Multi-tenant arxitektura dizayni

**Sana:** 2026-06-03  
**Maqsad:** Bitta bot instance bilan ko'p guruhni boshqarish — har guruh izolyatsiyalangan data, alohida adminlar.

---

## Arxitektura

Bitta SQLite DB, bitta bot token, bitta server. Guruhlar `groups` jadvalida saqlanadi. Barcha user va vird ma'lumotlari `group_id` foreign key orqali guruhga bog'langan.

**Admin darajalari:**
- `super_admin` — `SUPER_ADMIN_IDS` env, barcha guruhlarni ko'radi, yangi guruh yaratadi
- `group_admin` — `groups.admin_ids` (DB da), faqat o'z guruhini ko'radi

---

## DB Sxema

```sql
CREATE TABLE groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  admin_ids  TEXT NOT NULL DEFAULT '',
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  group_id    INTEGER NOT NULL REFERENCES groups(id),
  first_name  TEXT NOT NULL,
  custom_name TEXT,
  is_banned   INTEGER NOT NULL DEFAULT 0,
  exclude_from_report INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(telegram_id, group_id)
);

CREATE TABLE virdlar_config (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   INTEGER NOT NULL REFERENCES groups(id),
  key        TEXT NOT NULL,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(group_id, key)
);

-- virdlar o'zgarmaydi: user_id -> users.group_id orqali guruh aniqlanadi
CREATE TABLE virdlar (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  vird_key   TEXT NOT NULL,
  date       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'not_done',
  comment    TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, vird_key, date)
);
```

**Eslatma:** Hozirgi `users.group_key` va `users.telegram_id UNIQUE` constraint olib tashlanadi — yangi sxema boshidan yoziladi.

---

## Bot o'zgarishlari

- `/start?g={slug}` — slug bo'yicha guruh topiladi, foydalanuvchi `group_id` bilan `users` ga upsert qilinadi
- Guruh topilmasa: "Guruh topilmadi. To'g'ri havola orqali kiring." xabari
- Webapp URL: `${WEBAPP_URL}?g={slug}` — har guruh o'z kontekstida ochiladi
- Hisobot: faqat o'sha guruh userlari (`WHERE group_id = ?`)
- `ADMIN_IDS` env olib tashlanadi — adminlar DB da saqlanadi (`groups.admin_ids`)
- `SUPER_ADMIN_IDS` env qoladi — super-adminlar env da

---

## API Middleware

**`requireAuth`** — hozirgi kabi Telegram initData tekshiradi, qo'shimcha `req.groupId` o'rnatadi:
- Webapp `x-group-slug` header yuboradi
- Middleware slug → `group_id` ga aylantiradi
- `req.groupId` va `req.telegramUser` o'rnatiladi

**`requireAdmin`** — `groups.admin_ids` dan tekshiradi YOKI `SUPER_ADMIN_IDS` da bo'lsa o'tadi

**`requireSuperAdmin`** — faqat `SUPER_ADMIN_IDS` env dan tekshiradi

---

## API Endpointlar

### Yangi (super-admin)
```
GET    /api/groups              -- barcha guruhlar ro'yxati
POST   /api/groups              -- yangi guruh yaratish { slug, name, admin_ids }
PATCH  /api/groups/:id          -- guruhni tahrirlash
```

### O'zgartirilgan (group_id filter qo'shiladi)
```
GET    /api/admin/users         -- faqat req.groupId userlari
PATCH  /api/admin/users/:id
GET    /api/admin/virdlar       -- faqat req.groupId virdlari
GET    /api/virdlar-config      -- faqat req.groupId config
POST   /api/virdlar-config      -- req.groupId ga yangi vird
PATCH  /api/virdlar-config/:id
```

---

## Webapp (Vue) o'zgarishlari

- `?g=slug` URL parametridan o'qib `x-group-slug` header sifatida barcha API so'rovlarga qo'shiladi
- Super-admin uchun guruhlar boshqaruv sahifasi qo'shiladi
- Guruh slug bo'lmasa — "Guruh ko'rsatilmagan" xato sahifasi

---

## Migration strategiyasi

Hozirgi DB yangi sxemaga o'tkazilmaydi — loyiha yangi boshlanadi:
1. Yangi sxema `schema.sql` da to'liq yoziladi
2. `seedVirdlarConfig()` — birinchi guruh uchun default virdlar seed qilinadi
3. `migrateDb()` funksiyasi olib tashlanadi (yangi loyihada kerak emas)

---

## Scope tashqarisida (hozircha)

- Guruhlar o'rtasida user ko'chirish
- Guruh statistikasi dashboard
- Guruh o'chirish (soft delete `is_active=0` yetarli)
