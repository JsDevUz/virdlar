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
    const user = upsertUser(tgUser.id, tgUser.first_name || 'Unknown', req.groupId);
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
    const user = upsertUser(tgUser.id, tgUser.first_name || 'Unknown', req.groupId);
    if (user.is_banned) {
      return res.status(403).json({ error: 'Sizga botdan foydalanish taqiqlangan' });
    }
    const vird = upsertVird({ userId: user.id, virdKey: vird_key, date, status, comment });
    res.json(vird);
  });

  return router;
}
