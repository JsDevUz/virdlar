import cron from 'node-cron';
import { getAllUsers, getAllGroups, getVirdlarByUserDate, getTodayStr, getVirdlarConfig } from '../db/index.js';

const LRM = '‎';

export function startScheduler(bot) {
  cron.schedule('50 22 * * *', async () => {
    const groups = getAllGroups().filter(g => g.is_active);
    for (const group of groups) {
      const users = getAllUsers(group.id).filter(u => !u.is_banned);
      for (const user of users) {
        try {
          await bot.telegram.sendMessage(
            user.telegram_id,
            '⏰ Bugungi virdlarni kiritishga ohirgi muhlat tugashiga 1 soat qoldi!'
          );
        } catch { /* user may have blocked bot */ }
      }
    }
  }, { timezone: 'Asia/Tashkent' });

  cron.schedule('55 23 * * *', async () => {
    const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean);
    const today = getTodayStr();
    const groups = getAllGroups().filter(g => g.is_active);

    for (const group of groups) {
      const report = buildReport(today, group.id);
      const adminIds = [
        ...(group.admin_ids || '').split(',').map(Number).filter(Boolean),
        ...superAdminIds,
      ];
      for (const adminId of [...new Set(adminIds)]) {
        try {
          await bot.telegram.sendMessage(adminId, report, { parse_mode: 'Markdown' });
        } catch { /* silent */ }
      }
    }
  }, { timezone: 'Asia/Tashkent' });
}

export function buildReport(date, groupId) {
  const [y, m, d] = date.split('-');
  const VIRDLAR = getVirdlarConfig(groupId);
  const header = `📅 ${d}.${m}.${y}\n\n${VIRDLAR.map(v => v.label).join('\n')}\n\n`;

  const users = getAllUsers(groupId).filter(u => !u.is_banned && !u.exclude_from_report);
  const active = [];
  const lazy = [];

  for (const user of users) {
    const rows = getVirdlarByUserDate(user.id, date);
    const doneKeys = new Set(rows.filter(r => r.status === 'done').map(r => r.vird_key));
    const name = user.display_name;
    if (doneKeys.size === 0) {
      lazy.push({ name });
    } else {
      const emojis = VIRDLAR
        .filter(v => doneKeys.has(v.key))
        .map(v => v.label.split(' ')[0])
        .join(' ');
      active.push({ name, emojis, count: doneKeys.size });
    }
  }

  let report = header;
  if (active.length) {
    const rows = active.map((u, i) => `${LRM}${i + 1}. ${u.name}${LRM} — [${u.count}]\n${u.emojis}`).join('\n\n');
    report += rows;
  } else {
    report += '_(hech kim kiritmadi)_';
  }
  if (lazy.length) {
    report += `\n\n😴 *G'aflat doskasi:* [${lazy.length}]\n`;
    report += lazy.map((u, i) => `${LRM}${i + 1}. ${u.name}${LRM}`).join('\n');
  }
  return report;
}
