//src/server/controllers/favorites.controller.js
const pool = require('../db').pool;

/**
 * Favorites controller (user follows artists)
 *
 * Table: favorites (id, user_id, artist_id, created_at)
 *
 * Exports:
 * - getUserFavorites(req, res)
 * - addFavorite(req, res)
 * - removeFavorite(req, res)
 * - checkFavorite(req, res)
 */

exports.getUserFavorites = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const sql = `
      SELECT a.id, a.display_name, a.photo_url, a.user_id, a.avg_rating, a.has_upcoming_event, f.created_at AS followed_at
      FROM favorites f
      JOIN artists a ON f.artist_id = a.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      LIMIT 200
    `;
    const [rows] = await pool.query(sql, [userId]);
    return res.json(rows || []);
  } catch (err) {
    next(err);
  }
};


exports.addFavorite = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const artistId = Number(req.body.artist_id || req.body.id);
    if (!artistId) return res.status(400).json({ error: 'artist_id is required' });

    // Ensure artist exists
    const [aRows] = await pool.query('SELECT id FROM artists WHERE id = ? LIMIT 1', [artistId]);
    if (!aRows || aRows.length === 0) return res.status(404).json({ error: 'Artist not found' });

    // Try to insert (ignore duplicates)
    try {
      await pool.query('INSERT INTO favorites (user_id, artist_id) VALUES (?, ?)', [userId, artistId]);
    } catch (e) {
      // if duplicate (unique constraint) -> return 200 with message
      if (e && e.code === 'ER_DUP_ENTRY') {
        return res.status(200).json({ message: 'Already following' });
      }
      throw e;
    }

    // Optionally update cached follower_count on artists (if column exists)
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM artists LIKE ?', ['follower_count']);
      if (cols && cols.length) {
        await pool.query('UPDATE artists SET follower_count = (SELECT COUNT(*) FROM favorites WHERE artist_id = ?) WHERE id = ?', [artistId, artistId]);
      }
    } catch (e) {
      // non-fatal
      console.warn('Could not update artists.follower_count:', e.message || e);
    }

    return res.status(201).json({ message: 'Followed', artist_id: artistId });
  } catch (err) {
    next(err);
  }
};

exports.removeFavorite = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const artistId = Number(req.params.artistId);
    if (!artistId) return res.status(400).json({ error: 'Invalid artist id' });

    await pool.query('DELETE FROM favorites WHERE user_id = ? AND artist_id = ?', [userId, artistId]);

    // update cached follower_count if present
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM artists LIKE ?', ['follower_count']);
      if (cols && cols.length) {
        await pool.query('UPDATE artists SET follower_count = (SELECT COUNT(*) FROM favorites WHERE artist_id = ?) WHERE id = ?', [artistId, artistId]);
      }
    } catch (e) {
      console.warn('Could not update artists.follower_count:', e.message || e);
    }

    return res.json({ message: 'Unfollowed', artist_id: artistId });
  } catch (err) {
    next(err);
  }
};

exports.checkFavorite = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const artistId = Number(req.params.artistId);
    if (!artistId) return res.status(400).json({ error: 'Invalid artist id' });

    if (!userId) return res.json({ following: false });

    const [rows] = await pool.query('SELECT 1 FROM favorites WHERE user_id = ? AND artist_id = ? LIMIT 1', [userId, artistId]);
    return res.json({ following: !!(rows && rows.length) });
  } catch (err) {
    next(err);
  }
};
