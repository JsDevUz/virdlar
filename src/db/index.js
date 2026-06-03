import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { VIRDLAR as DEFAULT_VIRDLAR } from '../constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
let db;

export function initDb() {
  const path = process.env.DATABASE_PATH || './data/virdlar.db';
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  migrateDb();
}

function migrateDb() {
  const cols = getDb().prepare('PRAGMA table_info(groups)').all().map(c => c.name);
  if (!cols.includes('telegram_group_id')) {
    getDb().exec('ALTER TABLE groups ADD COLUMN telegram_group_id TEXT');
  }
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

export function updateGroup(id, { name, adminIds, isActive, telegramGroupId }) {
  const d = getDb();
  const fields = [];
  const params = [];
  if (name !== undefined)            { fields.push('name = ?');              params.push(name); }
  if (adminIds !== undefined)        { fields.push('admin_ids = ?');         params.push(adminIds); }
  if (isActive !== undefined)        { fields.push('is_active = ?');         params.push(isActive ? 1 : 0); }
  if (telegramGroupId !== undefined) { fields.push('telegram_group_id = ?'); params.push(telegramGroupId || null); }
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

export function getUserGroups(telegramId) {
  return getDb().prepare(`
    SELECT g.* FROM groups g
    JOIN users u ON u.group_id = g.id
    WHERE u.telegram_id = ? AND g.is_active = 1
    ORDER BY u.created_at
  `).all(telegramId);
}

export function deleteUser(id, groupId) {
  const d = getDb();
  const user = d.prepare('SELECT * FROM users WHERE id = ? AND group_id = ?').get(id, groupId);
  if (!user) return null;
  d.prepare('DELETE FROM virdlar WHERE user_id = ?').run(id);
  d.prepare('DELETE FROM users WHERE id = ? AND group_id = ?').run(id, groupId);
  return user;
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
