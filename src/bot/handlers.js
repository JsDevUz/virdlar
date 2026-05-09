import { upsertUser } from '../db/index.js';

export function registerHandlers(bot, webappUrl) {
  bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    upsertUser(id, first_name);
    await ctx.reply(
      `Assalomu Alaykum, ${first_name} xonim! 👋`,
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📿 Virdlarni kiritish',
              web_app: { url: webappUrl }
            }
          ]]
        }
      }
    );
  });
}
