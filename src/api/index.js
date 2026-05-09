import 'dotenv/config';
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDb } from '../db/index.js';
import { requireAuth, requireAdmin } from './auth.js';
import { buildVirdlarRouter } from './routes/virdlar.js';
import { buildAdminRouter } from './routes/admin.js';
import { createBot } from '../bot/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

initDb();

const app = express();
app.use(express.json());

const bot = createBot();

const webhookPath = `/webhook/${process.env.WEBHOOK_SECRET || 'dev'}`;
app.use(bot.webhookCallback(webhookPath));

app.use('/api/virdlar', requireAuth, buildVirdlarRouter());
app.use('/api/admin',   requireAuth, requireAdmin, buildAdminRouter());

const webappDist = join(__dirname, '../../webapp/dist');
app.use(express.static(webappDist));
app.get('*', (_req, res) => {
  res.sendFile(join(webappDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`Server running on :${PORT}`);
  if (process.env.NODE_ENV !== 'test' && process.env.BOT_TOKEN && process.env.WEBHOOK_SECRET) {
    try {
      await bot.telegram.setWebhook(`${process.env.WEBAPP_URL}${webhookPath}`);
      const { startScheduler } = await import('../bot/scheduler.js');
      startScheduler(bot);
    } catch (e) {
      console.error('Bot setup error:', e.message);
    }
  }
});

export { app, bot, server };
