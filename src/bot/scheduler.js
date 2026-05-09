import cron from 'node-cron';
import { getAllUsers, getVirdlarByUserDate, getTodayStr } from '../db/index.js';
import { VIRDLAR } from '../constants.js';

const LRM = '\u200E';

export function startScheduler(bot) {
  // 22:00 Toshkent — ogohlantirish
  cron.schedule('0 22 * * *', async () => {
    const users = getAllUsers();
    for (const user of users) {
      try {
        await bot.telegram.sendMessage(
          user.telegram_id,
          '⏰ Bugungi virdlarni kiritishga ohirgi muhlat tugashiga 1 soat qoldi!'
        );
      } catch { /* user may have blocked bot */ }
    }
  }, { timezone: 'Asia/Tashkent' });

  // 23:10 Toshkent — adminlarga hisobot
  cron.schedule('10 23 * * *', async () => {
    const adminIds = (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean);
    const today = getTodayStr();
    const report = buildReport(today);
    for (const adminId of adminIds) {
      try {
        await bot.telegram.sendMessage(adminId, report, { parse_mode: 'Markdown' });
      } catch { /* silent */ }
    }
  }, { timezone: 'Asia/Tashkent' });
}

export function buildReport(date) {
  const [y, m, d] = date.split('-');
  const header = `📅 ${d}.${m}.${y}\n\n${VIRDLAR.map(v => v.label).join('\n')}\n\n`;

  const users = getAllUsers();
  const active = [];
  const lazy = [];

  for (const user of users) {
    const rows = getVirdlarByUserDate(user.id, date);
    const doneKeys = new Set(rows.filter(r => r.status === 'done').map(r => r.vird_key));
    const name = user.first_name;
    if (doneKeys.size === 0) {
      lazy.push(`${LRM} ${name}${LRM}`);
    } else {
      const emojis = VIRDLAR
        .filter(v => doneKeys.has(v.key))
        .map(v => v.label.split(' ')[0])
        .join(' • ');
      active.push(`${LRM}👤 ${name}${LRM} — ${emojis}`);
    }
  }

  let report = header;
  report += active.length ? active.join('\n') : '_(hech kim kiritmadi)_';
  if (lazy.length) {
    report += `\n\n😴 *G'aflat doskasi:*\n${lazy.join('\n')}`;
  }
  return report;
}
