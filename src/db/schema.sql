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
