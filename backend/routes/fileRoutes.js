// routes/fileRoutes.js
const express = require('express');
const fileController = require('../controllers/fileController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/upload', authMiddleware, fileController.uploadFile);
router.get('/download/:fileId', authMiddleware, fileController.downloadFile);
router.delete('/delete/:fileId', authMiddleware, fileController.deleteFile);
router.put('/rename/:fileId', authMiddleware, fileController.renameFile);
router.post('/share/:fileId', authMiddleware, fileController.shareFile);
router.get('/share/:token', fileController.getSharedFile);
router.get('/:fileId/activity', authMiddleware, fileController.getFileActivity);

module.exports = router;
