const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

module.exports = telegramBot;