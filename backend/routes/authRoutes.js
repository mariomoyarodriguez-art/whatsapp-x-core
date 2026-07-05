const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Rutas de Usuarios y Autenticación
router.get('/departamentos', authController.getDepartamentos);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/search', authController.searchEmpleado);
router.put('/update-profile', authController.updateProfile);

module.exports = router;