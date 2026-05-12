import cron from 'node-cron';
import { getAllUsers, getVirdlarByUserDate, getTodayStr, getVirdlarConfig } from '../db/index.js';
import { TAQSIM_GROUPS } from '../constants.js';

const LRM = '\u200E';

function getReportExcludedTelegramIds() {
  return new Set(
    (process.env.REPORT_EXCLUDED_TELEGRAM_IDS || '')
      .split(',')
      .map(Number)
      .filter(Boolean)
  );
}

export function startScheduler(bot) {
  // 22:50 Toshkent — ogohlantirish
  cron.schedule('50 22 * * *', async () => {
    const users = getAllUsers().filter(user => !user.is_banned);
    for (const user of users) {
      try {
        await bot.telegram.sendMessage(
          user.telegram_id,
          '⏰ Bugungi virdlarni kiritishga ohirgi muhlat tugashiga 1 soat qoldi!'
        );
      } catch { /* user may have blocked bot */ }
    }
  }, { timezone: 'Asia/Tashkent' });

  // 23:55 Toshkent — adminlarga hisobot
  cron.schedule('55 23 * * *', async () => {
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
  const VIRDLAR = getVirdlarConfig();
  const header = `📅 ${d}.${m}.${y}\n\n${VIRDLAR.map(v => v.label).join('\n')}\n\n`;

  const excludedTelegramIds = getReportExcludedTelegramIds();
  const users = getAllUsers().filter(user =>
    !user.is_banned &&
    !user.exclude_from_report &&
    !excludedTelegramIds.has(user.telegram_id)
  );
  const active = [];
  const lazy = [];

  for (const user of users) {
    const rows = getVirdlarByUserDate(user.id, date);
    const doneKeys = new Set(rows.filter(r => r.status === 'done').map(r => r.vird_key));
    const name = user.display_name;
    if (doneKeys.size === 0) {
      lazy.push({ name, groupKey: user.group_key || null });
    } else {
      const emojis = VIRDLAR
        .filter(v => doneKeys.has(v.key))
        .map(v => v.label.split(' ')[0])
        .join(' ');
      active.push({ name, emojis, count: doneKeys.size, groupKey: user.group_key || null });
    }
  }

  let report = header;
  if (active.length) {
    report += renderGroupedActive(active);
  } else {
    report += '_(hech kim kiritmadi)_';
  }
  if (lazy.length) {
    report += `\n\n😴 *G'aflat doskasi:* [${lazy.length}]\n`;
    report += renderGroupedLazy(lazy);
  }
  return report;
}

function getReportGroups(items) {
  const knownGroups = TAQSIM_GROUPS.map(group => ({
    ...group,
    items: items.filter(item => item.groupKey === group.key),
  }));
  const ungrouped = items.filter(item => !TAQSIM_GROUPS.some(group => group.key === item.groupKey));
  if (ungrouped.length) knownGroups.push({ key: null, label: 'Guruhsiz', items: ungrouped });
  return knownGroups.filter(group => group.items.length);
}

function renderGroupedActive(items) {
  return getReportGroups(items)
    .map(group => {
      const rows = group.items
        .map((u, i) => `${LRM}${i + 1}. ${u.name}${LRM} — [${u.count}]\n${u.emojis}`)
        .join('\n\n');
      return `*${group.label}*\n${rows}`;
    })
    .join('\n\n');
}

function renderGroupedLazy(items) {
  return getReportGroups(items)
    .map(group => {
      const rows = group.items.map((u, i) => `${LRM}${i + 1}. ${u.name}${LRM}`).join('\n');
      return `*${group.label}*\n${rows}`;
    })
    .join('\n\n');
}
