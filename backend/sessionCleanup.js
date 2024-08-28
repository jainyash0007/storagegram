const { pool } = require('./db');
const cron = require('node-cron');

const cleanExpiredSessions = () => {
  pool.query('DELETE FROM sessions WHERE expires_at < NOW()', (error) => {
    if (error) {
      console.error('Error cleaning up expired sessions:', error);
    } else {
      console.log('Expired sessions cleaned up');
    }
  });
};

// Schedule periodic session cleanup (runs every hour)
cron.schedule('0 * * * *', cleanExpiredSessions);
