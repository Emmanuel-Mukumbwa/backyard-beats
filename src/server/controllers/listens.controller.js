// src/server/controllers/listens.controller.js
const pool = require('../db').pool;

/**
 * Listens controller
 * - POST /fan/listens  -> record a play (auth required)
 * - GET  /fan/listens   -> list recent plays
 * - GET  /fan/listens/summary -> quick stats for current user
 * - DELETE /fan/listens -> clear user's listening history
 *
 * Deduping:
 * - Skips insert if same user+track exists within DEDUP_SECONDS (default 30)
 *
 * Visibility rules:
 * - When recording or listing listens, tracks owned by deleted/banned/unapproved artists are blocked
 *   unless admin uses ?include_unapproved=1.
 */

const DEDUP_SECONDS = Number(process.env.LISTEN_DEDUP_SECONDS || 30);

function isAdminIncludeUnapproved(req) {
  return !!(req.user && req.user.role === 'admin' && req.query.include_unapproved === '1');
}

async function getUserRow(userId) {
  if (!userId) return null;
  const [rows] = await pool.query('SELECT id, username, banned, deleted_at FROM users WHERE id = ? LIMIT 1', [userId]);
  return (rows && rows[0]) || null;
}

/**
 * Helper: check a track's visibility (same as in playlists)
 * returns { ok: boolean, status?, message?, trackRow? }
 */
async function validateTrackVisibility(trackId, adminOverride = false) {
  const sql = `
    SELECT t.id AS track_id,
           t.title,
           a.id AS artist_id,
           a.is_approved AS artist_is_approved,
           a.is_rejected AS artist_is_rejected,
           u.id AS user_id,
           u.deleted_at AS user_deleted_at,
           u.banned AS user_banned
    FROM tracks t
    LEFT JOIN artists a ON t.artist_id = a.id
    LEFT JOIN users u ON a.user_id = u.id
    WHERE t.id = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [trackId]);
  if (!rows || rows.length === 0) return { ok: false, status: 'not_found', message: 'Track not found' };
  const row = rows[0];

  if (!adminOverride) {
    if (row.user_deleted_at) return { ok: false, status: 'deleted', message: 'Artist account deleted' };
    if (row.user_banned) return { ok: false, status: 'banned', message: 'Artist account banned' };
    if (row.artist_is_rejected) return { ok: false, status: 'rejected', message: 'Artist profile rejected' };
    if (!row.artist_is_approved) return { ok: false, status: 'pending_verification', message: 'Artist profile pending verification' };
  }
  return { ok: true, trackRow: row };
}

/* -------------------------
   Record a listen (POST)
   ------------------------- */
exports.recordListen = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const trackId = req.body.track_id ? Number(req.body.track_id) : null;
    const artistId = req.body.artist_id ? Number(req.body.artist_id) : null;

    const ip = (req.ip || req.headers['x-forwarded-for'] || null);
    const ua = req.get('user-agent') || null;

    const adminOverride = isAdminIncludeUnapproved(req);

    // Validate track/artist visibility if provided
    if (trackId) {
      const validation = await validateTrackVisibility(trackId, adminOverride);
      if (!validation.ok) {
        if (validation.status === 'not_found') return res.status(404).json({ error: 'Track not found' });
        if (validation.status === 'deleted') return res.status(410).json({ status: 'deleted', message: validation.message });
        if (validation.status === 'banned') return res.status(403).json({ status: 'banned', message: validation.message });
        return res.status(403).json({ status: validation.status, message: validation.message });
      }
    } else if (artistId) {
      // If only artistId provided, check artist/user visibility
      const [aRows] = await pool.query('SELECT a.*, u.deleted_at AS user_deleted_at, u.banned AS user_banned FROM artists a LEFT JOIN users u ON a.user_id = u.id WHERE a.id = ? LIMIT 1', [artistId]);
      if (!aRows || aRows.length === 0) return res.status(404).json({ error: 'Artist not found' });
      const ar = aRows[0];
      if (!adminOverride) {
        if (ar.user_deleted_at) return res.status(410).json({ status: 'deleted', message: 'Artist account deleted' });
        if (ar.user_banned) return res.status(403).json({ status: 'banned', message: 'Artist account banned' });
        if (ar.is_rejected) return res.status(403).json({ status: 'rejected', message: 'Artist profile rejected' });
        if (!ar.is_approved) return res.status(403).json({ status: 'pending_verification', message: 'Artist profile pending verification' });
      }
    }

    // Deduping: if trackId provided check last listen by this user+track
    if (trackId) {
      const [last] = await pool.query(
        `SELECT played_at FROM listens WHERE user_id = ? AND track_id = ? ORDER BY played_at DESC LIMIT 1`,
        [user.id, trackId]
      );
      if (last && last.length) {
        const lastPlayed = new Date(last[0].played_at).getTime();
        const ageSec = (Date.now() - lastPlayed) / 1000;
        if (ageSec <= DEDUP_SECONDS) {
          return res.status(200).json({ message: 'Duplicate ignored (dedup window)', ignored: true, within_seconds: DEDUP_SECONDS });
        }
      }
    } else if (artistId) {
      const [lastA] = await pool.query(
        `SELECT played_at FROM listens WHERE user_id = ? AND artist_id = ? ORDER BY played_at DESC LIMIT 1`,
        [user.id, artistId]
      );
      if (lastA && lastA.length) {
        const lastPlayed = new Date(lastA[0].played_at).getTime();
        const ageSec = (Date.now() - lastPlayed) / 1000;
        if (ageSec <= DEDUP_SECONDS) {
          return res.status(200).json({ message: 'Duplicate ignored (dedup window by artist)', ignored: true, within_seconds: DEDUP_SECONDS });
        }
      }
    }

    const [insertRes] = await pool.query(
      `INSERT INTO listens (user_id, track_id, artist_id, ip, user_agent, played_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [user.id, trackId, artistId, ip, ua]
    );

    return res.status(201).json({ id: insertRes.insertId, track_id: trackId, artist_id: artistId, played_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};

/* -------------------------
   Get user's listens
   ------------------------- */
exports.getUserListens = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const limit = Math.min(100, Number(req.query.limit) || 25);
    const adminOverride = isAdminIncludeUnapproved(req);

    const sql = `
      SELECT
        l.id AS listen_id,
        l.played_at,
        l.track_id,
        t.title AS track_title,
        t.preview_url,
        t.duration,
        COALESCE(t.preview_artwork, NULL) AS artwork_url,
        t.genre,
        a.id AS artist_id,
        a.display_name AS artist_name,
        a.is_approved AS artist_is_approved,
        a.is_rejected AS artist_is_rejected,
        u.deleted_at AS artist_user_deleted_at,
        u.banned AS artist_user_banned
      FROM listens l
      LEFT JOIN tracks t ON l.track_id = t.id
      LEFT JOIN artists a ON COALESCE(l.artist_id, t.artist_id) = a.id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE l.user_id = ?
      ORDER BY l.played_at DESC
      LIMIT ?
    `;

    const [rows] = await pool.query(sql, [user.id, limit]);

    const result = (rows || []).map(r => {
      // filter out listens associated with non-visible artists when not admin
      if (!adminOverride) {
        if (r.artist_user_deleted_at || r.artist_user_banned || r.artist_is_rejected || !r.artist_is_approved) {
          return null;
        }
      }
      return {
        listen_id: r.listen_id,
        played_at: r.played_at ? new Date(r.played_at).toISOString() : null,
        track: {
          id: r.track_id,
          title: r.track_title,
          preview_url: r.preview_url || null,
          duration: r.duration || null,
          artwork_url: r.artwork_url || null,
          genre: r.genre || null,
        },
        artist: {
          id: r.artist_id || null,
          display_name: r.artist_name || null
        },
        ...(adminOverride ? {
          artist_is_approved: !!r.artist_is_approved,
          artist_is_rejected: !!r.artist_is_rejected,
          artist_user_deleted_at: r.artist_user_deleted_at,
          artist_user_banned: !!r.artist_user_banned
        } : {})
      };
    }).filter(Boolean);

    return res.json(result);
  } catch (err) {
    next(err);
  }
};

/* -------------------------
   Get listens summary
   ------------------------- */
exports.getUserListensSummary = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const sql = `
      SELECT
        COUNT(*) AS total_plays,
        COUNT(DISTINCT track_id) AS distinct_tracks,
        MAX(played_at) AS last_played
      FROM listens
      WHERE user_id = ?
    `;
    const [rows] = await pool.query(sql, [user.id]);
    const row = (rows && rows[0]) || { total_plays: 0, distinct_tracks: 0, last_played: null };

    return res.json({
      total_plays: Number(row.total_plays || 0),
      distinct_tracks: Number(row.distinct_tracks || 0),
      last_played: row.last_played ? new Date(row.last_played).toISOString() : null
    });
  } catch (err) {
    next(err);
  }
};

/* -------------------------
   Clear user's listens
   ------------------------- */
exports.clearUserListens = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    await pool.query('DELETE FROM listens WHERE user_id = ?', [user.id]);
    return res.json({ message: 'Listening history cleared' });
  } catch (err) {
    next(err);
  }
};