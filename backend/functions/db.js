const admin = require('firebase-admin');
const serviceAccount = require('./service_account.json');
require('dotenv').config();

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIRESTORE_URL,
});

const db = admin.firestore();

module.exports = { db };
