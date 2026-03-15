// src/server/routes/users.routes.js
const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController.controller');

// auth middleware that populates req.user
const auth = require('../middleware/auth.middleware');

// Auth-required account-self endpoints
router.get('/me', auth, usersController.getMe);
router.delete('/me', auth, usersController.softRemoveMe);
router.post('/me/recover', auth, usersController.recoverMe);
router.post('/me/change-password', auth, usersController.changePasswordMe);

// Public / admin
router.get('/', usersController.list);
router.post('/', usersController.create);

// PUT /:id is protected so only owner or admin can update
router.put('/:id', auth, usersController.update);

// Soft-delete by id (admin or owner) - keep auth
router.delete('/:id', auth, usersController.remove);

module.exports = router;