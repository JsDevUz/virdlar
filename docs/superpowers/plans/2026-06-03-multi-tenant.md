# Multi-tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bitta bot instance bilan ko'p guruhni boshqarish — har guruh izolyatsiyalangan data, alohida adminlar, `/start?g={slug}` orqali ulanish.

**Architecture:** `groups` jadvali qo'shiladi. `users` va `virdlar_config` ga `group_id` foreign key qo'shiladi. Bot `/start?g=slug` parametrini o'qib foydalanuvchini guruhga bog'laydi. API middleware `x-group-slug` headerdan `group_id` aniqlab `req.groupId` o'rnatadi.

**Tech Stack:** Node.js ESM, Express 5, better-sqlite3, Telegraf, React (webapp), node:test + supertest

---

## Fayl xaritasi

| Fayl | O'zgarish |
|------|-----------|
| `src/db/schema.sql` | To'liq qayta yoziladi — yangi 4 jadval |
| `src/db/index.js` | To'liq qayta yoziladi — barcha query larga `group_id` filter |
| `src/api/auth.js` | `requireAuth` ga `x-group-slug` → `req.groupId`; `requireAdmin` DB dan tekshiradi; `requireSuperAdmin` yangi |
| `src/api/routes/admin.js` | Barcha query larga `req.groupId` uzatiladi; `group_key` olib tashlanadi |
| `src/api/routes/virdlar.js` | `upsertUser` va query larga `groupId` uzatiladi |
| `src/api/routes/groups.js` | YANGI — super-admin CRUD |
| `src/api/index.js` | `/api/groups` route qo'shiladi; `ADMIN_IDS` env olib tashlanadi |
| `src/bot/handlers.js` | `/start?g={slug}` parse qilish; webapp URL ga `?g=` qo'shish |
| `src/bot/scheduler.js` | `getAllUsers` → `getAllGroupUsers(groupId)`; har guruh admini alohida |
| `src/constants.js` | `TAQSIM_GROUPS` olib tashlanadi (DB ga ko'chadi) |
| `webapp/src/api.js` | Barcha fetchlarga `x-group-slug` header; `/api/groups` endpointlar |
| `webapp/src/App.jsx` | URL dan `?g=` o'qish; slug yo'q bo'lsa xato sahifa |
| `webapp/src/pages/AdminPage.jsx` | `group_key` field olib tashlanadi; super-admin uchun Groups tab |
| `tests/admin.test.js` | `group_id` bilan qayta yoziladi |
| `tests/db.test.js` | `group_id` bilan qayta yoziladi |

---

## Task 1: DB sxemani qayta yozish

**Files:**
- Modify: `src/db/schema.sql`

- [ ] **Step 1: `schema.sql` ni to'liq qayta yoz**

```sql
CREATE TABLE IF NOT EXISTS groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  admin_ids  TEXT NOT NULL DEFAULT '',
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
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

CREATE TABLE IF NOT EXISTS virdlar_config (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   INTEGER NOT NULL REFERENCES groups(id),
  key        TEXT NOT NULL,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(group_id, key)
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

- [ ] **Step 2: Mavjud DB faylini o'chirish** (yangi sxema bilan mos kelmaydi)

```bash
rm -f data/peshqadam.db data/peshqadam.db-shm data/peshqadam.db-wal
```

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.sql
git commit -m "feat: redesign schema for multi-tenant support"
```

---

## Task 2: `src/db/index.js` ni qayta yozish

**Files:**
- Modify: `src/db/index.js`
- Modify: `src/constants.js`

- [ ] **Step 1: `VIRDLAR` ni `constants.js` da qoldir, `TAQSIM_GROUPS` ni o'chir**

`src/constants.js` dan `TAQSIM_GROUPS` export ini olib tashla. Fayl shunday ko'rinadi:

```js
export const VIRDLAR = [
  { key: 'tahajjud', label: '🌃 Таҳажжуд намози' },
  { key: 'zuho',     label: '🌄 Зуҳо намози' },
  { key: 'zikrlar',  label: '📿 Зикрлар' },
  { key: 'yasin',    label: '❤️ Ясин сураси' },
  { key: 'takror',   label: '🔄 Такрор' },
  { key: 'tavba',    label: '🧎‍♀️ Тавба' },
  { key: 'mulk',     label: '👑 Мулк сураси' },
  { key: 'duolar',   label: '🤲 Дуолар' },
  { key: 'oyatlar',  label: '📑 285-286' },
  { key: 'mutolaa1',  label: '½ Ярим пора' },
  { key: 'mutolaa05', label: '📚 Бир пора' },
  { key: 'muhosaba', label: '🧠 Муҳосаба' },
  { key: 'qazo',     label: '⏳ Қазо рўза' },
];
```

- [ ] **Step 2: `src/db/index.js` ni to'liq qayta yoz**

```js
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { VIRDLAR as DEFAULT_VIRDLAR } from '../constants.js';

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

// ── Groups ──────────────────────────────────────────────

export function createGroup({ slug, name, adminIds = '' }) {
  const d = getDb();
  d.prepare(
    'INSERT INTO groups (slug, name, admin_ids) VALUES (?, ?, ?)'
  ).run(slug, name, adminIds);
  return d.prepare('SELECT * FROM groups WHERE slug = ?').get(slug);
}

export function getGroupBySlug(slug) {
  return getDb().prepare('SELECT * FROM groups WHERE slug = ? AND is_active = 1').get(slug);
}

export function getAllGroups() {
  return getDb().prepare('SELECT * FROM groups ORDER BY id').all();
}

export function updateGroup(id, { name, adminIds, isActive }) {
  const d = getDb();
  const fields = [];
  const params = [];
  if (name !== undefined)     { fields.push('name = ?');      params.push(name); }
  if (adminIds !== undefined) { fields.push('admin_ids = ?'); params.push(adminIds); }
  if (isActive !== undefined) { fields.push('is_active = ?'); params.push(isActive ? 1 : 0); }
  if (!fields.length) return d.prepare('SELECT * FROM groups WHERE id = ?').get(id);
  params.push(id);
  d.prepare(`UPDATE groups SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return d.prepare('SELECT * FROM groups WHERE id = ?').get(id);
}

export function seedGroupVirdlarConfig(groupId) {
  const d = getDb();
  const count = d.prepare('SELECT COUNT(*) AS n FROM virdlar_config WHERE group_id = ?').get(groupId).n;
  if (count > 0) return;
  const stmt = d.prepare(
    'INSERT INTO virdlar_config (group_id, key, label, sort_order, is_active) VALUES (?, ?, ?, ?, 1)'
  );
  DEFAULT_VIRDLAR.forEach((v, i) => stmt.run(groupId, v.key, v.label, i));
}

// ── Users ────────────────────────────────────────────────

export function upsertUser(telegramId, firstName, groupId) {
  const d = getDb();
  d.prepare(`
    INSERT INTO users (telegram_id, first_name, group_id)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id, group_id) DO UPDATE SET first_name = excluded.first_name
  `).run(telegramId, firstName, groupId);
  return d.prepare('SELECT * FROM users WHERE telegram_id = ? AND group_id = ?').get(telegramId, groupId);
}

export function getAllUsers(groupId) {
  return getDb().prepare(`
    SELECT *, COALESCE(NULLIF(custom_name, ''), first_name) AS display_name
    FROM users
    WHERE group_id = ?
    ORDER BY display_name
  `).all(groupId);
}

export function updateUserAdmin(id, groupId, { customName, isBanned, excludeFromReport }) {
  const d = getDb();
  d.prepare(`
    UPDATE users
    SET custom_name = ?,
        is_banned = ?,
        exclude_from_report = ?
    WHERE id = ? AND group_id = ?
  `).run(
    customName?.trim() || null,
    isBanned ? 1 : 0,
    excludeFromReport ? 1 : 0,
    id,
    groupId
  );
  return d.prepare(`
    SELECT *, COALESCE(NULLIF(custom_name, ''), first_name) AS display_name
    FROM users WHERE id = ? AND group_id = ?
  `).get(id, groupId);
}

// ── Virdlar Config ───────────────────────────────────────

export function getVirdlarConfig(groupId, { includeInactive = false } = {}) {
  const sql = includeInactive
    ? 'SELECT * FROM virdlar_config WHERE group_id = ? ORDER BY sort_order, id'
    : 'SELECT * FROM virdlar_config WHERE group_id = ? AND is_active = 1 ORDER BY sort_order, id';
  return getDb().prepare(sql).all(groupId);
}

function slugify(label) {
  const map = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'j',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'x',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ы:'i',ь:'',э:'e',ю:'yu',я:'ya',ў:'o',қ:'q',ғ:'g',ҳ:'h'
  };
  const stripped = [...label.toLowerCase()]
    .map(ch => map[ch] ?? (/[a-z0-9]/.test(ch) ? ch : ''))
    .join('');
  return stripped || 'vird';
}

function uniqueKey(groupId, base) {
  const d = getDb();
  let key = base;
  let i = 1;
  while (d.prepare('SELECT 1 FROM virdlar_config WHERE group_id = ? AND key = ?').get(groupId, key)) {
    key = `${base}${i++}`;
  }
  return key;
}

export function addVird(groupId, { label }) {
  const d = getDb();
  const key = uniqueKey(groupId, slugify(label));
  const maxOrder = d.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM virdlar_config WHERE group_id = ?').get(groupId).m;
  d.prepare(
    'INSERT INTO virdlar_config (group_id, key, label, sort_order, is_active) VALUES (?, ?, ?, ?, 1)'
  ).run(groupId, key, label, maxOrder + 1);
  return d.prepare('SELECT * FROM virdlar_config WHERE group_id = ? AND key = ?').get(groupId, key);
}

export function updateVird(id, groupId, { label, isActive }) {
  const d = getDb();
  const fields = [];
  const params = [];
  if (label !== undefined)    { fields.push('label = ?');     params.push(label); }
  if (isActive !== undefined) { fields.push('is_active = ?'); params.push(isActive ? 1 : 0); }
  if (!fields.length) return d.prepare('SELECT * FROM virdlar_config WHERE id = ? AND group_id = ?').get(id, groupId);
  params.push(id, groupId);
  d.prepare(`UPDATE virdlar_config SET ${fields.join(', ')} WHERE id = ? AND group_id = ?`).run(...params);
  return d.prepare('SELECT * FROM virdlar_config WHERE id = ? AND group_id = ?').get(id, groupId);
}

export function moveVird(id, groupId, direction) {
  const d = getDb();
  const current = d.prepare('SELECT * FROM virdlar_config WHERE id = ? AND group_id = ?').get(id, groupId);
  if (!current) return null;
  const op = direction === 'up' ? '<' : '>';
  const order = direction === 'up' ? 'DESC' : 'ASC';
  const neighbor = d.prepare(
    `SELECT * FROM virdlar_config WHERE group_id = ? AND sort_order ${op} ? ORDER BY sort_order ${order} LIMIT 1`
  ).get(groupId, current.sort_order);
  if (!neighbor) return current;
  const tx = d.transaction(() => {
    d.prepare('UPDATE virdlar_config SET sort_order = ? WHERE id = ?').run(neighbor.sort_order, current.id);
    d.prepare('UPDATE virdlar_config SET sort_order = ? WHERE id = ?').run(current.sort_order, neighbor.id);
  });
  tx();
  return d.prepare('SELECT * FROM virdlar_config WHERE id = ? AND group_id = ?').get(id, groupId);
}

// ── Virdlar ──────────────────────────────────────────────

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

export function getVirdlarForAdmin(groupId, { userId, date, month, year }) {
  const d = getDb();
  let q = `
    SELECT v.*, u.first_name, u.custom_name,
           COALESCE(NULLIF(u.custom_name, ''), u.first_name) AS display_name
    FROM virdlar v
    JOIN users u ON u.id = v.user_id
    WHERE u.group_id = ?
  `;
  const params = [groupId];
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

// ── Utility ──────────────────────────────────────────────

export function getTodayStr() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tashkent' }).format(new Date());
}

export function isLocked() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Tashkent',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  const minute = Number(parts.find(p => p.type === 'minute')?.value);
  return hour > 23 || (hour === 23 && minute >= 50);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/db/index.js src/constants.js
git commit -m "feat: rewrite db layer with group_id support"
```

---

## Task 3: `src/api/auth.js` ni yangilash

**Files:**
- Modify: `src/api/auth.js`

- [ ] **Step 1: `auth.js` ni to'liq qayta yoz**

```js
import { createHmac } from 'crypto';
import { getGroupBySlug } from '../db/index.js';

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
    user: userRaw ? (() => { try { return JSON.parse(userRaw); } catch { return null; } })() : null,
    auth_date: params.get('auth_date'),
  };
}

export function requireAuth(req, res, next) {
  // Dev bypass
  if (process.env.DEV_USER_ID) {
    req.telegramUser = {
      id: Number(process.env.DEV_USER_ID),
      first_name: process.env.DEV_USER_NAME || 'DevUser',
    };
    const slug = req.headers['x-group-slug'];
    if (slug) {
      const group = getGroupBySlug(slug);
      if (!group) return res.status(404).json({ error: 'Guruh topilmadi' });
      req.groupId = group.id;
      req.group = group;
    }
    return next();
  }

  const initData = req.headers['x-init-data'] || req.query.initData;
  if (!validateInitData(initData, process.env.BOT_TOKEN)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const parsed = parseInitData(initData);
  req.telegramUser = parsed.user;

  const slug = req.headers['x-group-slug'];
  if (slug) {
    const group = getGroupBySlug(slug);
    if (!group) return res.status(404).json({ error: 'Guruh topilmadi' });
    req.groupId = group.id;
    req.group = group;
  }
  next();
}

export function requireAdmin(req, res, next) {
  const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean);
  if (superAdminIds.includes(req.telegramUser?.id)) return next();

  if (!req.group) return res.status(403).json({ error: 'Forbidden' });
  const groupAdminIds = (req.group.admin_ids || '').split(',').map(Number).filter(Boolean);
  if (!groupAdminIds.includes(req.telegramUser?.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean);
  if (!superAdminIds.includes(req.telegramUser?.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/auth.js
git commit -m "feat: update auth middleware for multi-tenant group resolution"
```

---

## Task 4: Groups route yaratish

**Files:**
- Create: `src/api/routes/groups.js`

- [ ] **Step 1: `src/api/routes/groups.js` fayl yarat**

```js
import { Router } from 'express';
import { getAllGroups, createGroup, updateGroup, seedGroupVirdlarConfig } from '../../db/index.js';

export function buildGroupsRouter() {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(getAllGroups());
  });

  router.post('/', (req, res) => {
    const { slug, name, admin_ids } = req.body;
    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug.trim())) {
      return res.status(400).json({ error: "slug kerak (faqat a-z, 0-9, -)" });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: "name kerak" });
    }
    try {
      const group = createGroup({ slug: slug.trim(), name: name.trim(), adminIds: admin_ids || '' });
      seedGroupVirdlarConfig(group.id);
      res.status(201).json(group);
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Bu slug band' });
      throw e;
    }
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Noto'g'ri id" });
    }
    const { name, admin_ids, is_active } = req.body;
    const updated = updateGroup(id, {
      name: name !== undefined ? String(name).trim() : undefined,
      adminIds: admin_ids !== undefined ? String(admin_ids) : undefined,
      isActive: is_active !== undefined ? Boolean(is_active) : undefined,
    });
    if (!updated) return res.status(404).json({ error: 'Guruh topilmadi' });
    res.json(updated);
  });

  return router;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/routes/groups.js
git commit -m "feat: add groups CRUD route for super-admin"
```

---

## Task 5: Admin va Virdlar routerlarini yangilash

**Files:**
- Modify: `src/api/routes/admin.js`
- Modify: `src/api/routes/virdlar.js`

- [ ] **Step 1: `admin.js` ni to'liq qayta yoz**

```js
import { Router } from 'express';
import { getAllUsers, getVirdlarForAdmin, updateUserAdmin, getVirdlarConfig, addVird, updateVird, moveVird } from '../../db/index.js';

export function buildAdminRouter() {
  const router = Router();

  router.get('/users', (req, res) => {
    res.json(getAllUsers(req.groupId));
  });

  router.patch('/users/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Noto'g'ri user id" });
    }
    const { custom_name, is_banned, exclude_from_report } = req.body;
    if (custom_name != null && typeof custom_name !== 'string') {
      return res.status(400).json({ error: "Noto'g'ri custom_name" });
    }
    const user = updateUserAdmin(id, req.groupId, {
      customName: custom_name,
      isBanned: Boolean(is_banned),
      excludeFromReport: Boolean(exclude_from_report),
    });
    if (!user) return res.status(404).json({ error: 'User topilmadi' });
    res.json(user);
  });

  router.get('/virdlar', (req, res) => {
    const { user_id, date, month, year } = req.query;
    const rows = getVirdlarForAdmin(req.groupId, {
      userId: user_id ? Number(user_id) : null,
      date: date || null,
      month: month ? Number(month) : null,
      year: year ? Number(year) : null,
    });
    res.json(rows);
  });

  router.get('/virdlar-config', (req, res) => {
    res.json(getVirdlarConfig(req.groupId, { includeInactive: true }));
  });

  router.post('/virdlar-config', (req, res) => {
    const { label } = req.body;
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: "Label kerak" });
    }
    res.json(addVird(req.groupId, { label: label.trim() }));
  });

  router.patch('/virdlar-config/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Noto'g'ri id" });
    }
    const { label, is_active } = req.body;
    const updated = updateVird(id, req.groupId, {
      label: label !== undefined ? String(label).trim() : undefined,
      isActive: is_active !== undefined ? Boolean(is_active) : undefined,
    });
    if (!updated) return res.status(404).json({ error: 'Topilmadi' });
    res.json(updated);
  });

  router.post('/virdlar-config/:id/move', (req, res) => {
    const id = Number(req.params.id);
    const { direction } = req.body;
    if (!['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: "direction = up|down" });
    }
    const updated = moveVird(id, req.groupId, direction);
    if (!updated) return res.status(404).json({ error: 'Topilmadi' });
    res.json(updated);
  });

  return router;
}
```

- [ ] **Step 2: `virdlar.js` ni to'liq qayta yoz**

```js
import { Router } from 'express';
import { upsertUser, upsertVird, getVirdlarByUserDate, getTodayStr, isLocked, getVirdlarConfig } from '../../db/index.js';

export function buildVirdlarRouter() {
  const router = Router();

  router.get('/config', (req, res) => {
    res.json(getVirdlarConfig(req.groupId));
  });

  router.get('/', (req, res) => {
    if (!req.groupId) return res.status(400).json({ error: 'Guruh ko\'rsatilmagan' });
    const tgUser = req.telegramUser;
    const user = upsertUser(tgUser.id, tgUser.first_name || 'Xonim', req.groupId);
    if (user.is_banned) {
      return res.status(403).json({ error: 'Sizga botdan foydalanish taqiqlangan' });
    }
    const date = req.query.date || getTodayStr();
    const rows = getVirdlarByUserDate(user.id, date);
    res.json(rows);
  });

  router.post('/', (req, res) => {
    if (!req.groupId) return res.status(400).json({ error: 'Guruh ko\'rsatilmagan' });
    if (isLocked()) {
      return res.status(403).json({ error: 'Bugungi virdlar yopildi' });
    }
    const { vird_key, date, status, comment } = req.body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Noto'g'ri sana formati" });
    }
    const validKeys = new Set(getVirdlarConfig(req.groupId).map(v => v.key));
    if (!validKeys.has(vird_key)) {
      return res.status(400).json({ error: "Noto'g'ri vird_key" });
    }
    if (!['done', 'not_done'].includes(status)) {
      return res.status(400).json({ error: "Noto'g'ri status" });
    }
    const today = getTodayStr();
    if (date !== today) {
      return res.status(403).json({ error: 'Faqat bugungi sanaga kiritish mumkin' });
    }
    const tgUser = req.telegramUser;
    const user = upsertUser(tgUser.id, tgUser.first_name || 'Xonim', req.groupId);
    if (user.is_banned) {
      return res.status(403).json({ error: 'Sizga botdan foydalanish taqiqlangan' });
    }
    const vird = upsertVird({ userId: user.id, virdKey: vird_key, date, status, comment });
    res.json(vird);
  });

  return router;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/api/routes/admin.js src/api/routes/virdlar.js
git commit -m "feat: pass group_id through admin and virdlar routes"
```

---

## Task 6: `src/api/index.js` ni yangilash

**Files:**
- Modify: `src/api/index.js`

- [ ] **Step 1: Groups routerni qo'shish, `ADMIN_IDS` ni `SUPER_ADMIN_IDS` ga almashtirish**

`src/api/index.js` da quyidagi o'zgarishlarni qil:

1. Import ga `buildGroupsRouter` va `requireSuperAdmin` qo'sh:
```js
import { requireAuth, requireAdmin, requireSuperAdmin } from './auth.js';
import { buildGroupsRouter } from './routes/groups.js';
```

2. Route larni yangilash — `app.use` qatorlarini almashtir:
```js
app.use('/api/groups',  requireAuth, requireSuperAdmin, buildGroupsRouter());
app.use('/api/virdlar', requireAuth, buildVirdlarRouter());
app.use('/api/admin',   requireAuth, requireAdmin, buildAdminRouter());
```

3. `process.env.ADMIN_IDS` ga bog'liq joy bo'lsa o'chir (scheduler step da amalga oshiriladi).

- [ ] **Step 2: Commit**

```bash
git add src/api/index.js
git commit -m "feat: register /api/groups route with super-admin guard"
```

---

## Task 7: Bot handlerlarini yangilash

**Files:**
- Modify: `src/bot/handlers.js`

- [ ] **Step 1: `handlers.js` ni to'liq qayta yoz**

```js
import { upsertUser, getTodayStr, getGroupBySlug } from '../db/index.js';
import { buildReport } from './scheduler.js';

export function registerHandlers(bot, webappUrl) {
  const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean);

  bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const slug = ctx.startPayload; // /start?g=slug => ctx.startPayload = 'g=slug' emas, to'g'ridan slug

    // Telegraf ctx.startPayload faqat bitta so'z qaytaradi: /start maktab-7 => 'maktab-7'
    // Bot linkini /start?startapp=maktab-7 emas, /start maktab-7 shaklida yuboriladi
    if (!slug) {
      await ctx.reply('Guruh havolasi orqali kiring. Masalan: /start maktab-7');
      return;
    }

    const group = getGroupBySlug(slug);
    if (!group) {
      await ctx.reply('Guruh topilmadi. To\'g\'ri havola orqali kiring.');
      return;
    }

    const user = upsertUser(id, first_name, group.id);
    if (user.is_banned) {
      await ctx.reply('Sizga botdan foydalanish taqiqlangan.');
      return;
    }

    const groupAdminIds = (group.admin_ids || '').split(',').map(Number).filter(Boolean);
    const isAdmin = superAdminIds.includes(id) || groupAdminIds.includes(id);
    const appUrl = `${webappUrl}?g=${slug}`;
    const keyboard = [[{ text: '📿 Virdlarni kiritish', web_app: { url: appUrl } }]];
    if (isAdmin) keyboard.push([{ text: '📊 Bugungi hisobot', callback_data: `report:${group.id}` }]);

    await ctx.reply(
      `Assalomu Alaykum, ${first_name} xonim! 👋`,
      { reply_markup: { inline_keyboard: keyboard } }
    );
  });

  bot.action(/^report:(\d+)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    const groupAdminIds_check = ctx.callbackQuery?.message; // just need groupId
    await ctx.answerCbQuery();
    const report = buildReport(getTodayStr(), groupId);
    await ctx.reply(report, { parse_mode: 'Markdown' });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/bot/handlers.js
git commit -m "feat: update bot handler to resolve group from /start payload"
```

---

## Task 8: Scheduler ni yangilash

**Files:**
- Modify: `src/bot/scheduler.js`

- [ ] **Step 1: `scheduler.js` ni to'liq qayta yoz**

```js
import cron from 'node-cron';
import { getAllUsers, getAllGroups, getVirdlarByUserDate, getTodayStr, getVirdlarConfig } from '../db/index.js';

const LRM = '‎';

export function startScheduler(bot) {
  // 22:50 — ogohlantirishni barcha guruh foydalanuvchilariga yuborish
  cron.schedule('50 22 * * *', async () => {
    const groups = getAllGroups().filter(g => g.is_active);
    for (const group of groups) {
      const users = getAllUsers(group.id).filter(u => !u.is_banned);
      for (const user of users) {
        try {
          await bot.telegram.sendMessage(
            user.telegram_id,
            '⏰ Bugungi virdlarni kiritishga ohirgi muhlat tugashiga 1 soat qoldi!'
          );
        } catch { /* user may have blocked bot */ }
      }
    }
  }, { timezone: 'Asia/Tashkent' });

  // 23:55 — har guruh adminga alohida hisobot
  cron.schedule('55 23 * * *', async () => {
    const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean);
    const today = getTodayStr();
    const groups = getAllGroups().filter(g => g.is_active);

    for (const group of groups) {
      const report = buildReport(today, group.id);
      const adminIds = [
        ...(group.admin_ids || '').split(',').map(Number).filter(Boolean),
        ...superAdminIds,
      ];
      for (const adminId of [...new Set(adminIds)]) {
        try {
          await bot.telegram.sendMessage(adminId, report, { parse_mode: 'Markdown' });
        } catch { /* silent */ }
      }
    }
  }, { timezone: 'Asia/Tashkent' });
}

export function buildReport(date, groupId) {
  const [y, m, d] = date.split('-');
  const VIRDLAR = getVirdlarConfig(groupId);
  const header = `📅 ${d}.${m}.${y}\n\n${VIRDLAR.map(v => v.label).join('\n')}\n\n`;

  const users = getAllUsers(groupId).filter(u => !u.is_banned && !u.exclude_from_report);
  const active = [];
  const lazy = [];

  for (const user of users) {
    const rows = getVirdlarByUserDate(user.id, date);
    const doneKeys = new Set(rows.filter(r => r.status === 'done').map(r => r.vird_key));
    const name = user.display_name;
    if (doneKeys.size === 0) {
      lazy.push({ name });
    } else {
      const emojis = VIRDLAR
        .filter(v => doneKeys.has(v.key))
        .map(v => v.label.split(' ')[0])
        .join(' ');
      active.push({ name, emojis, count: doneKeys.size });
    }
  }

  let report = header;
  if (active.length) {
    const rows = active.map((u, i) => `${LRM}${i + 1}. ${u.name}${LRM} — [${u.count}]\n${u.emojis}`).join('\n\n');
    report += rows;
  } else {
    report += '_(hech kim kiritmadi)_';
  }
  if (lazy.length) {
    report += `\n\n😴 *G'aflat doskasi:* [${lazy.length}]\n`;
    report += lazy.map((u, i) => `${LRM}${i + 1}. ${u.name}${LRM}`).join('\n');
  }
  return report;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/bot/scheduler.js
git commit -m "feat: update scheduler to send reports per group"
```

---

## Task 9: Testlarni yangilash

**Files:**
- Modify: `tests/admin.test.js`
- Modify: `tests/db.test.js` (agar mavjud bo'lsa)

- [ ] **Step 1: `tests/admin.test.js` ni to'liq qayta yoz**

```js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

process.env.DATABASE_PATH = ':memory:';
process.env.BOT_TOKEN = 'test';
process.env.SUPER_ADMIN_IDS = '1';

const { initDb, createGroup, seedGroupVirdlarConfig, upsertUser, upsertVird } = await import('../src/db/index.js');
initDb();

const group = createGroup({ slug: 'test-guruh', name: 'Test guruh', adminIds: '1' });
seedGroupVirdlarConfig(group.id);
upsertUser(1, 'Admin', group.id);
const u2 = upsertUser(2, 'Malika', group.id);
upsertVird({ userId: u2.id, virdKey: 'yasin', date: '2026-05-09', status: 'done', comment: 'Yaxshi' });

const { buildAdminRouter } = await import('../src/api/routes/admin.js');

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.telegramUser = { id: 1 };
  req.groupId = group.id;
  req.group = group;
  next();
});
app.use('/api/admin', buildAdminRouter());

describe('GET /api/admin/users', () => {
  it('returns users for the group', async () => {
    const res = await request(app).get('/api/admin/users');
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 2);
  });
});

describe('PATCH /api/admin/users/:id', () => {
  it('updates custom name and visibility flags', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${u2.id}`)
      .send({ custom_name: 'M. opa', is_banned: true, exclude_from_report: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.custom_name, 'M. opa');
    assert.equal(res.body.display_name, 'M. opa');
    assert.equal(res.body.is_banned, 1);
    assert.equal(res.body.exclude_from_report, 1);
  });
});

describe('GET /api/admin/virdlar', () => {
  it('filters by date within group', async () => {
    const res = await request(app).get('/api/admin/virdlar?date=2026-05-09');
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 1);
    assert.equal(res.body[0].vird_key, 'yasin');
  });
});

describe('GET /api/admin/virdlar-config', () => {
  it('returns virdlar config for the group', async () => {
    const res = await request(app).get('/api/admin/virdlar-config');
    assert.equal(res.status, 200);
    assert.ok(res.body.length > 0);
    assert.ok(res.body.every(v => v.group_id === group.id));
  });
});
```

- [ ] **Step 2: Testlarni ishga tushir**

```bash
npm test
```

Expected: barcha testlar PASS bo'lishi kerak.

- [ ] **Step 3: Commit**

```bash
git add tests/
git commit -m "test: update tests for multi-tenant group_id support"
```

---

## Task 10: Webapp `api.js` va `App.jsx` yangilash

**Files:**
- Modify: `webapp/src/api.js`
- Modify: `webapp/src/App.jsx`

- [ ] **Step 1: `webapp/src/api.js` ni to'liq qayta yoz**

```js
const tg = window.Telegram?.WebApp;

function getInitData() {
  return tg?.initData || '';
}

function getGroupSlug() {
  return new URLSearchParams(window.location.search).get('g') || '';
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-init-data': getInitData(),
      'x-group-slug': getGroupSlug(),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getVirdlar: (date) => apiFetch(`/api/virdlar?date=${date}`),
  postVird: (body)   => apiFetch('/api/virdlar', { method: 'POST', body: JSON.stringify(body) }),
  getVirdlarConfig: () => apiFetch('/api/virdlar/config'),

  getUsers: ()       => apiFetch('/api/admin/users'),
  updateUser: (id, body) => apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getAdminVirdlar: (params) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v)));
    return apiFetch(`/api/admin/virdlar?${q}`);
  },
  getVirdlarConfigAdmin: () => apiFetch('/api/admin/virdlar-config'),
  addVirdConfig: (label) => apiFetch('/api/admin/virdlar-config', { method: 'POST', body: JSON.stringify({ label }) }),
  updateVirdConfig: (id, body) => apiFetch(`/api/admin/virdlar-config/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  moveVirdConfig: (id, direction) => apiFetch(`/api/admin/virdlar-config/${id}/move`, { method: 'POST', body: JSON.stringify({ direction }) }),

  getGroups: () => apiFetch('/api/groups'),
  createGroup: (body) => apiFetch('/api/groups', { method: 'POST', body: JSON.stringify(body) }),
  updateGroup: (id, body) => apiFetch(`/api/groups/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
```

- [ ] **Step 2: `webapp/src/App.jsx` ni yangilash**

`App.jsx` ni to'liq qayta yoz:

```jsx
import { useState, useEffect } from 'react';
import { VirdlarPage } from './pages/VirdlarPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';

function getGroupSlug() {
  return new URLSearchParams(window.location.search).get('g') || '';
}

export default function App() {
  const [page, setPage] = useState('virdlar');
  const [tgUser, setTgUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const slug = getGroupSlug();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const superAdminIds = (import.meta.env.VITE_SUPER_ADMIN_IDS || '').split(',').map(Number);

    if (tg?.initData) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      setTgUser(user);
      setIsSuperAdmin(superAdminIds.includes(user?.id));
    } else if (import.meta.env.DEV) {
      const devId = Number(import.meta.env.VITE_DEV_USER_ID || 0);
      const devUser = { id: devId, first_name: import.meta.env.VITE_DEV_USER_NAME || 'DevXonim' };
      setTgUser(devUser);
      setIsSuperAdmin(superAdminIds.includes(devId));
    }
  }, []);

  if (!slug && !isSuperAdmin) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Guruh ko'rsatilmagan.</p>
        <p>Bot orqali kiring.</p>
      </div>
    );
  }

  if (page === 'admin') {
    return <AdminPage isSuperAdmin={isSuperAdmin} onBack={() => setPage('virdlar')} />;
  }

  return (
    <VirdlarPage
      tgUser={tgUser}
      isAdmin={isAdmin}
      isSuperAdmin={isSuperAdmin}
      onAdminClick={() => setPage('admin')}
    />
  );
}
```

- [ ] **Step 3: `webapp/.env.example` ni yangilash** — `VITE_ADMIN_IDS` → `VITE_SUPER_ADMIN_IDS`

`webapp/.env.example` fayli mavjud bo'lsa:
```
VITE_SUPER_ADMIN_IDS=123456789
VITE_DEV_USER_ID=123456789
VITE_DEV_USER_NAME=DevXonim
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/api.js webapp/src/App.jsx
git commit -m "feat: add group slug header and super-admin detection in webapp"
```

---

## Task 11: AdminPage dan `group_key` olib tashlash

**Files:**
- Modify: `webapp/src/pages/AdminPage.jsx`

- [ ] **Step 1: `AdminPage.jsx` ni o'qib, `group_key` field ni o'chir**

`AdminPage.jsx` da user edit formasida `group_key` / `TAQSIM_GROUPS` ga oid har qanday UI element va state ni olib tashlash. `custom_name`, `is_banned`, `exclude_from_report` fieldlari qoladi.

- [ ] **Step 2: Ilovani build qilib tekshir**

```bash
cd webapp && npm run build
```

Expected: build xatosiz tugallanishi kerak.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/pages/AdminPage.jsx
git commit -m "feat: remove group_key field from admin user edit form"
```

---

## Task 12: `.env.example` yangilash va yakuniy tekshiruv

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: `.env.example` ni yangilash**

```
BOT_TOKEN=your_bot_token_here
SUPER_ADMIN_IDS=123456789,987654321
REPORT_EXCLUDED_TELEGRAM_IDS=
WEBHOOK_SECRET=random_secret_string
WEBAPP_URL=https://peshqadam.jamm.uz
DATABASE_PATH=./data/peshqadam.db
PORT=3000
TZ=Asia/Tashkent

# --- Lokal dev uchun ---
# USE_POLLING=true
# DEV_USER_ID=123456789
# DEV_USER_NAME=Nigora
```

- [ ] **Step 2: Barcha testlarni ishga tushir**

```bash
npm test
```

Expected: barcha testlar PASS.

- [ ] **Step 3: Build tekshir**

```bash
npm run build
```

Expected: build muvaffaqiyatli.

- [ ] **Step 4: Yakuniy commit**

```bash
git add .env.example
git commit -m "chore: update env example — ADMIN_IDS to SUPER_ADMIN_IDS"
```
