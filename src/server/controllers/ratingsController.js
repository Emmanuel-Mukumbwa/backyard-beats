const Rating = require('../models/Rating');

exports.list = async (req, res, next) => {
  try {
    const ratings = await Rating.findAll();
    res.json(ratings);
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const rating = await Rating.findByPk(req.params.id);
    if (!rating) return res.status(404).json({ error: 'Rating not found' });
    res.json(rating);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const rating = await Rating.create(req.body);
    res.status(201).json(rating);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const rating = await Rating.findByPk(req.params.id);
    if (!rating) return res.status(404).json({ error: 'Rating not found' });
    await rating.update(req.body);
    res.json(rating);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const rating = await Rating.findByPk(req.params.id);
    if (!rating) return res.status(404).json({ error: 'Rating not found' });
    await rating.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
