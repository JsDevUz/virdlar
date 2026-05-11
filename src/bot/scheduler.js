import cron from 'node-cron';
import { getAllUsers, getVirdlarByUserDate, getTodayStr, getVirdlarConfig } from '../db/index.js';
import { TAQSIM_GROUPS } from '../constants.js';

const LRM = '\u200E';
const REMINDERS = [
  {
    time: '0 5 * * *',
    title: 'Ibn Atoulloh al-Iskandariy',
    source: 'Al-Hikam al-Atoiyya',
    quote: '"Virdning kelishi senga bog\'liq, voridning (ilohiy fayzning) kelishi esa Robbingga bog\'liq. Sen o\'zingga bog\'liq bo\'lgan narsani (virdni) tashlama, shunda Robbing ham O\'ziga xos bo\'lgan narsani (voridni) uzib qo\'ymaydi."',
  },
  {
    time: '0 11 * * *',
    title: 'Imom Navaviy',
    source: 'Al-Azkor',
    quote: '"Kimning tunda yoki kunduzi o\'qiydigan virdi (vazifasi) bo\'lsa-yu, uni biror sabab bilan o\'tkazib yuborsa, keyin uni qazo qilib o\'qib olishi lozim. Zero, kishi o\'zini virdga odatlantirsa, uni o\'tkazib yuborganda malol keladigan bo\'ladi va bu odat xayrli davomiylikka sabab bo\'ladi."',
  },
  {
    time: '0 15 * * *',
    title: 'Yahyo ibn Muoz Ar-Roziy',
    source: "Siyar a'lamun nubala",
    quote: '"Kimning zohirida virdi (vazifasi) bo\'lmasa, uning botinida nuri (ruhiy quvvati) bo\'lmaydi."',
  },
  {
    time: '0 20 * * *',
    title: 'Abu Hafs Haddod',
    source: 'Hilyatul avliyo',
    quote: '"Kim har vaqt o\'z virdini (doimiy amalini) tekshirib turmasa va har lahzada o\'z holatidan xabardor bo\'lmasa, u kishi \'er kishilar\' (komil insonlar) safida emasdir."',
  },
];

function getReportExcludedTelegramIds() {
  return new Set(
    (process.env.REPORT_EXCLUDED_TELEGRAM_IDS || '')
      .split(',')
      .map(Number)
      .filter(Boolean)
  );
}

function getReminderChatIds() {
  const raw = process.env.REMINDER_CHAT_IDS || process.env.ADMIN_IDS || '';
  return raw
    .split(',')
    .map(Number)
    .filter(id => Number.isFinite(id) && id < 0);
}

function buildReminderMessage({ title, source, quote }) {
  return [
    '🌿 *Vird eslatmasi*',
    '',
    `*${title}*`,
    quote,
    '',
    `_Manba: ${source}_`,
  ].join('\n');
}

export function startScheduler(bot) {
  for (const reminder of REMINDERS) {
    cron.schedule(reminder.time, async () => {
      const message = buildReminderMessage(reminder);
      for (const chatId of getReminderChatIds()) {
        try {
          await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch { /* silent */ }
      }
    }, { timezone: 'Asia/Tashkent' });
  }

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
