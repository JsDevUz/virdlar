import { createHmac } from 'crypto';
import { getGroupBySlug } from '../db/index.js';

export function validateInitData(initDataRaw, botToken) {
  if (!initDataRaw) return false;
  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) return false;
    params.delete('hash');
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computedHash !== hash) return false;
    const authDate = Number(params.get('auth_date'));
    if (Date.now() / 1000 - authDate > 86400) return false;
    return true;
  } catch {
    return false;
  }
}

export function parseInitData(initDataRaw) {
  const params = new URLSearchParams(initDataRaw);
  const userRaw = params.get('user');
  return {
    user: userRaw ? (() => { try { return JSON.parse(userRaw); } catch { return null; } })() : null,
    auth_date: params.get('auth_date'),
  };
}

export function requireAuth(req, res, next) {
  if (process.env.DEV_USER_ID) {
    req.telegramUser = {
      id: Number(process.env.DEV_USER_ID),
      first_name: process.env.DEV_USER_NAME || 'DevUser',
    };
    const slug = req.headers['x-group-slug'];
    if (slug) {
      const group = getGroupBySlug(slug);
      if (!group) return res.status(404).json({ error: 'Guruh topilmadi' });
      req.groupId = group.id;
      req.group = group;
    }
    return next();
  }

  const initData = req.headers['x-init-data'] || req.query.initData;
  if (!validateInitData(initData, process.env.BOT_TOKEN)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const parsed = parseInitData(initData);
  req.telegramUser = parsed.user;

  const slug = req.headers['x-group-slug'];
  if (slug) {
    const group = getGroupBySlug(slug);
    if (!group) return res.status(404).json({ error: 'Guruh topilmadi' });
    req.groupId = group.id;
    req.group = group;
  }
  next();
}

export function requireAdmin(req, res, next) {
  const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean);
  if (superAdminIds.includes(req.telegramUser?.id)) return next();

  if (!req.group) return res.status(403).json({ error: 'Forbidden' });
  const groupAdminIds = (req.group.admin_ids || '').split(',').map(Number).filter(Boolean);
  if (!groupAdminIds.includes(req.telegramUser?.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean);
  if (!superAdminIds.includes(req.telegramUser?.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
