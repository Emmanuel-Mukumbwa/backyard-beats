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
// server-side undo for artists
exports.undoArtist = require('./artists.controller').undoArtist;

// Tracks
exports.pendingTracks = require('./tracks.controller').pendingTracks;
exports.approveTrack = require('./tracks.controller').approveTrack;
exports.rejectTrack = require('./tracks.controller').rejectTrack;
exports.undoTrack = require('./tracks.controller').undoTrack;

// Events
exports.pendingEvents = require('./events.controller').pendingEvents;
exports.approveEvent = require('./events.controller').approveEvent;
exports.rejectEvent = require('./events.controller').rejectEvent;
exports.undoEvent = require('./events.controller').undoEvent;

// Ratings
exports.listRatings = require('./ratings.controller').listRatings;
exports.deleteRating = require('./ratings.controller').deleteRating;

// Settings
exports.getSettings = require('./settings.controller').getSettings;
exports.updateSettings = require('./settings.controller').updateSettings;

exports.listGenres = require('./genres.controller').listGenres;
exports.createGenre = require('./genres.controller').createGenre;
exports.updateGenre = require('./genres.controller').updateGenre;
exports.deleteGenre = require('./genres.controller').deleteGenre;

exports.listMoods = require('./moods.controller').listMoods;
exports.createMood = require('./moods.controller').createMood;
exports.updateMood = require('./moods.controller').updateMood;
exports.deleteMood = require('./moods.controller').deleteMood;

exports.listTerms = require('./terms.controller').listTerms;
exports.createTerm = require('./terms.controller').createTerm;
exports.updateTerm = require('./terms.controller').updateTerm;
exports.deleteTerm = require('./terms.controller').deleteTerm;
exports.getActiveTerm = require('./terms.controller').getActiveTerm;

exports.listPrivacy = require('./privacy.controller').listPrivacy;
exports.createPrivacy = require('./privacy.controller').createPrivacy;
exports.updatePrivacy = require('./privacy.controller').updatePrivacy;
exports.deletePrivacy = require('./privacy.controller').deletePrivacy;
exports.getActivePrivacy = require('./privacy.controller').getActivePrivacy;

exports.listArtists = require('./listArtists.controller').listArtists;