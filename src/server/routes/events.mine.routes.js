//src/server/routes/events.mine.routes.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const events = require('../controllers/events.mine.controller');

router.get('/mine', auth, events.listMyEvents);
router.get('/:id', auth, events.getEvent);

module.exports = router; 