// src/server/controllers/favorites.controller.js
const pool = require('../db').pool;

function isAdminIncludeUnapproved(req) {
  return !!(req.user && req.user.role === 'admin' && req.query.include_unapproved === '1');
}

async function getUserRow(userId) {
  if (!userId) return null;
  const [rows] = await pool.query('SELECT id, username, banned, deleted_at FROM users WHERE id = ? LIMIT 1', [userId]);
  return (rows && rows[0]) || null;
}

exports.getUserFavorites = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(userId);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const adminOverride = isAdminIncludeUnapproved(req);

    // This query retrieves richer artist info:
    // - genres & moods via GROUP_CONCAT (converted to arrays later)
    // - counts (total tracks, approved tracks)
    // - latest track id/title
    // - district id/name
    // - followed_at timestamp from favorites
    // Note: GROUP BY a.id to aggregate genre/mood lists.
    const sql = `
      SELECT
        a.id,
        a.display_name,
        a.photo_url,
        a.user_id,
        a.avg_rating,
        a.follower_count,
        a.has_upcoming_event,
        u.deleted_at AS artist_user_deleted_at,
        u.banned AS artist_user_banned,
        u.district_id AS user_district_id,
        d.name AS district,
        (SELECT COUNT(*) FROM tracks t WHERE t.artist_id = a.id) AS track_count,
        (SELECT COUNT(*) FROM tracks t WHERE t.artist_id = a.id AND t.is_approved = 1 AND t.is_rejected = 0) AS approved_track_count,
        (SELECT t2.id FROM tracks t2 WHERE t2.artist_id = a.id ORDER BY t2.created_at DESC LIMIT 1) AS latest_track_id,
        (SELECT t3.title FROM tracks t3 WHERE t3.artist_id = a.id ORDER BY t3.created_at DESC LIMIT 1) AS latest_track_title,
        GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR ',') AS genre_names,
        GROUP_CONCAT(DISTINCT mo.name ORDER BY mo.name SEPARATOR ',') AS mood_names,
        f.created_at AS followed_at,
        a.is_approved AS artist_is_approved,
        a.is_rejected AS artist_is_rejected
      FROM favorites f
      JOIN artists a ON f.artist_id = a.id
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN districts d ON u.district_id = d.id
      LEFT JOIN artist_genres ag ON ag.artist_id = a.id
      LEFT JOIN genres g ON ag.genre_id = g.id
      LEFT JOIN artist_moods am ON am.artist_id = a.id
      LEFT JOIN moods mo ON am.mood_id = mo.id
      WHERE f.user_id = ?
      GROUP BY a.id
      ORDER BY f.created_at DESC
      LIMIT 200
    `;

    const [rows] = await pool.query(sql, [userId]);

    const result = (rows || []).map(r => {
      // Filter out banned/deleted/unapproved artists for public use unless admin explicitly asked
      if (!adminOverride) {
        if (r.artist_user_deleted_at) return null;
        if (r.artist_user_banned) return null;
        if (!r.artist_is_approved || r.artist_is_rejected) return null;
      }

      const genres = r.genre_names ? String(r.genre_names).split(',').map(s => s.trim()).filter(Boolean) : [];
      const moods = r.mood_names ? String(r.mood_names).split(',').map(s => s.trim()).filter(Boolean) : [];

      return {
        id: r.id,
        display_name: r.display_name,
        photo_url: r.photo_url,
        user_id: r.user_id,
        avg_rating: r.avg_rating !== null ? Number(r.avg_rating) : null,
        follower_count: r.follower_count !== null ? Number(r.follower_count) : 0,
        has_upcoming_event: !!r.has_upcoming_event,
        district: r.district || null,
        district_id: r.user_district_id || null,
        track_count: r.track_count !== null ? Number(r.track_count) : 0,
        approved_track_count: r.approved_track_count !== null ? Number(r.approved_track_count) : 0,
        latest_track: r.latest_track_id ? { id: Number(r.latest_track_id), title: r.latest_track_title || null } : null,
        genres,
        moods,
        followed_at: r.followed_at ? new Date(r.followed_at).toISOString() : null,
        // admin info
        ...(adminOverride ? {
          artist_is_approved: !!r.artist_is_approved,
          artist_is_rejected: !!r.artist_is_rejected,
          artist_user_deleted_at: r.artist_user_deleted_at,
          artist_user_banned: !!r.artist_user_banned
        } : {})
      };
    }).filter(Boolean); // remove nulls (filtered-out artists)

    return res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.addFavorite = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(userId);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const artistId = Number(req.body.artist_id || req.body.id);
    if (!artistId) return res.status(400).json({ error: 'artist_id is required' });

    const [aRows] = await pool.query('SELECT a.*, u.deleted_at AS user_deleted_at, u.banned AS user_banned FROM artists a LEFT JOIN users u ON a.user_id = u.id WHERE a.id = ? LIMIT 1', [artistId]);
    if (!aRows || aRows.length === 0) return res.status(404).json({ error: 'Artist not found' });
    const artist = aRows[0];

    const adminOverride = isAdminIncludeUnapproved(req);
    if (!adminOverride) {
      if (artist.user_deleted_at) return res.status(410).json({ status: 'deleted', message: 'Artist account deleted' });
      if (artist.user_banned) return res.status(403).json({ status: 'banned', message: 'Artist account banned' });
      if (artist.is_rejected) return res.status(403).json({ status: 'rejected', message: 'Artist profile rejected' });
      if (!artist.is_approved) return res.status(403).json({ status: 'pending_verification', message: 'Artist profile pending verification' });
    }

    try {
      await pool.query('INSERT INTO favorites (user_id, artist_id) VALUES (?, ?)', [userId, artistId]);
    } catch (e) {
      if (e && e.code === 'ER_DUP_ENTRY') {
        return res.status(200).json({ message: 'Already following' });
      }
      throw e;
    }

    // attempt to update cached follower_count if present
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM artists LIKE ?', ['follower_count']);
      if (cols && cols.length) {
        await pool.query('UPDATE artists SET follower_count = (SELECT COUNT(*) FROM favorites WHERE artist_id = ?) WHERE id = ?', [artistId, artistId]);
      }
    } catch (e) {
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

    const userRow = await getUserRow(userId);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const artistId = Number(req.params.artistId);
    if (!artistId) return res.status(400).json({ error: 'Invalid artist id' });

    await pool.query('DELETE FROM favorites WHERE user_id = ? AND artist_id = ?', [userId, artistId]);

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

    // If artist is deleted/banned/unapproved, return false (unless admin override)
    const [aRows] = await pool.query('SELECT a.*, u.deleted_at AS user_deleted_at, u.banned AS user_banned FROM artists a LEFT JOIN users u ON a.user_id = u.id WHERE a.id = ? LIMIT 1', [artistId]);
    if (!aRows || aRows.length === 0) return res.json({ following: false });
    const artist = aRows[0];

    const adminOverride = isAdminIncludeUnapproved(req);
    if (!adminOverride) {
      if (artist.user_deleted_at || artist.user_banned || artist.is_rejected || !artist.is_approved) {
        return res.json({ following: false });
      }
    }

    const [rows] = await pool.query('SELECT 1 FROM favorites WHERE user_id = ? AND artist_id = ? LIMIT 1', [userId, artistId]);
    return res.json({ following: !!(rows && rows.length) });
  } catch (err) {
    next(err);
  }
};