const authService = require('../services/authService');

const login = async (req, res) => {
  try {
    const result = await authService.login(req);
    res.json(result);
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
};

const logout = async (req, res) => {
  try {
    const result = await authService.logout(req);
    res.json(result);
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: 'Failed to log out' });
  }
};

const telegramLogin = async (req, res) => {
  try {
    const result = await authService.telegramLogin(req);
    res.json(result);
  } catch (error) {
    console.error('Error with Telegram login:', error);
    res.status(500).json({ error: 'Failed Telegram login' });
  }
};

const initiateDiscordLogin = (req, res) => {
  const discordClientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent('https://storagegram.web.app/auth/discord/callback');
  const scope = encodeURIComponent('identify email');
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  
  res.redirect(discordAuthUrl);
};

const discordCallback = async (req, res) => {
  try {
    console.log('Discord callback initiated');
    const { code } = req.query;
    const state = req.query.state;

    console.log('Authorization code:', code);
    console.log('State:', state);

    const result = await authService.discordLogin(code, state);

    console.log('Discord login successful:', result);
    res.redirect(`https://storagegram.web.app/login?token=${result.token}&platform=${result.platform}`);
} catch (error) {
    console.error('Error handling Discord callback:', error);
    res.status(500).json({ error: 'Failed to handle Discord login' });
}
};

module.exports = {
  login,
  logout,
  telegramLogin,
  initiateDiscordLogin,
  discordCallback,
};
