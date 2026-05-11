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
  migrateDb();
}

export function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

function migrateDb() {
  const columns = getDb().prepare('PRAGMA table_info(users)').all().map(c => c.name);
  const missing = [
    ['custom_name', 'ALTER TABLE users ADD COLUMN custom_name TEXT'],
    ['group_key', 'ALTER TABLE users ADD COLUMN group_key TEXT'],
    ['is_banned', 'ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0'],
    ['exclude_from_report', 'ALTER TABLE users ADD COLUMN exclude_from_report INTEGER NOT NULL DEFAULT 0'],
  ].filter(([name]) => !columns.includes(name));

  for (const [, sql] of missing) getDb().exec(sql);
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
  return getDb().prepare(`
    SELECT *, COALESCE(NULLIF(custom_name, ''), first_name) AS display_name
    FROM users
    ORDER BY display_name
  `).all();
}

export function updateUserAdmin(id, { customName, groupKey, isBanned, excludeFromReport }) {
  const d = getDb();
  d.prepare(`
    UPDATE users
    SET custom_name = ?,
        group_key = ?,
        is_banned = ?,
        exclude_from_report = ?
    WHERE id = ?
  `).run(
    customName?.trim() || null,
    groupKey || null,
    isBanned ? 1 : 0,
    excludeFromReport ? 1 : 0,
    id
  );
  return d.prepare(`
    SELECT *, COALESCE(NULLIF(custom_name, ''), first_name) AS display_name
    FROM users
    WHERE id = ?
  `).get(id);
}

export function getTodayStr() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tashkent' }).format(new Date());
}

export function isLocked() {
  const hour = Number(
    new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Tashkent',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  );
  return hour >= 23;
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
  let q = `
    SELECT v.*, u.first_name, u.custom_name,
           COALESCE(NULLIF(u.custom_name, ''), u.first_name) AS display_name
    FROM virdlar v
    JOIN users u ON u.id = v.user_id
    WHERE 1=1
  `;
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
