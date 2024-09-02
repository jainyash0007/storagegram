const { pool } = require('../db');
const telegramBot = require('../telegramBot');
const discordBot = require('../discordBot');
const axios = require('axios');
const uuid = require('uuid');
const JSZip = require('jszip');
const { PassThrough } = require('stream');

const uploadFile = async (req) => {
  const sessionToken = req.headers.authorization;
  const file = req.files.file;
  const folderId = req.body.folderId || null;
  const platform = req.body.platform;

  if (!platform) {
    throw new Error('Invalid platform specified');
  }

  if (!sessionToken) {
    throw new Error('Unauthorized: No session token provided');
  }

  if (!file) {
    throw new Error('No file uploaded');
  }

  const { userId, expiresAt } = await validateSession(sessionToken);

  if (new Date() > new Date(expiresAt)) {
    throw new Error('Session expired');
  }

   if (platform === 'telegram') {
    const fileType = file.mimetype.startsWith('image') ? 'photo' :
      file.mimetype.startsWith('video') ? 'video' : 'document';

    const uploadPromise = uploadToTelegram(fileType, userId, file);
    const message = await uploadPromise;

    const { fileId, fileSize } = extractFileData(fileType, message);
    const fileName = file.name;
    const messageId = message.message_id;

    await saveFileMetadata(fileId, userId, fileName, fileSize, fileType, messageId, folderId);
    await logActivity(fileId, userId, 'Upload', `Uploaded file: ${fileName}`);

    return { success: true, message: 'File uploaded and saved successfully via Telegram' };

  } else if (platform === 'discord') {
    const message = await uploadToDiscord('document', userId, file);
    const fileId = message.attachments.first().id;
    const fileSize = file.size;
    const fileName = file.name;
    const messageId = message.id;
    const fileType = file.mimetype.startsWith('image') ? 'photo' :
      file.mimetype.startsWith('video') ? 'video' : 'document';

    await saveFileMetadata(fileId, userId, fileName, fileSize, fileType, messageId, folderId);
    await logActivity(fileId, userId, 'Upload', `Uploaded file: ${fileName}`);

    return { success: true, message: 'File uploaded and saved successfully via Discord' };
  } else {
    throw new Error('Invalid platform specified');
  }
};

const uploadToTelegram = async (fileType, userId, file) => {
  let uploadPromise;

  if (fileType === 'photo') {
    uploadPromise = telegramBot.sendPhoto(userId, file.data, { caption: file.name });
  } else if (fileType === 'video') {
    uploadPromise = telegramBot.sendVideo(userId, file.data, { caption: file.name });
  } else {
    uploadPromise = telegramBot.sendDocument(userId, file.data, { caption: file.name });
  }

  return uploadPromise;
};

const uploadToDiscord = async (fileType, userId, file) => {
  return discordBot.sendDocument(userId, file); // Simplified, as sendDocument handles the file object correctly
};

const extractFileData = (fileType, message) => {
  let fileId, fileSize;

  if (fileType === 'photo') {
    const largestPhoto = message.photo[message.photo.length - 1]; // Get the largest version of the photo
    fileId = largestPhoto.file_id;
    fileSize = largestPhoto.file_size;
  } else if (fileType === 'video') {
    fileId = message.video.file_id;
    fileSize = message.video.file_size;
  } else {
    fileId = message.document.file_id;
    fileSize = message.document.file_size;
  }

  return { fileId, fileSize };
};

const getFileMetadata = async (fileId, userId) => {
  const result = await pool.query(
    `SELECT f.message_id, u.platform
     FROM files f
     JOIN users u ON f.chat_id = u.id
     WHERE f.file_id = $1 AND f.chat_id = $2`,
    [fileId, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

const saveFileMetadata = async (fileId, userId, fileName, fileSize, fileType, messageId, folderId) => {
  const query = `
    INSERT INTO files (file_id, chat_id, file_name, file_size, file_type, message_id, folder_id, upload_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
  `;

  const values = [fileId, userId, fileName, fileSize, fileType, messageId, folderId];

  try {
    await pool.query(query, values);
  } catch (error) {
    console.error('Error saving file metadata:', error);
    throw new Error('Failed to save file metadata to the database');
  }
};

const logActivity = async (fileId, userId, activityType, details) => {
  try {
    await pool.query(
      'INSERT INTO activity_logs (file_id, user_id, activity_type, details) VALUES ($1, $2, $3, $4)',
      [fileId, userId, activityType, details]
    );
  } catch (error) {
    console.error('Error logging activity:', error);
    throw new Error('Failed to log activity');
  }
};

const downloadFile = async (req) => {
  const sessionToken = req.headers.authorization;
  const { fileId } = req.params;

  if (!sessionToken) {
    throw new Error('Unauthorized');
  }

  const { userId } = await validateSession(sessionToken);

  const fileMetadata = await getFileMetadata(fileId, userId);
  if (!fileMetadata) {
    throw new Error('File not found');
  }

  const { platform, message_id: messageId } = fileMetadata;
  let fileStream;
  let fileName;

  if (platform === 'telegram') {
    fileName = await getFileName(fileId);
    const downloadUrl = await getTelegramFileUrl(fileId);

    fileStream = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
    });

  } else if (platform === 'discord') {
    const { downloadUrl, fileName: discordFileName } = await discordBot.downloadDocument(userId, messageId);
    fileName = discordFileName;

    fileStream = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
    });
  } else {
    throw new Error('Invalid platform specified');
  }

  await logActivity(fileId, userId, 'Download', `Downloaded file: ${fileName}`);

  return fileStream;
};

const downloadFilesAsZip = async (req) => {
  const sessionToken = req.headers.authorization;
  const { fileIds } = req.body;

  if (!sessionToken) {
      throw new Error('Unauthorized');
  }

  const { userId } = await validateSession(sessionToken);

  const zip = new JSZip();

  for (const fileId of fileIds) {
      const fileMetadata = await getFileMetadata(fileId, userId);
      if (!fileMetadata) {
          throw new Error(`File not found: ${fileId}`);
      }

      const { platform, message_id: messageId } = fileMetadata;
      let fileStream;
      let fileName;

      if (platform === 'telegram') {
          fileName = await getFileName(fileId);
          const downloadUrl = await getTelegramFileUrl(fileId);

          const response = await axios({
              url: downloadUrl,
              method: 'GET',
              responseType: 'arraybuffer',
          });
          fileStream = response.data;
      } else if (platform === 'discord') {
          const { downloadUrl, fileName: discordFileName } = await discordBot.downloadDocument(userId, messageId);
          fileName = discordFileName;

          const response = await axios({
              url: downloadUrl,
              method: 'GET',
              responseType: 'arraybuffer',
          });
          fileStream = response.data;
      } else {
          throw new Error('Invalid platform specified');
      }

      zip.file(fileName, fileStream);
  }

  const zipStream = new PassThrough();
  zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
      .pipe(zipStream);

  return zipStream;
};

const deleteFile = async (req) => {
  const sessionToken = req.headers.authorization;
  const { fileId } = req.params;
  const fileIds = req.body.fileIds || [fileId]; // Handle both single and bulk deletion

  if (!sessionToken) {
    throw new Error('Unauthorized');
  }

  const { userId } = await validateSession(sessionToken);

  for (const id of fileIds) {
    const fileMetadata = await getFileMetadata(id, userId);
    if (!fileMetadata) {
      throw new Error(`File with ID ${id} not found`);
    }

    const platform = fileMetadata.platform;

    try {
      if (platform === 'telegram') {
        await deleteFromTelegram(id, userId);
      } else if (platform === 'discord') {
        await deleteFromDiscord(id, userId);
      } else {
        throw new Error('Invalid platform specified');
      }
    } catch (error) {
      if (platform === 'telegram' && error.response && error.response.body && 
          (error.response.body.description.includes('message to delete not found') || 
           error.response.body.description.includes("message can't be deleted for everyone"))) {
        console.warn(`Message for file ID ${id} cannot be deleted on Telegram:`, error.response.body.description);
      } else {
        throw error;  // Rethrow for Discord or other unexpected errors
      }
    }

    // Delete the file metadata and related activity logs from the database
    await deleteFromDatabase(id, userId);
  }

  return { success: true, message: 'File(s) deleted successfully' };
};

const renameFile = async (req) => {
  const sessionToken = req.headers.authorization;
  const { fileId } = req.params;
  const { newFileName } = req.body;

  if (!sessionToken) {
    throw new Error('Unauthorized');
  }

  if (!newFileName) {
    throw new Error('New file name is required');
  }

  const { userId } = await validateSession(sessionToken);
  const fileName = await getFileName(fileId);
  await updateFileName(fileId, userId, newFileName);
  await logActivity(fileId, userId, 'Rename', `Renamed file from ${fileName} to ${newFileName}`);
  return { success: true, message: 'File renamed successfully' };
};

const shareFile = async (req) => {
  const sessionToken = req.headers.authorization;
  const { fileId } = req.params;

  if (!sessionToken) {
    throw new Error('Unauthorized');
  }

  const { userId } = await validateSession(sessionToken);

  const shareLink = await generateShareLink(fileId, userId);
  const hyperLink = `<a href="${shareLink.shareableLink}" target="_blank">link</a>`;
  const logMessage = `Shared file at ${hyperLink}`;

  await logActivity(fileId, userId, 'Share', logMessage);

  return shareLink;
};

const getSharedFile = async (req) => {
  const { token } = req.params;

  const shareLinkResult = await pool.query(
    `SELECT sl.file_id, sl.file_name, sl.expiration_date, u.platform, u.id, f.message_id
     FROM share_links sl
     JOIN files f ON sl.file_id = f.file_id
     JOIN users u ON f.chat_id = u.id
     WHERE sl.token = $1`,
    [token]
  );

  if (shareLinkResult.rows.length === 0) {
    throw new Error('Invalid or expired link');
  }

  const { file_id: fileId, file_name: fileName, expiration_date: expirationDate, platform: platform, id: userId, message_id: messageId } = shareLinkResult.rows[0];
  const currentTime = new Date();

  if (currentTime > new Date(expirationDate)) {
    throw new Error('Link has expired');
  }

  let fileStream;

  if (platform === 'telegram') {
    const file = await telegramBot.getFile(fileId);
    const filePath = file.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;

    fileStream = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
    });

    return { fileStream: fileStream.data, fileName };
  } else if (platform === 'discord') {
    const { downloadUrl } = await discordBot.downloadDocument(userId, messageId);
    return {
      fileStream: axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'stream',
      }),
      fileName,
    };
  } else {
    throw new Error('Invalid platform specified');
  }
};

const getFileName = async (fileId) => {
  const result = await pool.query('SELECT file_name FROM files WHERE file_id = $1', [fileId]);

  if (result.rows.length === 0) {
    throw new Error('File not found');
  }

  return result.rows[0].file_name;
};

const getTelegramFileUrl = async (fileId) => {
  const file = await telegramBot.getFile(fileId);
  const filePath = file.file_path;
  return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
};

const deleteFromTelegram = async (fileId, userId) => {
  // Fetch the message ID and chat ID for the file
  const result = await pool.query('SELECT message_id, chat_id FROM files WHERE file_id = $1 AND chat_id = $2', [fileId, userId]);

  if (result.rows.length === 0) {
    throw new Error('File not found');
  }

  const { message_id: messageId, chat_id: chatId } = result.rows[0];

  try {
    // Attempt to delete the message from Telegram
    await telegramBot.deleteMessage(chatId, messageId);
  } catch (error) {
    if (error.response && error.response.body && error.response.body.description.includes("message can't be deleted for everyone")) {
      console.warn(`Message for file ID ${fileId} cannot be deleted for everyone on Telegram:`, error.response.body.description);
      // Log this as a non-critical issue and proceed with deleting from the database
    } else {
      // If the error is something else, rethrow it to be handled by the calling function
      throw error;
    }
  }
};

const deleteFromDiscord = async (fileId, userId) => {
  const result = await pool.query('SELECT message_id FROM files WHERE file_id = $1 AND chat_id = $2', [fileId, userId]);

  if (result.rows.length === 0) {
    throw new Error('File not found');
  }

  const { message_id: messageId} = result.rows[0];

  try {
    await discordBot.deleteMessage(userId, messageId);
  } catch (error) {
    console.error('Error deleting Discord message:', error);
    throw new Error('Failed to delete message from Discord');
  }
}

const deleteFromDatabase = async (fileId, userId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete activity logs related to the file
    await client.query('DELETE FROM activity_logs WHERE file_id = $1', [fileId]);

    // Delete the file metadata
    await client.query('DELETE FROM files WHERE file_id = $1 AND chat_id = $2', [fileId, userId]);

    await client.query('COMMIT');
    console.log('File and related activity logs deleted successfully from the database');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting file from the database:', error);
    throw new Error('Failed to delete file from the database');
  } finally {
    client.release();
  }
};

const updateFileName = async (fileId, userId, newFileName) => {
  await pool.query(
    'UPDATE files SET file_name = $1, last_modified_date = NOW() WHERE file_id = $2 AND chat_id = $3',
    [newFileName, fileId, userId]
  );
};

const generateShareLink = async (fileId, userId) => {
  const token = uuid.v4();
  const expirationDate = new Date(Date.now() + 30 * 60 * 1000); // Link expires in 30 minutes

  const result = await pool.query(
    'INSERT INTO share_links (file_id, file_name, token, expiration_date) SELECT file_id, file_name, $1, $2 FROM files WHERE file_id = $3 AND chat_id = $4 RETURNING file_name',
    [token, expirationDate, fileId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('File not found');
  }

  const fileName = result.rows[0].file_name;
  return { success: true, shareableLink: `http://localhost:3000/api/files/share/${token}`, expirationDate, fileName };
};

const fetchActivityLogs = async (fileId) => {
  const result = await pool.query(
    'SELECT * FROM activity_logs WHERE file_id = $1 ORDER BY activity_timestamp DESC',
    [fileId]
  );

  return result.rows;
};

const getFileActivity = async (req) => {
  const { fileId } = req.params;
  const sessionToken = req.headers.authorization;

  if (!sessionToken) {
    throw new Error('Unauthorized');
  }

  await validateSession(sessionToken);

  const activityLogs = await fetchActivityLogs(fileId);

  return activityLogs;
};

const validateSession = async (sessionToken) => {
  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [sessionToken]
  );

  if (sessionResult.rows.length === 0) {
    throw new Error('Unauthorized: Invalid session token');
  }

  const { user_id: userId, expires_at: expiresAt } = sessionResult.rows[0];

  if (new Date() > new Date(expiresAt)) {
    throw new Error('Unauthorized: Session expired');
  }

  return { userId, expiresAt };
};

module.exports = {
  uploadFile,
  downloadFile,
  downloadFilesAsZip,
  deleteFile,
  renameFile,
  shareFile,
  getFileActivity,
  getSharedFile,
};
