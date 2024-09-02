const { pool } = require('../db');
const crypto = require('crypto');
const uuid = require('uuid');
const axios = require('axios');

const SESSION_DURATION = 24 * 60 * 60 * 1000;

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
  
    return { success: true, token: sessionToken, platform: 'telegram' };
  };
  
  const discordLogin = async (code, state) => {
    // Step 1: Get Discord Token
    const tokenResponse = await getDiscordToken(code);
    const accessToken = tokenResponse.access_token;
  
    // Step 2: Get User Info from Discord
    const discordUser = await getDiscordUserInfo(accessToken);
  
    const { id, username } = discordUser;
    const { first_name, last_name } = parseDiscordUsername(username);
  
    // Step 3: Insert or Update User in the Database
    const userResult = await pool.query(
      `INSERT INTO users (id, first_name, last_name, username, platform, auth_date)
       VALUES ($1, $2, $3, $4, 'discord', NOW())
       ON CONFLICT (id) DO UPDATE 
       SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, username = EXCLUDED.username, auth_date = NOW()
       RETURNING id`,
      [id, first_name, last_name, username]
    );
  
    const userId = userResult.rows[0].id;
    const sessionToken = uuid.v4();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
  
    // Step 4: Store session token in the sessions table
    await pool.query(
      'INSERT INTO sessions (session_id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [sessionToken, userId, sessionToken, expiresAt]
    );
  
    return { success: true, token: sessionToken, userId: id, platform: state || 'discord'};
  };
  
  function parseDiscordUsername(username) {
    const [first_name, last_name] = username.split(' ');
    return {
      first_name: first_name || '',
      last_name: last_name || '',
    };
  }
  
  const getDiscordToken = async (code) => {
    const response = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
    }));
  
    return response.data;
  };
  
  const getDiscordUserInfo = async (accessToken) => {
    const response = await axios.get('https://discord.com/api/users/@me', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
  
    return {
        id: response.data.id,
        username: response.data.username,
    };
  };
  
  module.exports = {
    logout,
    telegramLogin,
    discordLogin,
    getDiscordToken,
    getDiscordUserInfo,
  };
  
