// telegramBot.js
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// The bot won't listen for messages since we are handling everything via the UI.

module.exports = telegramBot;
