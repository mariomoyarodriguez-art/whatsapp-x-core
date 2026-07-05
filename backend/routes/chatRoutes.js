const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Rutas de Agenda y Contactos
router.post('/contact/add', chatController.addContact);
router.get('/contacts/:tel', chatController.getContacts);
router.delete('/contact/remove', chatController.deleteContact);

// Rutas de Gestión de Chats
router.get('/:num_Tel', chatController.getChats);
router.post('/start', chatController.startChat);
router.delete('/:chatId', chatController.deleteChat);

// Rutas de Gestión de Grupos
router.post('/group/create', chatController.createGroup);
router.put('/group/profile', chatController.updateGroupProfile);
router.get('/group/:groupId/members', chatController.getGroupMembers);
router.post('/group/:groupId/members', chatController.addGroupMember);
router.delete('/group/:groupId/members/:memberTel', chatController.removeGroupMember);

module.exports = router;