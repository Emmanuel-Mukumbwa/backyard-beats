//src/server/routes/favorites.routes.js
const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth.middleware');
const controller = require('../controllers/favorites.controller');

router.use(auth); // all endpoints require auth

// GET /favorites        -> list favorites for the logged-in user
router.get('/', controller.getUserFavorites);

// POST /favorites       -> body: { artist_id }
router.post('/', controller.addFavorite);

// DELETE /favorites/:artistId -> unfollow
router.delete('/:artistId', controller.removeFavorite);

// Optionally: GET /favorites/check/:artistId to check if current user follows an artist
router.get('/check/:artistId', controller.checkFavorite);

module.exports = router;
