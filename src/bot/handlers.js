import { upsertUser, getTodayStr, getGroupBySlug, getAllGroups } from '../db/index.js';
import { buildReport } from './scheduler.js';

export function registerHandlers(bot, webappUrl) {
  const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean);

  bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const slug = ctx.startPayload;
    const isSuperAdmin = superAdminIds.includes(id);

    if (!slug) {
      if (isSuperAdmin) {
        const groups = getAllGroups().filter(g => g.is_active);
        if (groups.length === 0) {
          await ctx.reply('Hozircha guruhlar yo\'q. Webapp orqali guruh yarating.', {
            reply_markup: { inline_keyboard: [[{ text: '⚙️ Boshqaruv paneli', web_app: { url: webappUrl } }]] }
          });
        } else {
          const buttons = groups.map(g => ([{ text: `👥 ${g.name}`, web_app: { url: `${webappUrl}?g=${g.slug}` } }]));
          await ctx.reply(`Assalomu Alaykum, ${first_name}! 👋\nQaysi guruhni ochmoqchisiz?`, {
            reply_markup: { inline_keyboard: buttons }
          });
        }
      } else {
        await ctx.reply('Guruh havolasi orqali kiring.');
      }
      return;
    }

    const group = getGroupBySlug(slug);
    if (!group) {
      await ctx.reply('Guruh topilmadi. To\'g\'ri havola orqali kiring.');
      return;
    }

    const user = upsertUser(id, first_name, group.id);
    if (user.is_banned) {
      await ctx.reply('Sizga botdan foydalanish taqiqlangan.');
      return;
    }

    const groupAdminIds = (group.admin_ids || '').split(',').map(Number).filter(Boolean);
    const isAdmin = isSuperAdmin || groupAdminIds.includes(id);
    const appUrl = `${webappUrl}?g=${slug}`;
    const keyboard = [[{ text: '📿 Virdlarni kiritish', web_app: { url: appUrl } }]];
    if (isAdmin) keyboard.push([{ text: '📊 Bugungi hisobot', callback_data: `report:${group.id}` }]);

    await ctx.reply(
      `Assalomu Alaykum, ${first_name} xonim! 👋`,
      { reply_markup: { inline_keyboard: keyboard } }
    );
  });

  bot.action(/^report:(\d+)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    await ctx.answerCbQuery();
    const report = buildReport(getTodayStr(), groupId);
    await ctx.reply(report, { parse_mode: 'Markdown' });
  });
}
