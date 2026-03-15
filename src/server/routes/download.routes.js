//src/server/routes/download.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware'); // if you want protected downloads
const controller = require('../controllers/download.controller');

router.use(auth);       // remove this line if you want public downloads

router.get('/:id', controller.downloadTrack);

module.exports = router;