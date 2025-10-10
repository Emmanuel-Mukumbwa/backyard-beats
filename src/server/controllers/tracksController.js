const Track = require('../models/Track');

exports.list = async (req, res, next) => {
  try {
    const tracks = await Track.findAll();
    res.json(tracks);
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const track = await Track.findByPk(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    res.json(track);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const track = await Track.create(req.body);
    res.status(201).json(track);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const track = await Track.findByPk(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    await track.update(req.body);
    res.json(track);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const track = await Track.findByPk(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    await track.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
