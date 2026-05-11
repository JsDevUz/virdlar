import { Router } from 'express';
import { getAllUsers, getVirdlarForAdmin, updateUserAdmin } from '../../db/index.js';
import { TAQSIM_GROUPS } from '../../constants.js';

const VALID_GROUP_KEYS = new Set(TAQSIM_GROUPS.map(group => group.key));

export function buildAdminRouter() {
  const router = Router();

  router.get('/users', (_req, res) => {
    res.json(getAllUsers());
  });

  router.patch('/users/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Noto'g'ri user id" });
    }

    const { custom_name, group_key, is_banned, exclude_from_report } = req.body;
    if (custom_name != null && typeof custom_name !== 'string') {
      return res.status(400).json({ error: "Noto'g'ri custom_name" });
    }
    if (group_key && !VALID_GROUP_KEYS.has(group_key)) {
      return res.status(400).json({ error: "Noto'g'ri group_key" });
    }

    const user = updateUserAdmin(id, {
      customName: custom_name,
      groupKey: group_key || null,
      isBanned: Boolean(is_banned),
      excludeFromReport: Boolean(exclude_from_report),
    });
    if (!user) return res.status(404).json({ error: 'User topilmadi' });
    res.json(user);
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
