import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

process.env.DATABASE_PATH = ':memory:';
process.env.BOT_TOKEN = 'test';
process.env.ADMIN_IDS = '1';

const { initDb, upsertUser } = await import('../src/db/index.js');
initDb();
upsertUser(42, 'Nigora');

const { buildVirdlarRouter } = await import('../src/api/routes/virdlar.js');

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.telegramUser = { id: 42, first_name: 'Nigora' };
  next();
});
app.use('/api/virdlar', buildVirdlarRouter());

describe('GET /api/virdlar', () => {
  it('returns array for user', async () => {
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
