const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

// Rutas de Mensajería y DeepL
router.get('/:chatId', messageController.getMessages);
router.post('/send', messageController.sendMessage);
router.post('/translate', messageController.translateMessage);
router.post('/read', messageController.markAsRead);

module.exports = router;