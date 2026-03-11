const express = require('express');
const router = express.Router();
const districtsController = require('../controllers/districtsController.controller');

router.get('/', districtsController.list);
router.get('/:id', districtsController.get);
router.post('/', districtsController.create);
router.put('/:id', districtsController.update);
router.delete('/:id', districtsController.remove);

module.exports = router;
 