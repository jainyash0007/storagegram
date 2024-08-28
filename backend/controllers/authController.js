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

const discordLogin = async (req, res) => {
  try {
    const result = await authService.discordLogin(req);
    res.json(result);
  } catch (error) {
    console.error('Error with Discord login:', error);
    res.status(500).json({ error: 'Failed Discord login' });
  }
};

module.exports = {
  login,
  logout,
  telegramLogin,
  discordLogin,  // Include Discord login
};
