import { upsertUser, getTodayStr, getGroupBySlug } from '../db/index.js';
import { buildReport } from './scheduler.js';

export function registerHandlers(bot, webappUrl) {
  const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean);

  bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const slug = ctx.startPayload;

    if (!slug) {
      await ctx.reply('Guruh havolasi orqali kiring. Masalan: /start maktab-7');
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
    const isAdmin = superAdminIds.includes(id) || groupAdminIds.includes(id);
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
