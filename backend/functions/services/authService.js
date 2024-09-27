const { db } = require('../db');
const crypto = require('crypto');
const uuid = require('uuid');
const axios = require('axios');
require('dotenv').config();

const SESSION_DURATION = 24 * 60 * 60 * 1000;

const logout = async (req) => {
  const sessionToken = req.headers.authorization;
  if (!sessionToken) {
    throw new Error('No session token provided');
  }

  const sessionRef = db.collection('sessions').where('token', '==', sessionToken);
  const sessionSnapshot = await sessionRef.get();

  if (sessionSnapshot.empty) {
    throw new Error('Invalid session token');
  }

  const userId = String(sessionSnapshot.docs[0].data().user_id);

  // Delete all sessions for the user
  const userSessions = await db.collection('sessions').where('user_id', '==', userId).get();
  userSessions.forEach(async (doc) => {
    await db.collection('sessions').doc(doc.id).delete();
  });

  return { success: true, message: 'Logged out from all devices successfully' };
};

const telegramLogin = async (req) => {
  console.log('Telegram login initiated');
  const { id, first_name, last_name, username, hash } = req.body.user;
  const userId = String(id);

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

  const userRef = db.collection('users').doc(String(id));
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    await userRef.set({
      id,
      first_name,
      last_name,
      username,
      platform: 'telegram',
      auth_date: new Date(),
    });
  } else {
    await userRef.update({
      first_name,
      last_name,
      username,
      auth_date: new Date(),
    });
  }

  const sessionToken = uuid.v4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await db.collection('sessions').add({
    session_id: sessionToken,
    user_id: id,
    token: sessionToken,
    expires_at: expiresAt,
    login_date: new Date(Date.now()),
  });

  return { success: true, token: sessionToken, platform: 'telegram' };
};

const discordLogin = async (code, state) => {
  const tokenResponse = await getDiscordToken(code);
  const accessToken = tokenResponse.access_token;

  const discordUser = await getDiscordUserInfo(accessToken);
  const { id, username } = discordUser;
  const { first_name, last_name } = parseDiscordUsername(username);

  const userId = id;
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    await userRef.set({
      id: userId,
      first_name,
      last_name,
      username,
      platform: 'discord',
      auth_date: new Date(),
    });
  } else {
    await userRef.update({
      first_name,
      last_name,
      auth_date: new Date(),
    });
  }

  const sessionToken = uuid.v4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await db.collection('sessions').doc(String(sessionToken)).set({
    session_id: sessionToken,
    user_id: userId,
    token: sessionToken,
    expires_at: expiresAt,
    login_date: new Date(Date.now()),
  });

  return { success: true, token: sessionToken, userId: userId, platform: state || 'discord' };
};

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

function parseDiscordUsername(username) {
  const [first_name, last_name] = username.split(' ');
  return {
    first_name: first_name || '',
    last_name: last_name || '',
  };
}

module.exports = {
  logout,
  telegramLogin,
  discordLogin,
  getDiscordToken,
  getDiscordUserInfo,
};
