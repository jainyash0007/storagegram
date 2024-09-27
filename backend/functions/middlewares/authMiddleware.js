const { db } = require('../db');

const authMiddleware = async (req, res, next) => {
  const sessionToken = req.headers.authorization;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sessionRef = db.collection('sessions').where('token', '==', sessionToken);
    const sessionSnapshot = await sessionRef.get();

    if (sessionSnapshot.empty) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    const sessionData = sessionSnapshot.docs[0].data();
    req.userId = sessionData.user_id;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = authMiddleware;
