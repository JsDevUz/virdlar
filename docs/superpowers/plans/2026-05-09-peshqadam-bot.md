# Peshqadam Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qizlar uchun kunlik virdlarni kuzatish Telegram boti, WebApp va admin paneli.

**Architecture:** Telegraf.js boti va Express.js API bitta Node.js servisda ishlaydi; React (Vite) WebApp statik build sifatida Express tomonidan serve qilinadi; SQLite `better-sqlite3` orqali sinxron ishlatiladi; `node-cron` Toshkent vaqti (UTC+5) bo'yicha schedulerlar boshqaradi.

**Tech Stack:** Node.js 20, Telegraf.js 4, Express.js 5, better-sqlite3, node-cron, React 18 (Vite), Docker, Caddy

---

## File Map

```
peshqadam/
├── package.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── src/
│   ├── db/
│   │   ├── schema.sql          # CREATE TABLE statements
│   │   └── index.js            # DB connection + query helpers
│   ├── bot/
│   │   ├── index.js            # Telegraf bot setup + webhook
│   │   ├── handlers.js         # /start handler
│   │   └── scheduler.js        # node-cron jobs (22:00, 23:00, 23:10)
│   ├── api/
│   │   ├── index.js            # Express app + static serve
│   │   ├── auth.js             # Telegram initData HMAC validatsiya
│   │   ├── routes/
│   │   │   ├── virdlar.js      # GET/POST /api/virdlar
│   │   │   └── admin.js        # GET /api/admin/users, /api/admin/virdlar
│   └── constants.js            # VIRDLAR ro'yxati (12 ta)
├── webapp/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js              # fetch wrapper (initData header)
│       ├── pages/
│       │   ├── VirdlarPage.jsx
│       │   └── AdminPage.jsx
│       └── components/
│           ├── VirdCard.jsx
│           ├── CommentModal.jsx
│           └── UsersList.jsx
└── tests/
    ├── db.test.js
    ├── auth.test.js
    ├── virdlar.test.js
    └── admin.test.js
```

---

## Task 1: Loyiha scaffolding va dependencies

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `src/constants.js`

- [ ] **Step 1: package.json yaratish**

```json
{
  "name": "peshqadam",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/api/index.js",
    "start": "node src/api/index.js",
    "build": "cd webapp && npm run build",
    "test": "node --test tests/"
  },
  "dependencies": {
    "telegraf": "^4.16.3",
    "express": "^5.1.0",
    "better-sqlite3": "^9.6.0",
    "node-cron": "^3.0.3",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Dependencies o'rnatish**

```bash
npm install
```

- [ ] **Step 3: .env.example yaratish**

```
BOT_TOKEN=your_bot_token_here
ADMIN_IDS=123456789,987654321
WEBHOOK_SECRET=random_secret_string
WEBAPP_URL=https://peshqadam.jamm.uz
DATABASE_PATH=./data/peshqadam.db
PORT=3000
TZ=Asia/Tashkent
```

- [ ] **Step 4: data/ papkasini yaratish**

```bash
mkdir -p data
echo "peshqadam.db" >> data/.gitignore
```

- [ ] **Step 5: src/constants.js yaratish**

```js
export const VIRDLAR = [
  { key: 'tahajjud', label: '🌃 Таҳажжуд' },
  { key: 'zuho',     label: '🌄 Зуҳо' },
  { key: 'zikrlar',  label: '📿 Зикрлар' },
  { key: 'yasin',    label: '❤️ Ясин' },
  { key: 'takror',   label: '🔄 Такрор' },
  { key: 'tavba',    label: '🧎‍♀️ Тавба' },
  { key: 'mulk',     label: '📖💰 Мулк' },
  { key: 'duolar',   label: '🤲 Дуолар' },
  { key: 'oyatlar',  label: '📑 285-286' },
  { key: 'mutolaa',  label: '📚 Мутолаа' },
  { key: 'muhosaba', label: '🧠 Муҳосаба' },
  { key: 'qazo',     label: '⏳ Қазо рўза' },
];
```

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: initial project scaffold"
```

---

## Task 2: SQLite DB setup

**Files:**
- Create: `src/db/schema.sql`
- Create: `src/db/index.js`
- Create: `tests/db.test.js`

- [ ] **Step 1: Failing test yozish**

```js
// tests/db.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initDb, getDb } from '../src/db/index.js';

describe('DB', () => {
  before(() => {
    process.env.DATABASE_PATH = ':memory:';
    initDb();
  });

  it('creates users table', () => {
    const db = getDb();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    assert.equal(row.name, 'users');
  });

  it('creates virdlar table', () => {
    const db = getDb();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='virdlar'").get();
    assert.equal(row.name, 'virdlar');
  });

  it('upsertUser creates and returns user', () => {
    const db = getDb();
    const { upsertUser } = await import('../src/db/index.js');
    const user = upsertUser(111, 'Nigora');
    assert.equal(user.telegram_id, 111);
    assert.equal(user.first_name, 'Nigora');
  });
});
```

- [ ] **Step 2: Testni ishga tushirish — muvaffaqiyatsiz bo'lishini tekshirish**

```bash
node --test tests/db.test.js
```

Expected: `ERR_MODULE_NOT_FOUND` — `src/db/index.js` yo'q

- [ ] **Step 3: schema.sql yaratish**

```sql
-- src/db/schema.sql
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER UNIQUE NOT NULL,
  first_name  TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS virdlar (
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

- [ ] **Step 4: src/db/index.js yaratish**

```js
// src/db/index.js
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let db;

export function initDb() {
  const path = process.env.DATABASE_PATH || './data/peshqadam.db';
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

export function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export function upsertUser(telegramId, firstName) {
  const d = getDb();
  d.prepare(`
    INSERT INTO users (telegram_id, first_name)
    VALUES (?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET first_name = excluded.first_name
  `).run(telegramId, firstName);
  return d.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
}

export function getAllUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY first_name').all();
}

export function getTodayStr() {
  // Toshkent UTC+5 da bugungi sana YYYY-MM-DD
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export function isLocked() {
  // 23:00 UTC+5 = 18:00 UTC
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return now.getHours() >= 23;
}

export function upsertVird({ userId, virdKey, date, status, comment }) {
  const d = getDb();
  d.prepare(`
    INSERT INTO virdlar (user_id, vird_key, date, status, comment, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, vird_key, date) DO UPDATE SET
      status = excluded.status,
      comment = excluded.comment,
      updated_at = excluded.updated_at
  `).run(userId, virdKey, date, status, comment ?? null);
  return d.prepare('SELECT * FROM virdlar WHERE user_id=? AND vird_key=? AND date=?').get(userId, virdKey, date);
}

export function getVirdlarByUserDate(userId, date) {
  return getDb().prepare('SELECT * FROM virdlar WHERE user_id=? AND date=?').all(userId, date);
}

export function getVirdlarForAdmin({ userId, date, month, year }) {
  const d = getDb();
  let q = 'SELECT v.*, u.first_name FROM virdlar v JOIN users u ON u.id = v.user_id WHERE 1=1';
  const params = [];
  if (userId) { q += ' AND v.user_id = ?'; params.push(userId); }
  if (date)   { q += ' AND v.date = ?';    params.push(date); }
  if (month && year) {
    q += " AND strftime('%Y-%m', v.date) = ?";
    params.push(`${year}-${String(month).padStart(2,'0')}`);
  } else if (year) {
    q += " AND strftime('%Y', v.date) = ?";
    params.push(String(year));
  }
  return d.prepare(q).all(...params);
}
```

- [ ] **Step 5: Testni ishga tushirish — o'tishini tekshirish**

```bash
node --test tests/db.test.js
```

Expected: `3 passing`

- [ ] **Step 6: Commit**

```bash
git add src/db/ tests/db.test.js
git commit -m "feat: SQLite DB schema and helpers"
```

---

## Task 3: Telegram initData autentifikatsiyasi

**Files:**
- Create: `src/api/auth.js`
- Create: `tests/auth.test.js`

- [ ] **Step 1: Failing test yozish**

```js
// tests/auth.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateInitData, parseInitData } from '../src/api/auth.js';

const BOT_TOKEN = '1234567890:test_token_for_testing_purposes_only';

describe('validateInitData', () => {
  it('rejects empty string', () => {
    assert.equal(validateInitData('', BOT_TOKEN), false);
  });

  it('rejects tampered hash', () => {
    const fake = 'auth_date=9999999999&user=%7B%22id%22%3A1%7D&hash=badhash';
    assert.equal(validateInitData(fake, BOT_TOKEN), false);
  });
});

describe('parseInitData', () => {
  it('extracts user object', () => {
    const raw = 'auth_date=1700000000&user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Nigora%22%7D&hash=abc';
    const result = parseInitData(raw);
    assert.equal(result.user.id, 42);
    assert.equal(result.user.first_name, 'Nigora');
  });
});
```

- [ ] **Step 2: Test muvaffaqiyatsiz — tekshirish**

```bash
node --test tests/auth.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: src/api/auth.js yaratish**

```js
// src/api/auth.js
import { createHmac } from 'crypto';

export function validateInitData(initDataRaw, botToken) {
  if (!initDataRaw) return false;
  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) return false;

    params.delete('hash');
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (computedHash !== hash) return false;

    const authDate = Number(params.get('auth_date'));
    if (Date.now() / 1000 - authDate > 86400) return false;

    return true;
  } catch {
    return false;
  }
}

export function parseInitData(initDataRaw) {
  const params = new URLSearchParams(initDataRaw);
  const userRaw = params.get('user');
  return {
    user: userRaw ? JSON.parse(userRaw) : null,
    auth_date: params.get('auth_date'),
  };
}

export function requireAuth(req, res, next) {
  const initData = req.headers['x-init-data'] || req.query.initData;
  if (!validateInitData(initData, process.env.BOT_TOKEN)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const parsed = parseInitData(initData);
  req.telegramUser = parsed.user;
  next();
}

export function requireAdmin(req, res, next) {
  const adminIds = (process.env.ADMIN_IDS || '').split(',').map(Number);
  if (!adminIds.includes(req.telegramUser?.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
```

- [ ] **Step 4: Testni o'tkazish**

```bash
node --test tests/auth.test.js
```

Expected: `2 passing`

- [ ] **Step 5: Commit**

```bash
git add src/api/auth.js tests/auth.test.js
git commit -m "feat: Telegram initData HMAC auth middleware"
```

---

## Task 4: API routes — virdlar

**Files:**
- Create: `src/api/routes/virdlar.js`
- Create: `tests/virdlar.test.js`

- [ ] **Step 1: Failing test yozish**

```js
// tests/virdlar.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';
process.env.BOT_TOKEN = 'test';
process.env.ADMIN_IDS = '1';

const { initDb, upsertUser } = await import('../src/db/index.js');
initDb();
const user = upsertUser(42, 'Nigora');

const { buildVirdlarRouter } = await import('../src/api/routes/virdlar.js');
import express from 'express';
const app = express();
app.use(express.json());

// Auth bypass for tests
app.use((req, _res, next) => {
  req.telegramUser = { id: 42 };
  next();
});
app.use('/api/virdlar', buildVirdlarRouter());

import request from 'supertest'; // npm i -D supertest

describe('GET /api/virdlar', () => {
  it('returns empty array for new user', async () => {
    const res = await request(app).get('/api/virdlar?date=2026-05-09');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});

describe('POST /api/virdlar', () => {
  it('creates a vird record', async () => {
    const res = await request(app)
      .post('/api/virdlar')
      .send({ vird_key: 'tahajjud', date: '2026-05-09', status: 'done', comment: '' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'done');
    assert.equal(res.body.vird_key, 'tahajjud');
  });

  it('rejects unknown vird_key', async () => {
    const res = await request(app)
      .post('/api/virdlar')
      .send({ vird_key: 'unknown', date: '2026-05-09', status: 'done' });
    assert.equal(res.status, 400);
  });
});
```

- [ ] **Step 2: supertest o'rnatish**

```bash
npm i -D supertest
```

- [ ] **Step 3: Test muvaffaqiyatsiz — tekshirish**

```bash
node --test tests/virdlar.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 4: src/api/routes/virdlar.js yaratish**

```js
// src/api/routes/virdlar.js
import { Router } from 'express';
import { VIRDLAR } from '../../constants.js';
import {
  upsertUser, upsertVird, getVirdlarByUserDate, getTodayStr, isLocked, getDb
} from '../../db/index.js';

const VALID_KEYS = new Set(VIRDLAR.map(v => v.key));

export function buildVirdlarRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const tgUser = req.telegramUser;
    const user = upsertUser(tgUser.id, tgUser.first_name || 'Xonim');
    const date = req.query.date || getTodayStr();
    const rows = getVirdlarByUserDate(user.id, date);
    res.json(rows);
  });

  router.post('/', (req, res) => {
    if (isLocked()) {
      return res.status(403).json({ error: 'Bugungi virdlar yopildi' });
    }
    const { vird_key, date, status, comment } = req.body;
    if (!VALID_KEYS.has(vird_key)) {
      return res.status(400).json({ error: 'Noto\'g\'ri vird_key' });
    }
    if (!['done', 'not_done'].includes(status)) {
      return res.status(400).json({ error: 'Noto\'g\'ri status' });
    }
    const today = getTodayStr();
    if (date !== today) {
      return res.status(403).json({ error: 'Faqat bugungi sanaga kiritish mumkin' });
    }
    const tgUser = req.telegramUser;
    const user = upsertUser(tgUser.id, tgUser.first_name || 'Xonim');
    const vird = upsertVird({ userId: user.id, virdKey: vird_key, date, status, comment });
    res.json(vird);
  });

  return router;
}
```

- [ ] **Step 5: Testni o'tkazish**

```bash
node --test tests/virdlar.test.js
```

Expected: `3 passing`

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/virdlar.js tests/virdlar.test.js
git commit -m "feat: virdlar API routes with validation"
```

---

## Task 5: API routes — admin

**Files:**
- Create: `src/api/routes/admin.js`
- Create: `tests/admin.test.js`

- [ ] **Step 1: Failing test yozish**

```js
// tests/admin.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';
process.env.BOT_TOKEN = 'test';
process.env.ADMIN_IDS = '1';

const { initDb, upsertUser, upsertVird } = await import('../src/db/index.js');
initDb();
upsertUser(1, 'Admin');
const u2 = upsertUser(2, 'Malika');
upsertVird({ userId: u2.id, virdKey: 'yasin', date: '2026-05-09', status: 'done', comment: 'Yaxshi' });

const { buildAdminRouter } = await import('../src/api/routes/admin.js');
import express from 'express';
import request from 'supertest';
const app = express();
app.use((req, _res, next) => { req.telegramUser = { id: 1 }; next(); });
app.use('/api/admin', buildAdminRouter());

describe('GET /api/admin/users', () => {
  it('returns all users', async () => {
    const res = await request(app).get('/api/admin/users');
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 2);
  });
});

describe('GET /api/admin/virdlar', () => {
  it('filters by date', async () => {
    const res = await request(app).get('/api/admin/virdlar?date=2026-05-09');
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 1);
    assert.equal(res.body[0].vird_key, 'yasin');
  });
});
```

- [ ] **Step 2: Test muvaffaqiyatsiz — tekshirish**

```bash
node --test tests/admin.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: src/api/routes/admin.js yaratish**

```js
// src/api/routes/admin.js
import { Router } from 'express';
import { getAllUsers, getVirdlarForAdmin } from '../../db/index.js';

export function buildAdminRouter() {
  const router = Router();

  router.get('/users', (_req, res) => {
    res.json(getAllUsers());
  });

  router.get('/virdlar', (req, res) => {
    const { user_id, date, month, year } = req.query;
    const rows = getVirdlarForAdmin({
      userId: user_id ? Number(user_id) : null,
      date: date || null,
      month: month ? Number(month) : null,
      year: year ? Number(year) : null,
    });
    res.json(rows);
  });

  return router;
}
```

- [ ] **Step 4: Testni o'tkazish**

```bash
node --test tests/admin.test.js
```

Expected: `2 passing`

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/admin.js tests/admin.test.js
git commit -m "feat: admin API routes"
```

---

## Task 6: Express server va bot webhook

**Files:**
- Create: `src/api/index.js`
- Create: `src/bot/index.js`
- Create: `src/bot/handlers.js`

- [ ] **Step 1: src/bot/handlers.js yaratish**

```js
// src/bot/handlers.js
import { upsertUser } from '../../db/index.js';

export function registerHandlers(bot, webappUrl) {
  bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    upsertUser(id, first_name);
    await ctx.reply(
      `Assalomu Alaykum, ${first_name} xonim! 👋`,
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📿 Virdlarni kiritish',
              web_app: { url: webappUrl }
            }
          ]]
        }
      }
    );
  });
}
```

- [ ] **Step 2: src/bot/index.js yaratish**

```js
// src/bot/index.js
import { Telegraf } from 'telegraf';
import { registerHandlers } from './handlers.js';

export function createBot() {
  const bot = new Telegraf(process.env.BOT_TOKEN);
  registerHandlers(bot, process.env.WEBAPP_URL);
  return bot;
}
```

- [ ] **Step 3: src/api/index.js yaratish**

```js
// src/api/index.js
import 'dotenv/config';
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDb } from '../db/index.js';
import { requireAuth, requireAdmin } from './auth.js';
import { buildVirdlarRouter } from './routes/virdlar.js';
import { buildAdminRouter } from './routes/admin.js';
import { createBot } from '../bot/index.js';
import { startScheduler } from '../bot/scheduler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

initDb();

const app = express();
app.use(express.json());

const bot = createBot();

// Webhook endpoint
const webhookPath = `/webhook/${process.env.WEBHOOK_SECRET}`;
app.use(bot.webhookCallback(webhookPath));

// API routes
app.use('/api/virdlar', requireAuth, buildVirdlarRouter());
app.use('/api/admin',   requireAuth, requireAdmin, buildAdminRouter());

// Static webapp
const webappDist = join(__dirname, '../../webapp/dist');
app.use(express.static(webappDist));
app.get('*', (_req, res) => {
  res.sendFile(join(webappDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on :${PORT}`);
  if (process.env.NODE_ENV !== 'test') {
    await bot.telegram.setWebhook(
      `${process.env.WEBAPP_URL}${webhookPath}`
    );
    startScheduler(bot);
  }
});

export { app, bot };
```

- [ ] **Step 4: Commit**

```bash
git add src/api/index.js src/bot/index.js src/bot/handlers.js
git commit -m "feat: Express server + Telegraf webhook setup"
```

---

## Task 7: Scheduler

**Files:**
- Create: `src/bot/scheduler.js`

- [ ] **Step 1: src/bot/scheduler.js yaratish**

```js
// src/bot/scheduler.js
import cron from 'node-cron';
import { getAllUsers, getVirdlarByUserDate, getTodayStr } from '../db/index.js';
import { VIRDLAR } from '../constants.js';

export function startScheduler(bot) {
  // 22:00 Toshkent — ogohlantirish
  cron.schedule('0 17 * * *', async () => {
    // UTC+5: 22:00 = 17:00 UTC
    const users = getAllUsers();
    for (const user of users) {
      try {
        await bot.telegram.sendMessage(
          user.telegram_id,
          '⏰ Bugungi virdlarni kiritishga 1 soat qoldi!'
        );
      } catch { /* foydalanuvchi botti bloklagan bo'lishi mumkin */ }
    }
  }, { timezone: 'Asia/Tashkent' });

  // 23:10 Toshkent — adminlarga hisobot
  cron.schedule('10 18 * * *', async () => {
    // UTC+5: 23:10 = 18:10 UTC
    const adminIds = (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean);
    const today = getTodayStr();
    const report = buildReport(today);
    for (const adminId of adminIds) {
      try {
        await bot.telegram.sendMessage(adminId, report, { parse_mode: 'Markdown' });
      } catch { /* silent */ }
    }
  }, { timezone: 'Asia/Tashkent' });
}

function buildReport(date) {
  const [y, m, d] = date.split('-');
  const header = `📅 ${d}.${m}.${y}\n\n${VIRDLAR.map(v => v.label).join('\n')}\n\n`;

  const users = getAllUsers();
  const lines = users.map(user => {
    const rows = getVirdlarByUserDate(user.id, date);
    const doneKeys = new Set(rows.filter(r => r.status === 'done').map(r => r.vird_key));
    if (doneKeys.size === 0) return null;
    const emojis = VIRDLAR
      .filter(v => doneKeys.has(v.key))
      .map(v => v.label.split(' ')[0])
      .join(',');
    return `${user.first_name} — ${emojis}`;
  }).filter(Boolean);

  return header + (lines.length ? lines.join('\n') : '_(hech kim kiritmadi)_');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/bot/scheduler.js
git commit -m "feat: cron scheduler for reminders and daily report"
```

---

## Task 8: React WebApp — setup va VirdlarPage

**Files:**
- Create: `webapp/package.json`
- Create: `webapp/vite.config.js`
- Create: `webapp/index.html`
- Create: `webapp/src/main.jsx`
- Create: `webapp/src/App.jsx`
- Create: `webapp/src/api.js`
- Create: `webapp/src/pages/VirdlarPage.jsx`
- Create: `webapp/src/components/VirdCard.jsx`
- Create: `webapp/src/components/CommentModal.jsx`

- [ ] **Step 1: webapp/ scaffold**

```bash
cd webapp && npm create vite@latest . -- --template react && npm install
```

- [ ] **Step 2: webapp/vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 3: webapp/src/api.js yaratish**

```js
// webapp/src/api.js
const tg = window.Telegram?.WebApp;

function getInitData() {
  return tg?.initData || '';
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-init-data': getInitData(),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getVirdlar: (date) => apiFetch(`/api/virdlar?date=${date}`),
  postVird: (body)   => apiFetch('/api/virdlar', { method: 'POST', body: JSON.stringify(body) }),
  getUsers: ()       => apiFetch('/api/admin/users'),
  getAdminVirdlar: (params) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v)));
    return apiFetch(`/api/admin/virdlar?${q}`);
  },
};
```

- [ ] **Step 4: webapp/src/components/VirdCard.jsx yaratish**

```jsx
// webapp/src/components/VirdCard.jsx
export function VirdCard({ vird, record, onToggle, onComment, disabled }) {
  const isDone = record?.status === 'done';

  return (
    <div
      className={`vird-card ${isDone ? 'done' : 'not-done'} ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && onToggle(vird.key, isDone ? 'not_done' : 'done')}
    >
      <span className="vird-emoji">{vird.label.split(' ')[0]}</span>
      <span className="vird-name">{vird.label.split(' ').slice(1).join(' ')}</span>
      {isDone && (
        <button
          className="comment-btn"
          onClick={(e) => { e.stopPropagation(); onComment(vird.key, record?.comment); }}
        >
          💬
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: webapp/src/components/CommentModal.jsx yaratish**

```jsx
// webapp/src/components/CommentModal.jsx
import { useState } from 'react';

export function CommentModal({ virdKey, initialComment, onSave, onClose }) {
  const [text, setText] = useState(initialComment || '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Izoh</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ixtiyoriy izoh..."
          rows={4}
        />
        <div className="modal-actions">
          <button onClick={onClose}>Bekor</button>
          <button className="primary" onClick={() => onSave(virdKey, text)}>Saqlash</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: webapp/src/pages/VirdlarPage.jsx yaratish**

```jsx
// webapp/src/pages/VirdlarPage.jsx
import { useState, useEffect } from 'react';
import { VirdCard } from '../components/VirdCard.jsx';
import { CommentModal } from '../components/CommentModal.jsx';
import { api } from '../api.js';
import { VIRDLAR } from '../constants.js';

function getTodayStr() {
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function isLocked() {
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return now.getHours() >= 23;
}

export function VirdlarPage({ tgUser, isAdmin, onAdminClick }) {
  const today = getTodayStr();
  const locked = isLocked();
  const [records, setRecords] = useState([]);
  const [modal, setModal] = useState(null); // { key, comment }

  useEffect(() => {
    api.getVirdlar(today).then(setRecords).catch(console.error);
  }, [today]);

  const recordMap = Object.fromEntries(records.map(r => [r.vird_key, r]));

  const handleToggle = async (key, newStatus) => {
    const updated = await api.postVird({ vird_key: key, date: today, status: newStatus, comment: recordMap[key]?.comment || '' });
    setRecords(prev => {
      const idx = prev.findIndex(r => r.vird_key === key);
      if (idx >= 0) return prev.map(r => r.vird_key === key ? updated : r);
      return [...prev, updated];
    });
  };

  const handleSaveComment = async (key, comment) => {
    const updated = await api.postVird({ vird_key: key, date: today, status: recordMap[key]?.status || 'done', comment });
    setRecords(prev => prev.map(r => r.vird_key === key ? updated : r));
    setModal(null);
  };

  const [d, m, y] = today.split('-');
  const dateLabel = `${d}.${m}.${y}`;

  return (
    <div className="page virdlar-page">
      <header className="page-header">
        <div>
          <div className="date">{dateLabel}</div>
          <div className="username">{tgUser?.first_name} xonim</div>
        </div>
        {isAdmin && (
          <button className="admin-btn" onClick={onAdminClick}>Admin</button>
        )}
      </header>

      {locked && (
        <div className="locked-banner">🔒 Bugungi virdlar yopildi</div>
      )}

      <div className="virdlar-grid">
        {VIRDLAR.map(vird => (
          <VirdCard
            key={vird.key}
            vird={vird}
            record={recordMap[vird.key]}
            onToggle={handleToggle}
            onComment={(key, comment) => setModal({ key, comment })}
            disabled={locked}
          />
        ))}
      </div>

      {modal && (
        <CommentModal
          virdKey={modal.key}
          initialComment={modal.comment}
          onSave={handleSaveComment}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
cd ..
git add webapp/
git commit -m "feat: React WebApp VirdlarPage with toggle and comment"
```

---

## Task 9: AdminPage va App.jsx

**Files:**
- Create: `webapp/src/pages/AdminPage.jsx`
- Create: `webapp/src/components/UsersList.jsx`
- Create: `webapp/src/App.jsx`
- Create: `webapp/src/constants.js`

- [ ] **Step 1: webapp/src/constants.js yaratish**

```js
// webapp/src/constants.js
export const VIRDLAR = [
  { key: 'tahajjud', label: '🌃 Таҳажжуд' },
  { key: 'zuho',     label: '🌄 Зуҳо' },
  { key: 'zikrlar',  label: '📿 Зикрлар' },
  { key: 'yasin',    label: '❤️ Ясин' },
  { key: 'takror',   label: '🔄 Такрор' },
  { key: 'tavba',    label: '🧎‍♀️ Тавба' },
  { key: 'mulk',     label: '📖💰 Мулк' },
  { key: 'duolar',   label: '🤲 Дуолар' },
  { key: 'oyatlar',  label: '📑 285-286' },
  { key: 'mutolaa',  label: '📚 Мутолаа' },
  { key: 'muhosaba', label: '🧠 Муҳосаба' },
  { key: 'qazo',     label: '⏳ Қазо рўза' },
];
```

- [ ] **Step 2: webapp/src/components/UsersList.jsx yaratish**

```jsx
// webapp/src/components/UsersList.jsx
export function UsersList({ users, selectedId, onSelect }) {
  return (
    <aside className="users-list">
      {users.map(u => (
        <div
          key={u.id}
          className={`user-item ${u.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(u)}
        >
          {u.first_name}
        </div>
      ))}
    </aside>
  );
}
```

- [ ] **Step 3: webapp/src/pages/AdminPage.jsx yaratish**

```jsx
// webapp/src/pages/AdminPage.jsx
import { useState, useEffect } from 'react';
import { UsersList } from '../components/UsersList.jsx';
import { api } from '../api.js';
import { VIRDLAR } from '../constants.js';

export function AdminPage({ onBack }) {
  const now = new Date();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [virdlar, setVirdlar] = useState([]);
  const [commentModal, setCommentModal] = useState(null);
  const [filter, setFilter] = useState({
    year:  now.getFullYear(),
    month: now.getMonth() + 1,
    day:   now.getDate(),
  });

  useEffect(() => { api.getUsers().then(setUsers); }, []);

  useEffect(() => {
    if (!selectedUser) return;
    const date = `${filter.year}-${String(filter.month).padStart(2,'0')}-${String(filter.day).padStart(2,'0')}`;
    api.getAdminVirdlar({ user_id: selectedUser.id, date }).then(setVirdlar);
  }, [selectedUser, filter]);

  const years  = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days   = Array.from({ length: 31 }, (_, i) => i + 1);

  const recordMap = Object.fromEntries(virdlar.map(r => [r.vird_key, r]));

  return (
    <div className="page admin-page">
      <header className="page-header">
        <button onClick={onBack}>← Orqaga</button>
        <h2>Admin panel</h2>
        <div className="filters">
          <select value={filter.year}  onChange={e => setFilter(f => ({...f, year:  Number(e.target.value)}))}>
            {years.map(y  => <option key={y}  value={y}>{y}</option>)}
          </select>
          <select value={filter.month} onChange={e => setFilter(f => ({...f, month: Number(e.target.value)}))}>
            {months.map(m => <option key={m}  value={m}>{m}-oy</option>)}
          </select>
          <select value={filter.day}   onChange={e => setFilter(f => ({...f, day:   Number(e.target.value)}))}>
            {days.map(d   => <option key={d}  value={d}>{d}</option>)}
          </select>
        </div>
      </header>

      <div className="admin-body">
        <UsersList users={users} selectedId={selectedUser?.id} onSelect={setSelectedUser} />

        <main className="virdlar-table">
          {!selectedUser && <p className="hint">Foydalanuvchi tanlang</p>}
          {selectedUser && (
            <table>
              <thead>
                <tr>
                  <th>Vird</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {VIRDLAR.map(v => {
                  const rec = recordMap[v.key];
                  return (
                    <tr
                      key={v.key}
                      className={rec?.status === 'done' ? 'done' : rec ? 'not-done' : 'empty'}
                      onClick={() => rec?.comment && setCommentModal(rec.comment)}
                    >
                      <td>{v.label}</td>
                      <td>{rec?.status === 'done' ? '✅' : rec ? '—' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </main>
      </div>

      {commentModal && (
        <div className="modal-overlay" onClick={() => setCommentModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Izoh</h3>
            <p>{commentModal}</p>
            <button onClick={() => setCommentModal(null)}>Yopish</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: webapp/src/App.jsx yaratish**

```jsx
// webapp/src/App.jsx
import { useState, useEffect } from 'react';
import { VirdlarPage } from './pages/VirdlarPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';

export default function App() {
  const [page, setPage] = useState('virdlar');
  const [tgUser, setTgUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      setTgUser(user);
      const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map(Number);
      setIsAdmin(adminIds.includes(user?.id));
    }
  }, []);

  if (page === 'admin') {
    return <AdminPage onBack={() => setPage('virdlar')} />;
  }

  return (
    <VirdlarPage
      tgUser={tgUser}
      isAdmin={isAdmin}
      onAdminClick={() => setPage('admin')}
    />
  );
}
```

- [ ] **Step 5: webapp/.env.local yaratish**

```
VITE_ADMIN_IDS=123456789,987654321
```

- [ ] **Step 6: Commit**

```bash
git add webapp/src/
git commit -m "feat: AdminPage, UsersList, App routing"
```

---

## Task 10: Styling

**Files:**
- Create: `webapp/src/index.css`

- [ ] **Step 1: webapp/src/index.css yaratish**

```css
:root {
  --bg: var(--tg-theme-bg-color, #fdf6f0);
  --text: var(--tg-theme-text-color, #2d1b0e);
  --hint: var(--tg-theme-hint-color, #9e7b60);
  --button: var(--tg-theme-button-color, #c8855a);
  --button-text: var(--tg-theme-button-text-color, #fff);
  --secondary-bg: var(--tg-theme-secondary-bg-color, #f5ede6);
  --done-bg: #d4f5d4;
  --done-border: #6abf6a;
  --radius: 16px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  min-height: 100dvh;
}

.page { display: flex; flex-direction: column; min-height: 100dvh; }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--secondary-bg);
  gap: 12px;
}

.page-header .date { font-size: 13px; color: var(--hint); }
.page-header .username { font-size: 18px; font-weight: 700; }

.admin-btn {
  background: var(--button);
  color: var(--button-text);
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}

.locked-banner {
  background: #fff3cd;
  color: #856404;
  text-align: center;
  padding: 10px;
  font-weight: 600;
}

.virdlar-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px;
  flex: 1;
}

.vird-card {
  background: var(--secondary-bg);
  border: 2px solid transparent;
  border-radius: var(--radius);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  position: relative;
  transition: background 0.15s, border-color 0.15s;
  user-select: none;
}

.vird-card.done {
  background: var(--done-bg);
  border-color: var(--done-border);
}

.vird-card.disabled { opacity: 0.6; cursor: default; }

.vird-emoji { font-size: 32px; }
.vird-name  { font-size: 12px; text-align: center; color: var(--hint); }

.comment-btn {
  position: absolute;
  top: 8px; right: 8px;
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
}

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end;
  z-index: 100;
}

.modal {
  background: var(--bg);
  border-radius: var(--radius) var(--radius) 0 0;
  padding: 24px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal h3 { font-size: 18px; }

.modal textarea {
  width: 100%;
  border: 1px solid var(--hint);
  border-radius: 10px;
  padding: 10px;
  font-size: 15px;
  background: var(--secondary-bg);
  color: var(--text);
  resize: none;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.modal-actions button {
  padding: 10px 20px;
  border-radius: 10px;
  border: 1px solid var(--hint);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.modal-actions button.primary {
  background: var(--button);
  color: var(--button-text);
  border-color: var(--button);
}

/* Admin */
.admin-page .page-header { flex-wrap: wrap; }
.admin-page .filters { display: flex; gap: 8px; }
.admin-page .filters select {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--hint);
  background: var(--secondary-bg);
  color: var(--text);
  font-size: 14px;
}

.admin-body { display: flex; flex: 1; overflow: hidden; }

.users-list {
  width: 140px;
  min-width: 140px;
  background: var(--secondary-bg);
  overflow-y: auto;
  border-right: 1px solid #e0cfc5;
}

.user-item {
  padding: 12px 14px;
  cursor: pointer;
  font-size: 14px;
  border-bottom: 1px solid #e0cfc5;
}

.user-item.selected { background: var(--done-bg); font-weight: 700; }

.virdlar-table { flex: 1; overflow-y: auto; padding: 12px; }

.virdlar-table table { width: 100%; border-collapse: collapse; }
.virdlar-table th, .virdlar-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #e0cfc5;
  font-size: 14px;
}

.virdlar-table tr.done  { background: var(--done-bg); }
.virdlar-table tr.not-done { background: #fdecea; }

.hint { color: var(--hint); padding: 20px; font-size: 14px; }
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/index.css
git commit -m "feat: WebApp CSS styling with Telegram theme variables"
```

---

## Task 11: Docker va deploy

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: .dockerignore yaratish**

```
node_modules
webapp/node_modules
data
.env
*.log
```

- [ ] **Step 2: Dockerfile yaratish**

```dockerfile
FROM node:20-alpine AS webapp-builder
WORKDIR /app/webapp
COPY webapp/package*.json ./
RUN npm ci
COPY webapp/ .
ARG VITE_ADMIN_IDS
ENV VITE_ADMIN_IDS=$VITE_ADMIN_IDS
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ src/
COPY --from=webapp-builder /app/webapp/dist webapp/dist
VOLUME ["/app/data"]
EXPOSE 3000
ENV TZ=Asia/Tashkent
CMD ["node", "src/api/index.js"]
```

- [ ] **Step 3: docker-compose.yml yaratish**

```yaml
services:
  peshqadam:
    build:
      context: .
      args:
        VITE_ADMIN_IDS: ${ADMIN_IDS}
    env_file: .env
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    networks:
      - caddy_net

networks:
  caddy_net:
    external: true
```

> **Eslatma:** `caddy_net` — mavjud Caddy bilan bir xil Docker network nomi. VPS da `docker network inspect` orqali tekshiring.

- [ ] **Step 4: Caddy config qo'shimcha (mavjud Caddyfile ga)**

```
peshqadam.jamm.uz {
  encode gzip zstd
  reverse_proxy peshqadam:3000
}
```

- [ ] **Step 5: Local build sinash**

```bash
docker compose build
docker compose up
```

Expected: `Server running on :3000` konsolda chiqadi

- [ ] **Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "feat: Docker multi-stage build and compose config"
```

---

## Task 12: Barcha testlarni o'tkazish va final

- [ ] **Step 1: Barcha testlarni ishga tushirish**

```bash
node --test tests/
```

Expected: barcha testlar `passing`

- [ ] **Step 2: Webapp build tekshirish**

```bash
cd webapp && npm run build
```

Expected: `dist/` papkasi yaratiladi, xato yo'q

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "chore: final check and cleanup"
```

- [ ] **Step 4: VPS ga deploy**

```bash
# VPS da:
git clone <repo> peshqadam
cd peshqadam
cp .env.example .env
# .env ni to'ldirish: BOT_TOKEN, ADMIN_IDS, WEBHOOK_SECRET, WEBAPP_URL
docker compose up -d
```

- [ ] **Step 5: Webhook tekshirish**

```bash
curl https://peshqadam.jamm.uz/webhook/${WEBHOOK_SECRET} -d '{"update_id":1}' -H "Content-Type: application/json"
```

Expected: `200 OK`
