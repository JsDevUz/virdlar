import { upsertUser, getTodayStr, getGroupBySlug, getAllGroups, getUserGroups } from '../db/index.js';
import { buildReport, getYesterdayStr } from './scheduler.js';

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
        return;
      }

      // Avval qo'shilgan guruhlarini tekshir
      const userGroups = getUserGroups(id);
      if (userGroups.length === 1) {
        // Bitta guruhda bo'lsa — to'g'ridan shu guruhga yo'naltir
        const group = userGroups[0];
        const groupAdminIds = (group.admin_ids || '').split(',').map(Number).filter(Boolean);
        const isAdmin = groupAdminIds.includes(id);
        const appUrl = `${webappUrl}?g=${group.slug}`;
        const keyboard = [[{ text: '📿 Virdlarni kiritish', web_app: { url: appUrl } }]];
        if (isAdmin) keyboard.push([{ text: '📊 Bugungi hisobot', callback_data: `report:${group.id}` }]);
        await ctx.reply(`Assalomu Alaykum, ${first_name}! 👋`, {
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      } else if (userGroups.length > 1) {
        // Bir nechta guruhda bo'lsa — tanlash
        const buttons = userGroups.map(g => ([{ text: `👥 ${g.name}`, web_app: { url: `${webappUrl}?g=${g.slug}` } }]));
        await ctx.reply(`Assalomu Alaykum, ${first_name}! 👋\nQaysi guruhni ochmoqchisiz?`, {
          reply_markup: { inline_keyboard: buttons }
        });
        return;
      }

      await ctx.reply('Guruh havolasi orqali kiring.');
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
      `Assalomu Alaykum, ${first_name}! 👋`,
      { reply_markup: { inline_keyboard: keyboard } }
    );
  });

  bot.command('kecha', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const isPrivate = ctx.chat.type === 'private';
    const isSuperAdmin = superAdminIds.includes(userId);

    // Guruh chatidan yozilsa — faqat o'sha telegram guruh bilan bog'liq loyiha
    // Private chatdan yozilsa — foydalanuvchi admin bo'lgan guruhlar
    let targetGroups;
    if (!isPrivate) {
      targetGroups = getAllGroups().filter(g => {
        if (!g.is_active) return false;
        if (String(g.telegram_group_id) !== String(chatId)) return false;
        const admins = (g.admin_ids || '').split(',').map(Number).filter(Boolean);
        return isSuperAdmin || admins.includes(userId);
      });
    } else {
      targetGroups = getAllGroups().filter(g => {
        if (!g.is_active) return false;
        const admins = (g.admin_ids || '').split(',').map(Number).filter(Boolean);
        return admins.includes(userId);
      });
      if (isSuperAdmin && targetGroups.length === 0) {
        await ctx.reply('Super-admin uchun guruh chatidan /kecha yuboring.');
        return;
      }
    }

    if (targetGroups.length === 0) {
      await ctx.reply('Siz bu guruhning admini emassiz.');
      return;
    }

    const yesterday = getYesterdayStr();

    for (const group of targetGroups) {
      const report = buildReport(yesterday, group.id);
      const adminIds = [
        ...(group.admin_ids || '').split(',').map(Number).filter(Boolean),
        ...superAdminIds,
      ];
      for (const adminId of [...new Set(adminIds)]) {
        try {
          await ctx.telegram.sendMessage(adminId, report, { parse_mode: 'MarkdownV2' });
        } catch { /* silent */ }
      }
      if (group.telegram_group_id) {
        try {
          await ctx.telegram.sendMessage(group.telegram_group_id, report, { parse_mode: 'MarkdownV2' });
        } catch { /* silent */ }
      }
    }
  });

  bot.command('link', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    // Faqat guruh chatlarida ishlaydi
    if (ctx.chat.type === 'private') {
      await ctx.reply('Bu buyruq faqat guruh chatida ishlaydi.');
      return;
    }

    // Admin tekshiruv
    const isSuperAdmin = superAdminIds.includes(userId);
    if (!isSuperAdmin) {
      // Guruh adminmi?
      const groups = getAllGroups().filter(g => g.is_active && String(g.telegram_group_id) === String(chatId));
      const isGroupAdmin = groups.some(g =>
        (g.admin_ids || '').split(',').map(Number).filter(Boolean).includes(userId)
      );
      if (!isGroupAdmin) return; // Jim o'tkazib yuborish
    }

    // Shu chat bilan bog'liq guruhni topish
    const groups = getAllGroups().filter(g => g.is_active && String(g.telegram_group_id) === String(chatId));
    if (groups.length === 0) {
      await ctx.reply('Bu guruh hali sozlanmagan. Admin paneldan Telegram guruh ID ni kiriting.');
      return;
    }

    const botInfo = await ctx.telegram.getMe();
    const group = groups[0];
    const joinUrl = `https://t.me/${botInfo.username}?start=${group.slug}`;

    await ctx.reply(`👥 *${group.name}* ga a'zo bo'lish`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: "✅ A'zo bo'lish", url: joinUrl }]]
      }
    });
  });

  bot.action(/^report:(\d+)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    await ctx.answerCbQuery();
    const report = buildReport(getTodayStr(), groupId);
    await ctx.reply(report, { parse_mode: 'MarkdownV2' });
  });
}
