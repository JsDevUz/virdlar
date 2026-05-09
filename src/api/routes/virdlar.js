import { Router } from 'express';
import { VIRDLAR } from '../../constants.js';
import {
  upsertUser, upsertVird, getVirdlarByUserDate, getTodayStr, isLocked
} from '../../db/index.js';

const VALID_KEYS = new Set(VIRDLAR.map(v => v.key));

export function buildVirdlarRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const tgUser = req.telegramUser;
    const user = upsertUser(tgUser.id, tgUser.first_name || 'Xonim');
    const date = req.query.date || getTodayStr();
    const rows = getVirdlarByUserDate(user.id, date);
    res.json(rows);
  });

  router.post('/', (req, res) => {
    if (isLocked()) {
      return res.status(403).json({ error: 'Bugungi virdlar yopildi' });
    }
    const { vird_key, date, status, comment } = req.body;
    if (!VALID_KEYS.has(vird_key)) {
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
    const user = upsertUser(tgUser.id, tgUser.first_name || 'Xonim');
    const vird = upsertVird({ userId: user.id, virdKey: vird_key, date, status, comment });
    res.json(vird);
  });

  return router;
}
