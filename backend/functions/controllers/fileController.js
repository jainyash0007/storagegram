const fileService = require('../services/fileService');

const uploadFile = async (req, res) => {
  try {
    const result = await fileService.uploadFile(req);
    res.json(result);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

const downloadFile = async (req, res) => {
  try {
    const result = await fileService.downloadFile(req, res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
};

const downloadFilesAsZip = async (req, res) => {
  try {
      await fileService.downloadFilesAsZip(req, res);
  } catch (error) {
      console.error('Error downloading files:', error);
      res.status(500).json({ error: 'Failed to download files' });
  }
};

const deleteFile = async (req, res) => {
  try {
    const result = await fileService.deleteFile(req);
    res.json(result);
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

const renameFile = async (req, res) => {
  try {
    const result = await fileService.renameFile(req);
    res.json(result);
  } catch (error) {
    console.error('Error renaming file:', error);
    res.status(500).json({ error: 'Failed to rename file' });
  }
};

const shareFile = async (req, res) => {
  try {
    const result = await fileService.shareFile(req);
    res.json(result);
  } catch (error) {
    console.error('Error sharing file:', error);
    res.status(500).json({ error: 'Failed to share file' });
  }
};

const getSharedFile = async (req, res) => {
  try {
    await fileService.getSharedFile(req, res);
  } catch (error) {
    if (error.message === 'Invalid or expired link' || error.message === 'Link has expired') {
      res.status(404).json({ error: error.message });
    } else {
      console.error('Error retrieving shared file:', error);
      res.status(500).json({ error: 'Failed to retrieve the file' });
    }
  }
};

const getFileActivity = async (req, res) => {
  try {
    const result = await fileService.getFileActivity(req);
    res.json(result);
  } catch (error) {
    console.error('Error fetching file activity:', error);
    res.status(500).json({ error: 'Failed to fetch file activity' });
  }
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
