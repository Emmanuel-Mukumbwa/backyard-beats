// src/server/routes/fan.playlists.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const controller = require('../controllers/playlists.controller');

router.use(auth);

// GET /fan/playlists
router.get('/', controller.getUserPlaylists);

// POST /fan/playlists
router.post('/', controller.createPlaylist);
 
// GET /fan/playlists/:id
router.get('/:id', controller.getPlaylist);

// PUT /fan/playlists/:id
router.put('/:id', controller.updatePlaylist);

// DELETE /fan/playlists/:id
router.delete('/:id', controller.deletePlaylist);

// POST /fan/playlists/:id/tracks
router.post('/:id/tracks', controller.addTrackToPlaylist);

// DELETE /fan/playlists/:id/tracks/:trackId
router.delete('/:id/tracks/:trackId', controller.removeTrackFromPlaylist);

// PUT /fan/playlists/:id/reorder
router.put('/:id/reorder', controller.reorderPlaylistTracks);

module.exports = router;