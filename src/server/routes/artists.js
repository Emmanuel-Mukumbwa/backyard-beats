const express = require('express');
const router = express.Router();
const artistsController = require('../controllers/artistsController');

router.get('/', artistsController.list);
router.get('/:id', artistsController.get);
router.post('/', artistsController.create);
router.put('/:id', artistsController.update);
router.delete('/:id', artistsController.remove);

module.exports = router;
