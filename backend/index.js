const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fileRoutes = require('./routes/fileRoutes');
const folderRoutes = require('./routes/folderRoutes');
const authRoutes = require('./routes/authRoutes');
const fileUpload = require('express-fileupload');
const awsServerlessExpress = require('aws-serverless-express');
require('./sessionCleanup');

// CORS Options
const corsOptions = {
  origin: 'https://storagegram.web.app',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};

// Initialize Express App
const app = express();
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(fileUpload());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Use routes
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/auth', authRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Storagegram Backend API is running');
});

// Create the server
const server = awsServerlessExpress.createServer(app);

// Lambda handler function
exports.handler = (event, context) => {
  awsServerlessExpress.proxy(server, event, {
    ...context,
    succeed: (response) => {
      if (response.body && response.isBase64Encoded) {
        response.body = Buffer.from(response.body, 'base64').toString('base64'); // Ensure the response body is base64
      }
      context.succeed(response);
    }
  });
};