import { Router } from 'express';
import { getAllGroups, createGroup, updateGroup, seedGroupVirdlarConfig, getAllUsers } from '../../db/index.js';

export function buildGroupsRouter() {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(getAllGroups());
  });

  router.post('/', (req, res) => {
    const { slug, name, admin_ids } = req.body;
    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug.trim())) {
      return res.status(400).json({ error: "slug kerak (faqat a-z, 0-9, -)" });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: "name kerak" });
    }
    try {
      const group = createGroup({ slug: slug.trim(), name: name.trim(), adminIds: admin_ids || '' });
      seedGroupVirdlarConfig(group.id);
      res.status(201).json(group);
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Bu slug band' });
      throw e;
    }
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Noto'g'ri id" });
    }
    const { name, admin_ids, is_active } = req.body;
    const updated = updateGroup(id, {
      name: name !== undefined ? String(name).trim() : undefined,
      adminIds: admin_ids !== undefined ? String(admin_ids) : undefined,
      isActive: is_active !== undefined ? Boolean(is_active) : undefined,
    });
    if (!updated) return res.status(404).json({ error: 'Guruh topilmadi' });
    res.json(updated);
  });

  return router;
}
