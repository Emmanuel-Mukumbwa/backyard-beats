const Artist = require('../models/Artist');

exports.list = async (req, res, next) => {
  try {
    const artists = await Artist.findAll();
    res.json(artists);
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const artist = await Artist.findByPk(req.params.id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    res.json(artist);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const artist = await Artist.create(req.body);
    res.status(201).json(artist);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const artist = await Artist.findByPk(req.params.id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    await artist.update(req.body);
    res.json(artist);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const artist = await Artist.findByPk(req.params.id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    await artist.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
