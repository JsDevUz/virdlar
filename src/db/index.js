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
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export function isLocked() {
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
