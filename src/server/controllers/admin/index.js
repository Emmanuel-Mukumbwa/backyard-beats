// src/server/controllers/admin/index.js
// Barrel file — re-export the granular controllers for routes to import as `require('../controllers/admin')`

exports.getAnalytics = require('./analytics.controller').getAnalytics;

// Users
exports.listUsers = require('./users.controller').listUsers;
exports.updateUser = require('./users.controller').updateUser;
exports.banUser = require('./users.controller').banUser;
exports.softDeleteUser = require('./users.controller').softDeleteUser;
exports.restoreUser = require('./users.controller').restoreUser;

// Artists (approvals)
exports.pendingArtists = require('./artists.controller').pendingArtists;
exports.approveArtist = require('./artists.controller').approveArtist;
exports.rejectArtist = require('./artists.controller').rejectArtist;

// Tracks
exports.pendingTracks = require('./tracks.controller').pendingTracks;
exports.approveTrack = require('./tracks.controller').approveTrack;
exports.rejectTrack = require('./tracks.controller').rejectTrack;

// Events
exports.pendingEvents = require('./events.controller').pendingEvents;
exports.approveEvent = require('./events.controller').approveEvent;
exports.rejectEvent = require('./events.controller').rejectEvent;

// Ratings
exports.listRatings = require('./ratings.controller').listRatings;
exports.deleteRating = require('./ratings.controller').deleteRating;

// Settings
exports.getSettings = require('./settings.controller').getSettings;
exports.updateSettings = require('./settings.controller').updateSettings;