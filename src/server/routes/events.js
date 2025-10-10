const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');

router.get('/', eventsController.list);
router.get('/:id', eventsController.get);
router.post('/', eventsController.create);
router.put('/:id', eventsController.update);
router.delete('/:id', eventsController.remove);

module.exports = router;
