import { upsertUser, getTodayStr } from '../db/index.js';
import { buildReport } from './scheduler.js';

export function registerHandlers(bot, webappUrl) {
  const adminIds = (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean);

  bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    upsertUser(id, first_name);
    const isAdmin = adminIds.includes(id);
    const keyboard = [[{ text: '📿 Virdlarni kiritish', web_app: { url: webappUrl } }]];
    if (isAdmin) keyboard.push([{ text: '📊 Bugungi hisobot', callback_data: 'report' }]);
    await ctx.reply(
      `Assalomu Alaykum, ${first_name} xonim! 👋`,
      { reply_markup: { inline_keyboard: keyboard } }
    );
  });

  bot.action('report', async (ctx) => {
    if (!adminIds.includes(ctx.from.id)) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    const report = buildReport(getTodayStr());
    await ctx.reply(report, { parse_mode: 'Markdown' });
  });
}
