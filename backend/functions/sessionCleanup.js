const { db } = require('./db');

const cleanExpiredSessions = async () => {
  try {
    const sessionsRef = db.collection('sessions');
    const now = new Date();

    const expiredSessions = await sessionsRef.where('expires_at', '<', now).get();

    expiredSessions.forEach(async (doc) => {
      await sessionsRef.doc(doc.id).delete();
    });

    console.log('Expired sessions cleaned up');
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
};

module.exports = cleanExpiredSessions;
