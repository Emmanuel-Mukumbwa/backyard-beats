const express = require('express');
const router = express.Router();
const tracksController = require('../controllers/tracksController');

router.get('/', tracksController.list);
router.get('/:id', tracksController.get);
router.post('/', tracksController.create);
router.put('/:id', tracksController.update);
router.delete('/:id', tracksController.remove);

module.exports = router;
