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
