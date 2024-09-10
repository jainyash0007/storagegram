const express = require('express');
const folderController = require('../controllers/folderController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, folderController.createFolder);
router.put('/:folderId', authMiddleware, folderController.renameFolder);
router.delete('/:folderId', authMiddleware, folderController.deleteFolder);
router.get('/:folderId', authMiddleware, folderController.listFoldersAndFiles);
router.get('/', authMiddleware, folderController.listFoldersAndFiles);
router.get('/path/:folderId', authMiddleware, folderController.getFolderPath);

module.exports = router;
