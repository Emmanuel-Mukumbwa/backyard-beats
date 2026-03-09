// src/server/routes/public.routes.js
const express = require('express');
const router = express.Router();
const tracksPublic = require('../controllers/tracksPublic.controller');

// GET /public/tracks/recent
router.get('/tracks/recent', tracksPublic.getRecentTracks);

module.exports = router;