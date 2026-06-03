import { Router } from 'express';
import { getAllUsers, getVirdlarForAdmin, updateUserAdmin, getVirdlarConfig, addVird, updateVird, moveVird } from '../../db/index.js';

export function buildAdminRouter() {
  const router = Router();

  router.get('/users', (req, res) => {
    res.json(getAllUsers(req.groupId));
  });

  router.patch('/users/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Noto'g'ri user id" });
    }
    const { custom_name, is_banned, exclude_from_report } = req.body;
    if (custom_name != null && typeof custom_name !== 'string') {
      return res.status(400).json({ error: "Noto'g'ri custom_name" });
    }
    const user = updateUserAdmin(id, req.groupId, {
      customName: custom_name,
      isBanned: Boolean(is_banned),
      excludeFromReport: Boolean(exclude_from_report),
    });
    if (!user) return res.status(404).json({ error: 'User topilmadi' });
    res.json(user);
  });

  router.get('/virdlar', (req, res) => {
    const { user_id, date, month, year } = req.query;
    const rows = getVirdlarForAdmin(req.groupId, {
      userId: user_id ? Number(user_id) : null,
      date: date || null,
      month: month ? Number(month) : null,
      year: year ? Number(year) : null,
    });
    res.json(rows);
  });

  router.get('/virdlar-config', (req, res) => {
    res.json(getVirdlarConfig(req.groupId, { includeInactive: true }));
  });

  router.post('/virdlar-config', (req, res) => {
    const { label } = req.body;
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: "Label kerak" });
    }
    res.json(addVird(req.groupId, { label: label.trim() }));
  });

  router.patch('/virdlar-config/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Noto'g'ri id" });
    }
    const { label, is_active } = req.body;
    const updated = updateVird(id, req.groupId, {
      label: label !== undefined ? String(label).trim() : undefined,
      isActive: is_active !== undefined ? Boolean(is_active) : undefined,
    });
    if (!updated) return res.status(404).json({ error: 'Topilmadi' });
    res.json(updated);
  });

  router.post('/virdlar-config/:id/move', (req, res) => {
    const id = Number(req.params.id);
    const { direction } = req.body;
    if (!['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: "direction = up|down" });
    }
    const updated = moveVird(id, req.groupId, direction);
    if (!updated) return res.status(404).json({ error: 'Topilmadi' });
    res.json(updated);
  });

  return router;
}
