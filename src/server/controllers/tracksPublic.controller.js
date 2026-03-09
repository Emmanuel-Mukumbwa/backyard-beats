// src/server/controllers/tracksPublic.controller.js
const pool = require('../db').pool;

/**
 * Public tracks endpoints (read-only)
 * - GET /public/tracks/recent?limit=12
 */

exports.getRecentTracks = async (req, res, next) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 12);

    const sql = `
      SELECT
        t.id,
        t.title,
        t.preview_url,
        t.duration,
        t.preview_artwork,
        t.genre,
        t.release_date,
        t.created_at,
        a.id AS artist_id,
        a.display_name AS artist_name
      FROM tracks t
      LEFT JOIN artists a ON t.artist_id = a.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `;

    const [rows] = await pool.query(sql, [limit]);

    const result = (rows || []).map(r => ({
      id: r.id,
      title: r.title,
      preview_url: r.preview_url || null,
      duration: r.duration || null,
      artwork_url: r.preview_artwork || null,
      genre: r.genre || null,
      release_date: r.release_date ? new Date(r.release_date).toISOString().slice(0,10) : null,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      artist: {
        id: r.artist_id,
        display_name: r.artist_name
      }
    }));

    return res.json(result);
  } catch (err) {
    next(err);
  }
};