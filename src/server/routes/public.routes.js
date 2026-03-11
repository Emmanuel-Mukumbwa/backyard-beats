// src/server/routes/public.routes.js
const express = require('express');
const router = express.Router();
const tracksPublic = require('../controllers/tracksPublic.controller');

// Debug: show exported members in console once at startup
console.log('public.routes -> tracksPublic exports:', Object.keys(tracksPublic || {}));

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

module.exports = router;