// src/server/routes/artistOnboard.routes.js
const express = require('express'); 
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const controller = require('../controllers/artistOnboard.controller');
const { uploadFields } = require('../middleware/upload');

// Protect all onboarding endpoints
router.use(auth); 

// POST /artist/onboard  -> expects field "photo" (image) in multipart/form-data
// Using uploadFields so we accept field name "photo" (and can accept more fields later)
router.post('/onboard', uploadFields([{ name: 'photo', maxCount: 1 }]), controller.onboard);

// GET /artist/me
router.get('/me', controller.getMyProfile);
 
module.exports = router;
 