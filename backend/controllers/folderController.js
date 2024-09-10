const folderService = require('../services/folderService');

const createFolder = async (req, res) => {
  try {
    const result = await folderService.createFolder(req);
    res.json(result);
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
};

const renameFolder = async (req, res) => {
  try {
    const result = await folderService.renameFolder(req);
    res.json(result);
  } catch (error) {
    console.error('Error renaming folder:', error);
    res.status(500).json({ error: 'Failed to rename folder' });
  }
};

const deleteFolder = async (req, res) => {
  try {
    const result = await folderService.deleteFolder(req);
    res.json(result);
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
};

const listFoldersAndFiles = async (req, res) => {
  try {
    const folderId = req.params.folderId || null;
    const result = await folderService.listFoldersAndFiles(req, folderId);
    res.json(result);
  } catch (error) {
    console.error('Error listing folders and files:', error);
    res.status(500).json({ error: 'Failed to list folders and files' });
  }
};

const getFolderPath = async (req, res) => {
  try {
    const result = await folderService.getFolderPath(req);
    res.json(result);
  } catch (error) {
    console.error('Error fetching folder path:', error);
    res.status(500).json({ error: 'Failed to fetch folder path' });
  }
};

module.exports = {
  createFolder,
  renameFolder,
  deleteFolder,
  listFoldersAndFiles,
  getFolderPath,
};
