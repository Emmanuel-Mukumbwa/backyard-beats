const express = require('express');
const router = express.Router();
const ratingsController = require('../controllers/ratingsController');

router.get('/', ratingsController.list);
router.get('/:id', ratingsController.get);
router.post('/', ratingsController.create);
router.put('/:id', ratingsController.update);
router.delete('/:id', ratingsController.remove);

module.exports = router;
