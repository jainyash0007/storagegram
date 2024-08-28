// routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/telegram', authController.telegramLogin);
router.post('/discord', authController.discordLogin);  // Add Discord login route

module.exports = router;
