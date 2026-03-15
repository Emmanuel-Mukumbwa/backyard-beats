const express = require('express');
const router = express.Router();
const tracksPublic = require('../controllers/tracksPublic.controller');
const admin = require('../controllers/admin');

// Helper to attach route with validation
function attachGet(path, handler, name) {
  if (typeof handler !== 'function') {
    // fail fast so we see a clear message instead of the router TypeError
    throw new TypeError(`Handler for GET ${path} (${name}) is not a function. Check exports in controllers/tracksPublic.controller.js`);
  }
  router.get(path, handler);
}  

// Attach routes (will throw clear error if handler missing)
attachGet('/tracks/recent', tracksPublic.getRecentTracks, 'getRecentTracks');
attachGet('/tracks/new-releases', tracksPublic.getNewReleases, 'getNewReleases');
attachGet('/tracks/most-played', tracksPublic.getMostPlayed, 'getMostPlayed');

// New combined endpoint: /public/tracks
// Supports ?page=1&limit=12&sort=new|most_played&q=...&genre=...&mood=...&artist_id=...&district=...
attachGet('/tracks', tracksPublic.getTracks, 'getTracks');

// public: latest terms (no admin auth)
router.get('/terms', admin.getActiveTerm);
router.get('/privacy', admin.getActivePrivacy);

module.exports = router;