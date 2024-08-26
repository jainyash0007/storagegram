const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const { Client, GatewayIntentBits } = require('discord.js');
const { Pool } = require('pg');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const fileUpload = require('express-fileupload');
const uuid = require('uuid');

// Initialize Express App
const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(fileUpload());

// PostgreSQL Client Setup
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize Telegram Bot
const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

telegramBot.on('update', (update) => {
  console.log('Received update:', update);
});

// Listen for messages
telegramBot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (msg.text === '/start') {
    telegramBot.sendMessage(chatId, 'Welcome to Storagegram! Your bot is now running in polling mode.');
  } else if (msg.text === '/help') {
    telegramBot.sendMessage(chatId, 'Available commands:\n/start - Start the bot\n/help - List available commands\n/upload - Upload a file\n/list_files - List all your files\n/download_file - Download your files, provide a file_id after the command');
  }
});
// Session expiry configuration
const SESSION_DURATION = 24 * 60 * 60 * 1000;  // 24 hours in milliseconds

// Frontend-triggered file upload
app.post('/api/upload', (req, res) => {
  const sessionToken = req.headers.authorization;
  const file = req.files.file;
  const folderId = req.body.folderId || null;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized: No session token provided' });
  }

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Validate session token and check expiry
  pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [sessionToken],
    (sessionError, sessionResult) => {
      if (sessionError || sessionResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid session token' });
      }

      const { user_id: userId, expires_at: expiresAt } = sessionResult.rows[0];

      if (new Date() > new Date(expiresAt)) {
        return res.status(401).json({ error: 'Session expired' });
      }

      const fileType = file.mimetype.startsWith('image') ? 'photo' :
        file.mimetype.startsWith('video') ? 'video' :
          'document';

      let uploadPromise;

      if (fileType === 'photo') {
        uploadPromise = telegramBot.sendPhoto(userId, file.data, { caption: file.name });
      } else if (fileType === 'video') {
        uploadPromise = telegramBot.sendVideo(userId, file.data, { caption: file.name });
      } else {
        uploadPromise = telegramBot.sendDocument(userId, file.data, { caption: file.name });
      }

      uploadPromise
        .then((message) => {
          let fileId, fileSize;

          if (fileType === 'photo') {
            fileId = message.photo[message.photo.length - 1].file_id;
            fileSize = message.photo[message.photo.length - 1].file_size;
          } else if (fileType === 'video') {
            fileId = message.video.file_id;
            fileSize = message.video.file_size;
          } else {
            fileId = message.document.file_id;
            fileSize = message.document.file_size;
          }

          const fileName = file.name;
          const messageId = message.message_id;

        // Insert the file metadata into the database
        pool.query(
          'INSERT INTO files (chat_id, file_id, file_name, file_size, file_type, message_id, folder_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [userId, fileId, fileName, fileSize, fileType, messageId, folderId],
          (error, results) => {
            if (error) {
              console.error('Error inserting file into database:', error);
              return res.status(500).json({ error: 'Failed to save file metadata to the database' });
            }
            // Log activity after successful upload
            pool.query(
              'INSERT INTO activity_logs (file_id, user_id, activity_type, details) VALUES ($1, $2, $3, $4)',
              [fileId, userId, 'upload', `Uploaded file: ${fileName}`],
              (logError) => {
                if (logError) {
                  console.error('Error logging activity:', logError);
                }
              }
            );

            res.json({ success: true, message: 'File uploaded and saved successfully via Telegram' });
          }
        );
      })
      .catch(error => {
        console.error('Error uploading file via Telegram:', error);
        res.status(500).json({ error: 'Failed to upload file via Telegram' });
      });
    }
  );
});

// File list API
app.get('/api/files', (req, res) => {
  const sessionToken = req.headers.authorization;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  pool.query(
    'SELECT user_id FROM sessions WHERE token = $1',
    [sessionToken],
    (error, results) => {
      if (error || results.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const userId = results.rows[0].user_id;

      pool.query('SELECT file_id, file_name, last_modified_date, file_size FROM files WHERE chat_id = $1', [userId], (fileError, fileResults) => {
        if (fileError) {
          console.error('Error retrieving files:', fileError);
          res.status(500).json({ error: 'Internal Server Error' });
        } else {
          res.json(fileResults.rows);
        }
      });
    }
  );
});

// File download API
app.get('/api/download/:fileId', (req, res) => {
  const sessionToken = req.headers.authorization;
  const fileId = req.params.fileId;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  pool.query('SELECT user_id FROM sessions WHERE token = $1', [sessionToken], (error, sessionResult) => {
    if (error || sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    pool.query('SELECT file_name FROM files WHERE file_id = $1', [fileId], (error, results) => {
      if (error || results.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }

      const fileName = results.rows[0].file_name;
      const userId = results.rows[0].user_id;

      telegramBot.getFile(fileId)
        .then(file => {
          const filePath = file.file_path;
          const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;

          axios({
            url: downloadUrl,
            method: 'GET',
            responseType: 'stream',
          }).then(response => {
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
            response.data.pipe(res);

            pool.query(
              'INSERT INTO activity_logs (file_id, user_id, activity_type, details) VALUES ($1, $2, $3, $4)',
              [fileId, userId, 'download', `Downloaded file: ${fileName}`],
              (logError) => {
                if (logError) {
                  console.error('Error logging activity:', logError);
                }
              }
            );
          }).catch(error => {
            console.error('Error fetching the file from Telegram:', error);
            res.status(500).json({ error: 'Failed to download the file from Telegram' });
          });
        })
        .catch(error => {
          console.error('Error retrieving file from Telegram:', error);
          res.status(500).json({ error: 'Failed to retrieve file information from Telegram' });
        });
    });
  });
});

// File delete API
app.delete('/api/files/delete/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const sessionToken = req.headers.authorization;

  // Verify session token and get user ID
  pool.query('SELECT user_id FROM sessions WHERE token = $1', [sessionToken], (sessionError, sessionResult) => {
    if (sessionError || sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = sessionResult.rows[0].user_id;

    // Get the message ID and chat ID for the file
    pool.query('SELECT message_id, chat_id FROM files WHERE file_id = $1 AND chat_id = $2', [fileId, userId], (dbError, dbResult) => {
      if (dbError || dbResult.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }

      const messageId = dbResult.rows[0].message_id;
      const chatId = dbResult.rows[0].chat_id;

      // Delete the message from Telegram
      telegramBot.deleteMessage(chatId, messageId)
        .then(() => {
          // After deleting from Telegram, delete from the database
          pool.query('DELETE FROM files WHERE file_id = $1 AND chat_id = $2', [fileId, userId], (deleteError) => {
            if (deleteError) {
              console.error('Error deleting file from database:', deleteError);
              return res.status(500).json({ error: 'Failed to delete file from the database' });
            }

            // Return success response
            res.json({ success: true, message: 'File deleted successfully' });
          });
        })
        .catch((error) => {
          console.error('Error deleting file from Telegram:', error);
          return res.status(500).json({ error: 'Failed to delete file from Telegram' });
        });
    });
  });
});

// Database query to store generated share links (files, tokens, expiration)
app.post('/api/files/share/:fileId', (req, res) => {
  const { fileId } = req.params;
  const token = uuid.v4();
  const expirationDate = new Date(Date.now() + 30 * 60 * 1000);

  // Retrieve file name
  pool.query('SELECT file_name FROM files WHERE file_id = $1', [fileId], (error, results) => {
    if (error || results.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileName = results.rows[0].file_name;

    // Insert share link with file_name into share_links table
    pool.query(
      'INSERT INTO share_links (file_id, file_name, token, expiration_date) VALUES ($1, $2, $3, $4)',
      [fileId, fileName, token, expirationDate],
      (insertError, insertResults) => {
        if (insertError) {
          console.error('Error creating share link:', insertError);
          return res.status(500).json({ error: 'Failed to create share link' });
        }
        res.json({ success: true, shareableLink: `http://localhost:3000/api/files/share/${token}`, expirationDate, fileName});
      }
    );
  });
});

// Public endpoint to access shared file by token
app.get('/api/files/share/:token', (req, res) => {
  const { token } = req.params;

  // Retrieve the file details using the token
  pool.query('SELECT file_id, file_name, expiration_date FROM share_links WHERE token = $1', [token], (error, results) => {
    if (error || results.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    const expirationDate = new Date(results.rows[0].expiration_date);
    const currentTime = new Date();

    if (currentTime > expirationDate) {
      return res.status(410).json({ error: 'Link has expired' });
    }

    const fileId = results.rows[0].file_id;
    const fileName = results.rows[0].file_name;

    // Fetch the file from Telegram using the file_id
    telegramBot.getFile(fileId)
      .then(file => {
        const filePath = file.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;

        axios({
          url: downloadUrl,
          method: 'GET',
          responseType: 'stream',
        }).then(response => {
          // Set the correct file name in the response header
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
          response.data.pipe(res);
        }).catch(error => {
          console.error('Error fetching the file from Telegram:', error);
          res.status(500).json({ error: 'Failed to download the file from Telegram' });
        });
      })
      .catch(error => {
        console.error('Error retrieving file from Telegram:', error);
        res.status(500).json({ error: 'Failed to retrieve file information from Telegram' });
      });
  });
});

// Create a new folder
app.post('/api/folders', (req, res) => {
  const { folderName, parentFolderId } = req.body;
  const sessionToken = req.headers.authorization;

  pool.query('SELECT user_id FROM sessions WHERE token = $1', [sessionToken], (err, result) => {
    if (err || result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    const userId = result.rows[0].user_id;

    pool.query(
      'INSERT INTO folders (folder_name, parent_folder_id, user_id) VALUES ($1, $2, $3) RETURNING *',
      [folderName, parentFolderId || null, userId],
      (error, folderResult) => {
        if (error) {
          return res.status(500).json({ error: 'Error creating folder' });
        }
        res.json({ success: true, folder: folderResult.rows[0] });
      }
    );
  });
});

// Rename a folder
app.put('/api/folders/:folderId', (req, res) => {
  const { folderName } = req.body;
  const folderId = req.params.folderId;

  pool.query(
    'UPDATE folders SET folder_name = $1, modified_at = NOW() WHERE folder_id = $2 RETURNING *',
    [folderName, folderId],
    (error, result) => {
      if (error || result.rows.length === 0) {
        return res.status(500).json({ error: 'Error renaming folder' });
      }
      res.json({ success: true, folder: result.rows[0] });
    }
  );
});

// Delete a folder
app.delete('/api/folders/:folderId', (req, res) => {
  const folderId = req.params.folderId;

  pool.query('DELETE FROM folders WHERE folder_id = $1 RETURNING *', [folderId], (error, result) => {
    if (error || result.rows.length === 0) {
      return res.status(500).json({ error: 'Error deleting folder' });
    }
    res.json({ success: true, folder: result.rows[0] });
  });
});

// List folders and files within a folder
app.get('/api/folders/:folderId?', (req, res) => {
  const { folderId } = req.params;
  const sessionToken = req.headers.authorization;

  pool.query('SELECT user_id FROM sessions WHERE token = $1', [sessionToken], (err, result) => {
    if (err || result.rows.length === 0) {
      console.error('Session error:', err || 'Session not found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = result.rows[0].user_id;

    const folderQuery = folderId
      ? 'SELECT * FROM folders WHERE user_id = $1 AND parent_folder_id = $2'
      : 'SELECT * FROM folders WHERE user_id = $1 AND parent_folder_id IS NULL';

    const fileQuery = folderId
      ? 'SELECT * FROM files WHERE chat_id = $1 AND folder_id = $2'
      : 'SELECT * FROM files WHERE chat_id = $1 AND folder_id IS NULL';

    pool.query(folderQuery, folderId ? [userId, folderId] : [userId], (folderErr, folderResult) => {
      if (folderErr) {
        return res.status(500).json({ error: 'Failed to fetch folders' });
      }

      const folders = folderResult.rows.length ? folderResult.rows : [];

      pool.query(fileQuery, folderId ? [userId, folderId] : [userId], (fileErr, fileResult) => {
        if (fileErr) {
          console.error('File query error:', fileErr);
          return res.status(500).json({ error: 'Failed to fetch files' });
        }

        const files = fileResult.rows.length ? fileResult.rows : [];

        res.json({
          folders: folders,
          files: files,
        });
      });
    });
  });
});

app.get('/api/folders/path/:folderId', (req, res) => {
  const { folderId } = req.params;
  const sessionToken = req.headers.authorization;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  pool.query('SELECT user_id FROM sessions WHERE token = $1', [sessionToken], (err, result) => {
    if (err || result.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = result.rows[0].user_id;

    const getFolderPath = (folderId, path = []) => {
      if (!folderId) {
        return Promise.resolve(path.reverse());
      }

      return pool.query('SELECT folder_id, folder_name, parent_folder_id FROM folders WHERE folder_id = $1 AND user_id = $2', [folderId, userId])
        .then(result => {
          if (result.rows.length === 0) {
            throw new Error('Folder not found');
          }

          const folder = result.rows[0];
          path.push({ folderId: folder.folder_id, folderName: folder.folder_name });

          return getFolderPath(folder.parent_folder_id, path);
        });
    };

    getFolderPath(folderId)
      .then(path => {
        res.json({ path });
      })
      .catch(error => {
        console.error('Error fetching folder path:', error);
        res.status(500).json({ error: 'Failed to fetch folder path' });
      });
  });
});

app.post('/api/auth/telegram', (req, res) => {
  const { id, first_name, last_name, username, hash } = req.body.user;

  const dataCheckString = Object.keys(req.body.user)
    .filter(key => key !== 'hash')
    .map(key => `${key}=${req.body.user[key]}`)
    .sort()
    .join('\n');

  const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const computedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (computedHash !== hash) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }

  pool.query(
    `INSERT INTO users (id, first_name, last_name, username, platform, auth_date)
     VALUES ($1, $2, $3, $4, 'telegram', NOW())
     ON CONFLICT (id) DO UPDATE 
     SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, username = EXCLUDED.username, auth_date = NOW()`,
    [id, first_name, last_name, username],
    (error) => {
      if (error) {
        console.error('Error inserting user into database:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      const sessionToken = uuid.v4();
      const expiresAt = new Date(Date.now() + SESSION_DURATION);

      pool.query(
        'INSERT INTO sessions (session_id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
        [sessionToken, id, sessionToken, expiresAt],
        (sessionError) => {
          if (sessionError) {
            console.error('Error creating session:', sessionError);
            return res.status(500).json({ error: 'Internal Server Error' });
          }

          res.json({ success: true, message: 'User authenticated', token: sessionToken });
        }
      );
    }
  );
});

// File rename API
app.put('/api/files/rename/:fileId', (req, res) => {
  const { fileId } = req.params;
  const { newFileName } = req.body;
  const sessionToken = req.headers.authorization;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate input
  if (!newFileName) {
    return res.status(400).json({ error: 'New file name is required' });
  }

  // Validate session token and retrieve user ID
  pool.query('SELECT user_id FROM sessions WHERE token = $1', [sessionToken], (sessionError, sessionResult) => {
    if (sessionError || sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    const userId = sessionResult.rows[0].user_id;

    // Check if the file belongs to the authenticated user
    pool.query('SELECT * FROM files WHERE file_id = $1 AND chat_id = $2', [fileId, userId], (fileError, fileResult) => {
      if (fileError || fileResult.rows.length === 0) {
        return res.status(404).json({ error: 'File not found or not owned by user' });
      }

      // Update the file name in the database
      pool.query('UPDATE files SET file_name = $1, last_modified_date = NOW() WHERE file_id = $2 AND chat_id = $3', [newFileName, fileId, userId], (updateError) => {
        if (updateError) {
          console.error('Error renaming file:', updateError);
          return res.status(500).json({ error: 'Failed to rename file' });
        }

        res.json({ success: true, message: 'File renamed successfully' });
      });
    });
  });
});

app.get('/api/files/:fileId/activity', (req, res) => {
  const { fileId } = req.params;
  const sessionToken = req.headers.authorization;

  // Validate session token and get user ID
  pool.query('SELECT user_id FROM sessions WHERE token = $1', [sessionToken], (sessionError, sessionResult) => {
    if (sessionError || sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = sessionResult.rows[0].user_id;

    // Fetch the activity logs for the specified file
    pool.query('SELECT * FROM activity_logs WHERE file_id = $1 ORDER BY activity_timestamp DESC', [fileId], (error, result) => {
      if (error) {
        console.error('Error fetching activity logs:', error);
        return res.status(500).json({ error: 'Failed to retrieve activity logs' });
      }

      res.json(result.rows);
    });
  });
});

// Logout API
app.post('/api/logout', (req, res) => {
  const sessionToken = req.headers.authorization;

  if (!sessionToken) {
    return res.status(400).json({ error: 'No session token provided' });
  }

  pool.query('SELECT user_id FROM sessions WHERE token = $1', [sessionToken], (sessionError, sessionResult) => {
    if (sessionError || sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    const userId = sessionResult.rows[0].user_id;

    // Delete all sessions for the user
    pool.query('DELETE FROM sessions WHERE user_id = $1', [userId], (deleteError, deleteResult) => {
      if (deleteError) {
        console.error('Error during session logout:', deleteError);
        return res.status(500).json({ error: 'Failed to log out' });
      }

      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ error: 'No active sessions found for this user' });
      }

      res.json({ success: true, message: 'Logged out from all devices successfully' });
    });
  });
});

// Schedule periodic session cleanup
const cron = require('node-cron');
cron.schedule('0 * * * *', () => {
  pool.query('DELETE FROM sessions WHERE expires_at < NOW()', (error) => {
    if (error) {
      console.error('Error cleaning up expired sessions:', error);
    } else {
      console.log('Expired sessions cleaned up');
    }
  });
});

// Initialize Discord Bot
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });
discordClient.login(process.env.DISCORD_BOT_TOKEN);

discordClient.once('ready', () => {
  console.log(`Logged in as ${discordClient.user.tag}!`);
});

app.get('/', (req, res) => {
  res.send('Storagegram Backend API is running');
});

app.listen(3000, () => {
  console.log('Storagegram Backend is running on port 3000');
});
