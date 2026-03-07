// server/controllers/artists.controller.js
const pool = require('../db').pool;

/**
 * GET /artists
 * Optional query params: district, q (search by name)
 */
exports.listArtists = async (req, res, next) => {
    try {
    const params = [];
    let where = 'WHERE 1=1'; 
 
    if (req.query.district) {
      where += ' AND (district_id = ? OR district = ?)';
      params.push(req.query.district, req.query.district);
    } 
    if (req.query.q) {
      where += ' AND display_name LIKE ?';
      params.push(`%${req.query.q}%`);
    }

    const sql = `SELECT a.*, u.username FROM artists a LEFT JOIN users u ON a.user_id = u.id ${where} ORDER BY a.id DESC LIMIT 200`;
    const [rows] = await pool.query(sql, params);
    return res.json(rows || []);
  } catch (err) {
    next(err);
  }
};

exports.getArtistById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid artist id' });

    const [rows] = await pool.query('SELECT a.*, u.username FROM artists a LEFT JOIN users u ON a.user_id = u.id WHERE a.id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Artist not found' });
    return res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};
   