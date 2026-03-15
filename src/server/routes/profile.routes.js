// src/server/routes/profile.routes.js
const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth.middleware');
const profileController = require('../controllers/profile.controller');

// GET /profile/me
router.get('/me', auth, profileController.getMyProfile);

module.exports = router;  