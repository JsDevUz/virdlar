import { Router } from 'express';
import { getAllUsers, getVirdlarForAdmin } from '../../db/index.js';

export function buildAdminRouter() {
  const router = Router();

  router.get('/users', (_req, res) => {
    res.json(getAllUsers());
  });

  router.get('/virdlar', (req, res) => {
    const { user_id, date, month, year } = req.query;
    const rows = getVirdlarForAdmin({
      userId: user_id ? Number(user_id) : null,
      date: date || null,
      month: month ? Number(month) : null,
      year: year ? Number(year) : null,
    });
    res.json(rows);
  });

  return router;
}
