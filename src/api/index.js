import 'dotenv/config';
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDb } from '../db/index.js';
import { requireAuth, requireAdmin, requireSuperAdmin } from './auth.js';
import { buildGroupsRouter } from './routes/groups.js';
import { buildVirdlarRouter } from './routes/virdlar.js';
import { buildAdminRouter } from './routes/admin.js';
import { createBot } from '../bot/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

initDb();

const app = express();
app.use(express.json({ limit: '16kb' }));
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const bot = createBot();

app.get('/api/me', requireAuth, (req, res) => {
  const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean);
  const isSuperAdmin = superAdminIds.includes(req.telegramUser?.id);
  const groupAdminIds = (req.group?.admin_ids || '').split(',').map(Number).filter(Boolean);
  const isAdmin = isSuperAdmin || groupAdminIds.includes(req.telegramUser?.id);
  res.json({ isAdmin, isSuperAdmin });
});

app.use('/api/groups',  requireAuth, requireSuperAdmin, buildGroupsRouter());
app.use('/api/virdlar', requireAuth, buildVirdlarRouter());
app.use('/api/admin',   requireAuth, requireAdmin, buildAdminRouter());

const webhookPath = `/webhook/${process.env.WEBHOOK_SECRET || 'dev'}`;

// Webhook faqat polling rejimda emas
if (process.env.USE_POLLING !== 'true') {
  app.use(bot.webhookCallback(webhookPath));
}

const webappDist = new URL('../../webapp/dist', import.meta.url).pathname;
app.use(express.static(webappDist));
app.get('*path', (_req, res) => {
  res.sendFile(join(webappDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`Server running on :${PORT}`);
  if (process.env.NODE_ENV === 'test') return;
  try {
    const { startScheduler } = await import('../bot/scheduler.js');
    if (process.env.USE_POLLING === 'true') {
      console.log('Bot polling mode...');
      bot.launch().catch(e => console.error('Bot launch error:', e.message));
      startScheduler(bot);
      process.once('SIGINT', () => bot.stop('SIGINT'));
      process.once('SIGTERM', () => bot.stop('SIGTERM'));
    } else if (process.env.BOT_TOKEN && process.env.WEBHOOK_SECRET) {
      await bot.telegram.setWebhook(`${process.env.WEBAPP_URL}${webhookPath}`);
      startScheduler(bot);
    }
  } catch (e) {
    console.error('Bot setup error:', e.message);
  }
});

export { app, bot, server };
