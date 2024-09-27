const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/telegram', authController.telegramLogin);
router.get('/discord', authController.initiateDiscordLogin);
router.get('/discord/callback', authController.discordCallback);

module.exports = router;
