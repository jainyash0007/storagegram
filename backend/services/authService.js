// services/authService.js
const { pool } = require('../db');
const crypto = require('crypto');
const uuid = require('uuid');
const { Client } = require('discord.js'); // Make sure Discord.js is installed

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const discordClient = new Client({ intents: ['Guilds'] });

const login = async (req) => {
  const { username, password } = req.body;

  const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);

  if (result.rows.length === 0) {
    throw new Error('Invalid username or password');
  }

  const user = result.rows[0];
  const sessionToken = uuid.v4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await pool.query(
    'INSERT INTO sessions (session_id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
    [sessionToken, user.id, sessionToken, expiresAt]
  );

  return { success: true, token: sessionToken };
};

const logout = async (req) => {
  const sessionToken = req.headers.authorization;
  if (!sessionToken) {
    throw new Error('No session token provided');
  }  
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [sessionToken]);

  if (sessionResult.rows.length === 0) {
    throw new Error('Invalid session token');
  }

  const userId = sessionResult.rows[0].user_id;

  // Delete all sessions for the user
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);

  return { success: true, message: 'Logged out from all devices successfully' };
};

const telegramLogin = async (req) => {
  const { id, first_name, last_name, username, hash } = req.body.user;

  const dataCheckString = Object.keys(req.body.user)
    .filter(key => key !== 'hash')
    .map(key => `${key}=${req.body.user[key]}`)
    .sort()
    .join('\n');

  const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const computedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (computedHash !== hash) {
    throw new Error('Unauthorized request');
  }

  const userResult = await pool.query(
    `INSERT INTO users (id, first_name, last_name, username, platform, auth_date)
     VALUES ($1, $2, $3, $4, 'telegram', NOW())
     ON CONFLICT (id) DO UPDATE 
     SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, username = EXCLUDED.username, auth_date = NOW()
     RETURNING id`,
    [id, first_name, last_name, username]
  );

  const userId = userResult.rows[0].id;
  const sessionToken = uuid.v4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await pool.query(
    'INSERT INTO sessions (session_id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
    [sessionToken, userId, sessionToken, expiresAt]
  );

  return { success: true, token: sessionToken };
};

const discordLogin = async (req) => {
  const { id, username } = req.body;

  // Authenticate with Discord's OAuth or any existing Discord login method

  const userResult = await pool.query(
    `INSERT INTO users (id, username, platform, auth_date)
     VALUES ($1, $2, 'discord', NOW())
     ON CONFLICT (id) DO UPDATE 
     SET username = EXCLUDED.username, auth_date = NOW()
     RETURNING id`,
    [id, username]
  );

  const userId = userResult.rows[0].id;
  const sessionToken = uuid.v4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await pool.query(
    'INSERT INTO sessions (session_id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
    [sessionToken, userId, sessionToken, expiresAt]
  );

  return { success: true, token: sessionToken };
};

module.exports = {
  login,
  logout,
  telegramLogin,
  discordLogin,  // Include Discord login
};
