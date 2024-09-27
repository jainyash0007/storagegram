const busboy = require('busboy');
const { db } = require('../db');
const telegramBot = require('../telegramBot');
const discordBot = require('../discordBot');
const uuid = require('uuid');
const JSZip = require('jszip');
const FormData = require('form-data');
const fetch = require('node-fetch');
require('dotenv').config();

const uploadFile = async (req, res) => {
  console.log('Upload file request received at', new Date().toISOString());
  const bb = busboy({ headers: req.headers });

  let fileData = null;
  let platform = null;
  let folderId = null;

  await new Promise((resolve, reject) => {
    bb.once('close', resolve)
      .once('error', (error) => {
        console.error('Busboy error:', error);
        reject(error);
      })
      .on('field', (fieldname, value) => {
        if (fieldname === 'platform') {
          platform = value;
        }
        if (fieldname === 'folderId') {
          folderId = value;
        }
      })
      .on('file', (name, file_stream, info) => {
        fileData = { stream: file_stream, info };

        const chunks = [];
        file_stream.on('data', (chunk) => {
          chunks.push(chunk);
        }).on('end', () => {
          fileData.buffer = Buffer.concat(chunks);
        });
      })
      .end(req.rawBody); // For GCP Cloud Functions, use req.rawBody
  });

  if (!fileData || !platform) {
    console.error('Invalid platform or file not provided');
    return res.status(400).json({ error: 'Invalid platform or file not provided' });
  }

  // Validate session
  const sessionToken = req.headers.authorization;
  try {
    const { userId } = await validateSession(sessionToken);

    const { buffer, info: fileInfo } = fileData;
    const fileType = fileInfo.mimeType;

    if (platform === 'telegram') {
      const message = await uploadToTelegram(fileType, userId, buffer, fileInfo);
      const { fileId, fileSize } = extractFileData(fileType, message);
      const fileName = fileInfo.filename;
      const messageId = message.message_id;

      await saveFileMetadata(fileId, userId, fileName, fileSize, fileType, messageId, folderId);
      await logActivity(fileId, userId, 'Upload', `Uploaded file: ${fileName}`);

      return { success: true, message: 'File uploaded and saved successfully via Telegram' };
    } else if (platform === 'discord') {
      const file = {
        data: buffer,
        name: fileInfo.filename,
      };
      const message = await uploadToDiscord('document', userId, file);
      const fileId = message.attachments.first().id;
      const fileSize = buffer.length;;
      const fileName = fileInfo.filename;
      const messageId = message.id;

      await saveFileMetadata(fileId, userId, fileName, fileSize, fileType, messageId, folderId);
      await logActivity(fileId, userId, 'Upload', `Uploaded file: ${fileName}`);

      return { success: true, message: 'File uploaded and saved successfully via Discord' };
    }
  } catch (error) {
    console.error('Error during file upload process:', error);
    throw error;
  }
};

const uploadToTelegram = async (fileType, userId, buffer, fileInfo) => {
  const formData = new FormData();
  formData.append('chat_id', userId);

  // Determine the correct method based on file type
  if (fileType.startsWith('image/')) {
    formData.append('photo', buffer, {
      filename: fileInfo.filename,
      contentType: fileType,
    });
    apiMethod = 'sendPhoto';
  } else if (fileType.startsWith('video/')) {
    formData.append('video', buffer, {
      filename: fileInfo.filename,
      contentType: fileType,
    });
    apiMethod = 'sendVideo';
  } else {
    formData.append('document', buffer, {
      filename: fileInfo.filename,
      contentType: fileType,
    });
    apiMethod = 'sendDocument';
  }
  const responseStart = Date.now();
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${apiMethod}`, {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders(),
  });
  console.log(`Telegram upload completed in ${Date.now() - responseStart} ms`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response from Telegram:', errorText);
    throw new Error(`TelegramError: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const message = await response.json();

  if (!message.result) {
    console.error('Unexpected response format:', message);
    throw new Error('Telegram API did not return a result');
  }

  return message.result;
};

const uploadToDiscord = async (fileType, userId, file) => {
  return discordBot.sendDocument(userId, file);
};

const extractFileData = (fileType, message) => {
  let fileId, fileSize;

  if (fileType.startsWith('image/')) {
    const largestPhoto = message.photo[message.photo.length - 1];
    fileId = largestPhoto.file_id;
    fileSize = largestPhoto.file_size;
  } else if (fileType.startsWith('video/')) {
    fileId = message.video.file_id;
    fileSize = message.video.file_size;
  } else {
    fileId = message.document.file_id;
    fileSize = message.document.file_size;
  }

  return { fileId, fileSize };
};

const getFileMetadata = async (fileId, userId) => {
  try {
    const fileSnapshot = await db.collection('files').where('file_id', '==', fileId).where('chat_id', '==', userId).get();

    if (fileSnapshot.empty) {
      console.error(`File with ID ${fileId} not found for user ${userId}`);
      return null;
    }

    const fileData = fileSnapshot.docs[0].data();
    const userSnapshot = await db.collection('users').doc(String(userId)).get();

    if (!userSnapshot.exists) {
      console.error(`User with ID ${userId} not found`);
      return null;
    }

    const platform = userSnapshot.data().platform;
    return { message_id: fileData.message_id, platform, file_name: fileData.file_name };
  } catch (error) {
    console.error('Error fetching file metadata:', error);
    throw new Error('Failed to fetch file metadata');
  }
};

const saveFileMetadata = async (fileId, userId, fileName, fileSize, fileType, messageId, folderId) => {
  try {
    const counterRef = db.collection('counters').doc('file_counter');
    const counterDoc = await counterRef.get();

    if (!counterDoc.exists) {
      throw new Error('File counter not initialized');
    }

    let currentFileId = counterDoc.data().current_file_id;
    const newFileId = currentFileId + 1;

    await db.collection('files').doc(String(newFileId)).set({
      id: newFileId,
      file_id: fileId,
      chat_id: userId,
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
      message_id: messageId,
      folder_id: folderId,
      upload_date: new Date(),
      last_modified_date: new Date(),
    });

    await counterRef.update({ current_file_id: newFileId });

    console.log(`File metadata saved with id: ${newFileId}`);
  } catch (error) {
    console.error('Error saving file metadata:', error);
    throw new Error('Failed to save file metadata to the database');
  }
};

const logActivity = async (fileId, userId, activityType, details) => {
  try {
    const counterRef = db.collection('counters').doc('activity_counter');
    const counterDoc = await counterRef.get();

    if (!counterDoc.exists) {
      throw new Error('Activity counter not initialized');
    }

    let currentActivityId = counterDoc.data().current_activity_id;
    const newActivityId = currentActivityId + 1;

    await db.collection('activity_logs').doc(String(newActivityId)).set({
      activity_id: newActivityId,
      file_id: fileId,
      user_id: userId,
      activity_type: activityType,
      details: details,
      activity_timestamp: new Date(),
    });

    await counterRef.update({ current_activity_id: newActivityId });

    console.log(`Activity logged with id: ${newActivityId}`);
  } catch (error) {
    console.error('Error logging activity:', error);
    throw new Error('Failed to log activity');
  }
};

const downloadFile = async (req, res) => {
  const sessionToken = req.headers.authorization;
  const { fileId } = req.params;

  if (!sessionToken) {
    throw new Error('Unauthorized');
  }

  const { userId } = await validateSession(sessionToken);

  try {
    const fileMetadata = await getFileMetadata(fileId, userId);

    if (!fileMetadata) {
      throw new Error(`File metadata not found for fileId: ${fileId} and userId: ${userId}`);
    }

    const downloadUrl = await getDownloadUrl(fileId, userId);

    const fileStream = await fetch(downloadUrl);
    const buffer = await fileStream.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    const contentLength = fileStream.headers.get('content-length');
    const contentType = fileStream.headers.get('content-type') || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileMetadata.file_name}"`);
    res.setHeader('Content-Length', contentLength);
    res.isBase64Encoded = true;

    res.send(Buffer.from(uint8Array).toString('base64'));

    setImmediate(() => {
      logActivity(fileId, userId, 'Download', `Downloaded file: ${fileMetadata.file_name}`)
        .catch((err) => console.error('Error logging activity:', err));
    });

  } catch (error) {
    console.error(`Error in downloadFile for fileId ${fileId}:`, error);
    throw new Error('Failed to download file');
  }
};

const getDownloadUrl = async (fileId, userId) => {
  const fileMetadata = await getFileMetadata(fileId, userId);
  const { platform, message_id: messageId } = fileMetadata;

  if (platform === 'telegram') {
    return getTelegramFileUrl(fileId);
  } else if (platform === 'discord') {
    const { downloadUrl } = await discordBot.downloadDocument(userId, messageId);
    return downloadUrl;
  } else {
    throw new Error('Invalid platform specified');
  }
};

const downloadFilesAsZip = async (req, res) => {
  const sessionToken = req.headers.authorization;
  const { fileIds } = req.body;

  if (!sessionToken) {
    throw new Error('Unauthorized');
  }

  const { userId } = await validateSession(sessionToken);

  const zip = new JSZip();

  const filePromises = fileIds.map(async (fileId) => {
    const fileMetadata = await getFileMetadata(fileId, userId);

    if (!fileMetadata) {
      throw new Error(`File not found: ${fileId}`);
    }

    const downloadUrl = await getDownloadUrl(fileId, userId);
    const fileStream = await fetch(downloadUrl);
    const fileArrayBuffer = await fileStream.arrayBuffer();

    zip.file(fileMetadata.file_name, fileArrayBuffer);
  });

  await Promise.all(filePromises);

  const zipBase64 = await zip.generateAsync({ type: 'base64' });

  res.setHeader('Content-Disposition', 'attachment; filename="files.zip"');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Encoding', 'base64');

  res.send(zipBase64);
};

const deleteFile = async (req) => {
  const sessionToken = req.headers.authorization;
  const { fileId } = req.params;
  const fileIds = req.body.fileIds || [fileId];

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
      throw error;
    }
    }
    await deleteFromDatabase(id, userId);
  }

  return { success: true, message: 'File(s) deleted successfully' };
};

const deleteFromDatabase = async (fileId, userId) => {
  const batch = db.batch();

  try {
    // Get all activity logs related to the file
    const activityLogsSnapshot = await db.collection('activity_logs').where('file_id', '==', fileId).get();
    
    // Add delete operations for all activity logs related to the file
    activityLogsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Get the file metadata to delete
    const fileSnapshot = await db.collection('files').where('file_id', '==', fileId).where('chat_id', '==', userId).get();

    if (fileSnapshot.empty) {
      throw new Error(`File with ID ${fileId} not found for user ${userId}`);
    }

    // Add delete operation for the file metadata
    batch.delete(fileSnapshot.docs[0].ref);

    // Commit the batch delete
    await batch.commit();

    console.log('File and related activity logs deleted successfully from Firestore');
  } catch (error) {
    console.error('Error deleting file from Firestore:', error);
    throw new Error('Failed to delete file from Firestore');
  }
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

  const fileMetadataSnapshot = await db.collection('files').where('file_id', '==', fileId).where('chat_id', '==', userId).get();
  if (fileMetadataSnapshot.empty) {
    throw new Error(`File with ID ${fileId} not found`);
  }

  const fileMetadata = fileMetadataSnapshot.docs[0].data();
  await db.collection('files').doc(fileMetadataSnapshot.docs[0].id).update({
    file_name: newFileName,
    last_modified_date: new Date(),
  });

  await logActivity(fileId, userId, 'Rename', `Renamed file from ${fileMetadata.file_name} to ${newFileName}`);
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

const generateShareLink = async (fileId, userId) => {
  try {
    const token = uuid.v4();
    const expirationDate = new Date(Date.now() + 30 * 60 * 1000);  // Link expires in 30 minutes

    // Fetch the file metadata for validation
    const fileSnapshot = await db.collection('files').where('file_id', '==', fileId).where('chat_id', '==', userId).get();

    if (fileSnapshot.empty) {
      throw new Error('File not found');
    }

    const fileData = fileSnapshot.docs[0].data();
    const fileName = fileData.file_name;

    // Get the current share_link_id from the counter
    const counterRef = db.collection('counters').doc('share_link_counter');
    const counterDoc = await counterRef.get();

    if (!counterDoc.exists) {
      throw new Error('Share link counter not initialized');
    }

    let currentShareLinkId = counterDoc.data().current_share_link_id;
    const newShareLinkId = currentShareLinkId + 1;

    // Store the share link information in Firestore with the incremented ID
    await db.collection('share_links').doc(String(newShareLinkId)).set({
      id: newShareLinkId,  // Store the incremented share link ID
      file_id: fileId,
      file_name: fileName,
      token: token,
      expiration_date: expirationDate,
      user_id: userId
    });

    // Update the share link counter
    await counterRef.update({ current_share_link_id: newShareLinkId });

    console.log(`Share link created with id: ${newShareLinkId}`);

    // Return the shareable link
    return { 
      success: true, 
      shareableLink: `${process.env.SHARE_API_URL}/${token}?fileName=${encodeURIComponent(fileName)}`, 
      expirationDate, 
      fileName 
    };
  } catch (error) {
    console.error('Error generating share link:', error);
    throw new Error('Failed to generate share link');
  }
};

const getSharedFile = async (req, res) => {
  try {
    const { token } = req.params;

    // Fetch the share link document using the token
    const shareLinkSnapshot = await db.collection('share_links').where('token', '==', token).get();

    if (shareLinkSnapshot.empty) {
      throw new Error('Invalid or expired link');
    }

    const shareLinkData = shareLinkSnapshot.docs[0].data();
    const { file_id: fileId, file_name: fileName, expiration_date: expirationDate } = shareLinkData;
    const currentTime = new Date();

    // Check if the link has expired
    if (currentTime > new Date(expirationDate)) {
      throw new Error('Link has expired');
    }

    // Fetch the file metadata from the 'files' collection
    const fileSnapshot = await db.collection('files').where('file_id', '==', fileId).get();

    if (fileSnapshot.empty) {
      throw new Error('File not found');
    }

    const fileData = fileSnapshot.docs[0].data();
    const messageId = fileData.message_id;
    const userId = fileData.chat_id;

    // Fetch the user metadata from the 'users' collection using userId
    const userSnapshot = await db.collection('users').doc(String(userId)).get();

    if (!userSnapshot.exists) {
      throw new Error('User not found');
    }

    const userData = userSnapshot.data();
    const platform = userData.platform;

    let downloadUrl;

    // Fetch the download URL based on platform (Telegram or Discord)
    if (platform === 'telegram') {
      const file = await telegramBot.getFile(fileId);
      const filePath = file.file_path;
      downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
    } else if (platform === 'discord') {
      const result = await discordBot.downloadDocument(userId, messageId);
      downloadUrl = result.downloadUrl;
    } else {
      throw new Error('Invalid platform specified');
    }

    const fileStream = await fetch(downloadUrl);
    const buffer = await fileStream.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    const contentType = fileStream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = fileStream.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', contentLength);
    res.isBase64Encoded = true;

    res.send(Buffer.from(uint8Array).toString('base64'));
  } catch (error) {
    if (error.message === 'Invalid or expired link' || error.message === 'Link has expired') {
      res.status(404).json({ error: error.message });
    } else {
      console.error('Error retrieving shared file:', error);
      res.status(500).json({ error: 'Failed to retrieve the shared file' });
    }
  }
};

const getTelegramFileUrl = async (fileId) => {
  const file = await telegramBot.getFile(fileId);
  const filePath = file.file_path;
  return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
};

const deleteFromTelegram = async (fileId, userId) => {
  // Fetch the message ID and chat ID for the file from Firestore
  const fileSnapshot = await db.collection('files').where('file_id', '==', fileId).where('chat_id', '==', userId).get();

  if (fileSnapshot.empty) {
    throw new Error('File not found');
  }

  const fileData = fileSnapshot.docs[0].data();
  const { message_id: messageId, chat_id: chatId } = fileData;

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
  try {
    // Fetch the file metadata from Firestore to get the message_id
    const fileSnapshot = await db.collection('files').where('file_id', '==', fileId).where('chat_id', '==', userId).get();

    if (fileSnapshot.empty) {
      throw new Error('File not found');
    }

    // Extract message_id from the file metadata
    const { message_id: messageId } = fileSnapshot.docs[0].data();

    // Attempt to delete the message on Discord
    await discordBot.deleteMessage(userId, messageId);
    console.log(`Message with ID ${messageId} deleted successfully from Discord`);
  } catch (error) {
    console.error('Error deleting Discord message:', error);
    throw new Error('Failed to delete message from Discord');
  }
};

const fetchActivityLogs = async (fileId) => {
  const activityLogsSnapshot = await db.collection('activity_logs')
    .where('file_id', '==', fileId)
    .orderBy('activity_timestamp', 'desc')
    .get();

  if (activityLogsSnapshot.empty) {
    return [];
  }

  const activityLogs = activityLogsSnapshot.docs.map(doc => doc.data());
  return activityLogs;
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
  const sessionSnapshot = await db.collection('sessions').where('token', '==', sessionToken).get();
  if (sessionSnapshot.empty) {
    throw new Error('Unauthorized: Invalid session token');
  }

  const { user_id: userId, expires_at: expiresAt } = sessionSnapshot.docs[0].data();
  if (new Date() > new Date(expiresAt)) {
    throw new Error('Unauthorized: Session expired');
  }

  return { userId: String(userId), expiresAt };
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
