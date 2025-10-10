const District = require('../models/District');

exports.list = async (req, res, next) => {
  try {
    const districts = await District.findAll();
    res.json(districts);
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const district = await District.findByPk(req.params.id);
    if (!district) return res.status(404).json({ error: 'District not found' });
    res.json(district);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const district = await District.create(req.body);
    res.status(201).json(district);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const district = await District.findByPk(req.params.id);
    if (!district) return res.status(404).json({ error: 'District not found' });
    await district.update(req.body);
    res.json(district);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const district = await District.findByPk(req.params.id);
    if (!district) return res.status(404).json({ error: 'District not found' });
    await district.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
