// src/server/controllers/meta.controller.js
const pool = require('../db').pool;

/**
 * GET /meta/genres
 * If optional query param ?artist_id=123 is provided, returns genres assigned to that artist.
 * Otherwise returns all genres.
 */
exports.getGenres = async (req, res, next) => {
  try {
    const artistId = req.query.artist_id ? Number(req.query.artist_id) : null;
    if (artistId) {
      const [rows] = await pool.query(
        `SELECT g.id, g.name
         FROM artist_genres ag
         JOIN genres g ON g.id = ag.genre_id
         WHERE ag.artist_id = ?
         ORDER BY g.name`,
        [artistId]
      );
      return res.json(rows || []);
    } else {
      const [rows] = await pool.query('SELECT id, name FROM genres ORDER BY name');
      return res.json(rows || []);
    }
  } catch (err) {
    console.error('meta.getGenres error', err);
    next(err);
  }
};

/**
 * GET /meta/moods
 * If optional query param ?artist_id=123 is provided, returns moods assigned to that artist.
 * Otherwise returns all moods.
 */
exports.getMoods = async (req, res, next) => {
  try {
    const artistId = req.query.artist_id ? Number(req.query.artist_id) : null;
    if (artistId) {
      const [rows] = await pool.query(
        `SELECT m.id, m.name
         FROM artist_moods am
         JOIN moods m ON m.id = am.mood_id
         WHERE am.artist_id = ?
         ORDER BY m.name`,
        [artistId]
      );
      return res.json(rows || []);
    } else {
      const [rows] = await pool.query('SELECT id, name FROM moods ORDER BY name');
      return res.json(rows || []);
    }
  } catch (err) {
    console.error('meta.getMoods error', err);
    next(err);
  }
};