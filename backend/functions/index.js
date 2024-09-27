const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fileRoutes = require('./routes/fileRoutes');
const folderRoutes = require('./routes/folderRoutes');
const authRoutes = require('./routes/authRoutes');
const cleanExpiredSessions = require('./sessionCleanup');
const functions = require('firebase-functions');

// CORS Options
const corsOptions = {
  origin: 'https://storagegram.web.app',  // Your frontend Firebase domain
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
};

// Initialize Express App
const app = express();
app.use(cors(corsOptions));    // CORS Middleware
app.use(express.raw({ type: 'multipart/form-data', limit: '50mb' }));
app.use(bodyParser.json());    // Body Parser Middleware

// Middleware to clean expired sessions
app.use(async (req, res, next) => {
  await cleanExpiredSessions();
  next();
});

// Use routes
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/auth', authRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Storagegram Backend API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Export the Express app wrapped in Firebase function
exports.app = functions.https.onRequest(app);
