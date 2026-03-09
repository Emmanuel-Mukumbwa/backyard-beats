// src/server/controllers/admin/ratings.controller.js
const pool = require('../../db').pool;

/**
 * GET /admin/ratings
 * Optional: supports pagination later
 */
exports.listRatings = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at AS createdAt,
              a.display_name AS artist, u.username AS reviewer
       FROM ratings r
       LEFT JOIN artists a ON r.artist_id = a.id
       LEFT JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC
       LIMIT 500`
    );
    res.json({ ratings: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /admin/ratings/:id
 */
exports.deleteRating = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid rating id' });

    await pool.query('DELETE FROM ratings WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};