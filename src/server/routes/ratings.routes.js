// src/server/routes/ratings.routes.js
const express = require('express');
const router = express.Router();
const ratingsController = require('../controllers/ratings.controller');
const auth = require('../middleware/auth.middleware');

/**
 * Ratings Routes
 * 
 * Supports both:
 *  - GET  /ratings/artist/:id           → Public (fetch artist ratings)
 *  - GET  /artists/:id/ratings          → Alias (frontend convenience)
 *  - POST /ratings/artist/:id           → Auth required (add/update rating)
 *  - POST /artists/:id/ratings          → Alias (frontend convenience)
 */

// Public — get all ratings for an artist
router.get('/artist/:id', ratingsController.getRatingsForArtist);

// Frontend-friendly alias (same behavior)
router.get('/artists/:id/ratings', ratingsController.getRatingsForArtist);

// Protected — submit or update a rating for an artist
router.post('/artist/:id', auth, ratingsController.postRatingForArtist);

// Frontend-friendly alias (same behavior)
router.post('/artists/:id/ratings', auth, ratingsController.postRatingForArtist);

module.exports = router;

