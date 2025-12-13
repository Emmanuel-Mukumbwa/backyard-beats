// src/server/controllers/ratings.controller.js
const pool = require('../db').pool;

/**
 * Ratings Controller
 * Handles CRUD logic for artist ratings
 * 
 * ratings table:
 *  - id, artist_id, user_id, rating, comment, created_at
 */

function normalizeRow(r) {
  return {
    id: r.id,
    stars: r.rating !== null && r.rating !== undefined ? Number(r.rating) : null,
    comment: r.comment ?? null,
    reviewerName: r.reviewerName || 'Anonymous',
    createdAt: r.created_at || null
  };
}

/**
 * GET /ratings/artist/:id
 * or   /artists/:id/ratings
 */
exports.getRatingsForArtist = async (req, res, next) => {
  try {
    const artistId = Number(req.params.id);
    if (!artistId) return res.status(400).json({ error: 'Invalid artist id' });

    const sql = `
      SELECT r.id, r.rating, r.comment, r.created_at, u.username AS reviewerName
      FROM ratings r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.artist_id = ? 
      ORDER BY r.created_at DESC
      LIMIT 500
    `;

    const [rows] = await pool.query(sql, [artistId]);
    const normalized = (rows || []).map(normalizeRow);

    res.json(normalized);
  } catch (err) {
    console.error('Ratings controller error:', err);
    next(err);
  }
};

/**
 * POST /artists/:id/ratings
 * or   /ratings/artist/:id
 * 
 * Requires auth (req.user populated by middleware)
 * Body: { rating: 1–5, comment?: string }
 * 
 * Behavior:
 *  - If user already rated this artist → update rating
 *  - Else → insert new rating
 *  - Then → recalc artist’s average rating & total reviews
 */
exports.postRatingForArtist = async (req, res, next) => {
  try {
    const artistId = Number(req.params.id);
    if (!artistId) return res.status(400).json({ error: 'Invalid artist id' });

    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : null;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    // Check if user already rated this artist
    const [existingRows] = await pool.query(
      'SELECT id FROM ratings WHERE artist_id = ? AND user_id = ? LIMIT 1',
      [artistId, user.id]
    );

    let ratingId = null;
    if (existingRows && existingRows.length > 0) {
      // Update existing rating
      ratingId = existingRows[0].id;
      await pool.query(
        'UPDATE ratings SET rating = ?, comment = ?, created_at = NOW() WHERE id = ?',
        [rating, comment, ratingId]
      );
    } else {
      // Insert new rating
      const [insertRes] = await pool.query(
        'INSERT INTO ratings (artist_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, NOW())',
        [artistId, user.id, rating, comment]
      );
      ratingId = insertRes.insertId;
    }

    // Recalculate average rating & count
    const [aggRows] = await pool.query(
      'SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM ratings WHERE artist_id = ?',
      [artistId]
    );

    const avgRating =
      aggRows && aggRows[0] && aggRows[0].avg_rating !== null
        ? Number(parseFloat(aggRows[0].avg_rating).toFixed(2))
        : null;

    const totalReviews =
      aggRows && aggRows[0] && aggRows[0].cnt !== null
        ? Number(aggRows[0].cnt)
        : 0;

    // Try updating artists.avg_rating (if exists)
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM artists LIKE ?', ['avg_rating']);
      if (cols && cols.length) {
        await pool.query('UPDATE artists SET avg_rating = ? WHERE id = ?', [avgRating, artistId]);
      }
    } catch (e) {
      console.warn('Could not update artists.avg_rating:', e.message || e);
    }

    // Fetch the inserted/updated rating to return
    const [rows2] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.username AS reviewerName
       FROM ratings r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.id = ? LIMIT 1`,
      [ratingId]
    );

    const ratingRow = rows2 && rows2.length ? rows2[0] : null;
    const normalized = ratingRow ? normalizeRow(ratingRow) : null;

    return res.status(201).json({
      rating: normalized,
      avg_rating: avgRating,
      total_reviews: totalReviews
    });
  } catch (err) {
    console.error('postRatingForArtist error:', err);
    next(err);
  }
};
