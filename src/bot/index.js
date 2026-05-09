import { Telegraf } from 'telegraf';
import { registerHandlers } from './handlers.js';

export function createBot() {
  const bot = new Telegraf(process.env.BOT_TOKEN || 'placeholder');
  registerHandlers(bot, process.env.WEBAPP_URL || 'https://peshqadam.jamm.uz');
  return bot;
}
