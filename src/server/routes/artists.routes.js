// server/routes/artists.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/artists.controller');
const ratingsCtrl = require('../controllers/ratings.controller');

router.get('/', controller.listArtists);
router.get('/:id', controller.getArtistById);

// Ratings sub-route
router.get('/:id/ratings', ratingsCtrl.getRatingsForArtist); 

module.exports = router;
   