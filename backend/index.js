// index.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fileRoutes = require('./routes/fileRoutes');
const folderRoutes = require('./routes/folderRoutes');
const authRoutes = require('./routes/authRoutes');
const fileUpload = require('express-fileupload');
require('./sessionCleanup');

// Initialize Express App
const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(fileUpload());

// Use routes
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Storagegram Backend API is running');
});

app.listen(3000, () => {
  console.log('Storagegram Backend is running on port 3000');
});
