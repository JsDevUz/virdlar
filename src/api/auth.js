import { createHmac } from 'crypto';

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
    user: userRaw ? JSON.parse(userRaw) : null,
    auth_date: params.get('auth_date'),
  };
}

export function requireAuth(req, res, next) {
  const initData = req.headers['x-init-data'] || req.query.initData;
  if (!validateInitData(initData, process.env.BOT_TOKEN)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const parsed = parseInitData(initData);
  req.telegramUser = parsed.user;
  next();
}

export function requireAdmin(req, res, next) {
  const adminIds = (process.env.ADMIN_IDS || '').split(',').map(Number);
  if (!adminIds.includes(req.telegramUser?.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
