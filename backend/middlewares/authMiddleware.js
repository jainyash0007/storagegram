// middlewares/authMiddleware.js
const { pool } = require('../db');

const authMiddleware = async (req, res, next) => {
  const sessionToken = req.headers.authorization;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [sessionToken]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    req.userId = result.rows[0].user_id;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = authMiddleware;
