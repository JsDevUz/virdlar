// tests/db.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('DB', () => {
  before(() => {
    process.env.DATABASE_PATH = ':memory:';
  });

  it('creates users table', async () => {
    const { initDb, getDb } = await import('../src/db/index.js');
    initDb();
    const db = getDb();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    assert.equal(row.name, 'users');
  });

  it('creates virdlar table', async () => {
    const { getDb } = await import('../src/db/index.js');
    const db = getDb();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='virdlar'").get();
    assert.equal(row.name, 'virdlar');
  });

  it('upsertUser creates and returns user', async () => {
    const { upsertUser, createGroup } = await import('../src/db/index.js');
    const group = createGroup({ slug: 'db-test-guruh', name: 'DB Test guruh', adminIds: '' });
    const user = upsertUser(111, 'Nigora', group.id);
    assert.equal(user.telegram_id, 111);
    assert.equal(user.first_name, 'Nigora');
  });
});
