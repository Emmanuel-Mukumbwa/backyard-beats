// src/server/routes/tracks.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const controller = require('../controllers/tracks.controller');
const { uploadFields } = require('../middleware/upload');

// Protect all routes
router.use(auth);

// allow both the audio file and optional artwork in one request
// fields: 'file' (audio) and 'artwork' (image)
const fields = uploadFields([{ name: 'file', maxCount: 1 }, { name: 'artwork', maxCount: 1 }]);

router.get('/', controller.listTracks);           // returns tracks for the logged-in artist
router.post('/', fields, controller.createTrack);
router.put('/:id', fields, controller.updateTrack);
router.delete('/:id', controller.deleteTrack);

module.exports = router;
