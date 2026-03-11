// src/server/controllers/playlists.controller.js
const pool = require('../db').pool;

/**
 * Playlists controller
 *
 * All endpoints require authentication and enforce user ownership.
 * Admins can pass ?include_unapproved=1 to bypass unapproved/rejected/banned filtering for moderation.
 */

function isAdminIncludeUnapproved(req) {
  return !!(req.user && req.user.role === 'admin' && req.query.include_unapproved === '1');
}

async function getUserRow(userId) {
  if (!userId) return null;
  const [rows] = await pool.query('SELECT id, username, banned, deleted_at FROM users WHERE id = ? LIMIT 1', [userId]);
  return (rows && rows[0]) || null;
}

async function ensurePlaylistOwnedByUser(playlistId, userId) {
  const [rows] = await pool.query('SELECT id, user_id FROM playlists WHERE id = ? LIMIT 1', [playlistId]);
  if (!rows || rows.length === 0) return false;
  return rows[0].user_id === userId;
}

/**
 * Utility: ensure a track is visible / allowed
 * Returns object { ok: boolean, status?, message? }
 * Checks: track exists, artist exists, artist.user not deleted/banned, artist approved unless adminOverride
 */
async function validateTrackVisibility(trackId, adminOverride = false) {
  const sql = `
    SELECT t.id AS track_id,
           t.title,
           t.preview_url,
           t.duration,
           t.preview_artwork,
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
  return { ok: true, track: row };
}

/* -------------------------
   List user playlists
   ------------------------- */
exports.getUserPlaylists = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const sql = `
      SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
        (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS track_count
      FROM playlists p
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `;
    const [rows] = await pool.query(sql, [user.id]);
    return res.json(rows || []);
  } catch (err) {
    next(err);
  }
};

/* -------------------------
   Create playlist
   ------------------------- */
exports.createPlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const name = (req.body.name || '').trim();
    const description = req.body.description || null;
    if (!name) return res.status(400).json({ error: 'Playlist name is required' });

    const [result] = await pool.query('INSERT INTO playlists (user_id, name, description) VALUES (?, ?, ?)', [user.id, name, description]);
    const insertedId = result.insertId;
    const [rows] = await pool.query('SELECT id, name, description, created_at, updated_at FROM playlists WHERE id = ? LIMIT 1', [insertedId]);
    return res.status(201).json(rows && rows[0] ? rows[0] : { id: insertedId, name, description });
  } catch (err) {
    next(err);
  }
};

/* -------------------------
   Get playlist details (with ordered tracks)
   ------------------------- */
exports.getPlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const playlistId = Number(req.params.id);
    if (!playlistId) return res.status(400).json({ error: 'Invalid playlist id' });

    // ensure ownership
    const owned = await ensurePlaylistOwnedByUser(playlistId, user.id);
    if (!owned) return res.status(404).json({ error: 'Playlist not found' });

    // fetch playlist meta
    const [pRows] = await pool.query('SELECT id, name, description, created_at, updated_at FROM playlists WHERE id = ? LIMIT 1', [playlistId]);
    const playlist = pRows && pRows[0] ? pRows[0] : null;

    // fetch ordered tracks (position asc)
    const sql = `
      SELECT pt.track_id, pt.position, pt.added_at,
             t.title, t.preview_url, t.duration, t.preview_artwork AS artwork_url, t.genre,
             a.id AS artist_id, a.display_name AS artist_name,
             a.is_approved AS artist_is_approved,
             a.is_rejected AS artist_is_rejected,
             u.deleted_at AS artist_user_deleted_at,
             u.banned AS artist_user_banned
      FROM playlist_tracks pt
      LEFT JOIN tracks t ON pt.track_id = t.id
      LEFT JOIN artists a ON t.artist_id = a.id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE pt.playlist_id = ?
      ORDER BY pt.position ASC, pt.added_at ASC
    `;
    const [tracks] = await pool.query(sql, [playlistId]);

    const adminOverride = isAdminIncludeUnapproved(req);

    const mapped = (tracks || []).map(r => {
      // If not admin and track's artist is banned/deleted/unapproved/rejected -> omit this track from response
      if (!adminOverride) {
        if (r.artist_user_deleted_at || r.artist_user_banned || r.artist_is_rejected || !r.artist_is_approved) {
          return null;
        }
      }
      return {
        track_id: r.track_id,
        position: r.position,
        added_at: r.added_at,
        id: r.track_id,
        title: r.title,
        preview_url: r.preview_url,
        duration: r.duration,
        artwork_url: r.artwork_url,
        genre: r.genre,
        artist: r.artist_id ? { id: r.artist_id, display_name: r.artist_name } : null,
        // admin debug fields
        ...(adminOverride ? {
          artist_is_approved: !!r.artist_is_approved,
          artist_is_rejected: !!r.artist_is_rejected,
          artist_user_deleted_at: r.artist_user_deleted_at,
          artist_user_banned: !!r.artist_user_banned
        } : {})
      };
    }).filter(Boolean);

    return res.json({ ...playlist, tracks: mapped });
  } catch (err) {
    next(err);
  }
};

/* -------------------------
   Update playlist meta
   ------------------------- */
exports.updatePlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const playlistId = Number(req.params.id);
    if (!playlistId) return res.status(400).json({ error: 'Invalid playlist id' });

    const owned = await ensurePlaylistOwnedByUser(playlistId, user.id);
    if (!owned) return res.status(404).json({ error: 'Playlist not found' });

    const name = (req.body.name || '').trim();
    const description = req.body.description || null;
    if (!name) return res.status(400).json({ error: 'Playlist name is required' });

    await pool.query('UPDATE playlists SET name = ?, description = ? WHERE id = ?', [name, description, playlistId]);

    const [rows] = await pool.query('SELECT id, name, description, created_at, updated_at FROM playlists WHERE id = ? LIMIT 1', [playlistId]);
    return res.json(rows && rows[0] ? rows[0] : { id: playlistId, name, description });
  } catch (err) {
    next(err);
  }
};

/* -------------------------
   Delete playlist
   ------------------------- */
exports.deletePlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const playlistId = Number(req.params.id);
    if (!playlistId) return res.status(400).json({ error: 'Invalid playlist id' });

    const owned = await ensurePlaylistOwnedByUser(playlistId, user.id);
    if (!owned) return res.status(404).json({ error: 'Playlist not found' });

    await pool.query('DELETE FROM playlists WHERE id = ? AND user_id = ?', [playlistId, user.id]);
    return res.json({ message: 'Playlist deleted' });
  } catch (err) {
    next(err);
  } 
};

/* -------------------------
   Add track to playlist
   ------------------------- */
exports.addTrackToPlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const playlistId = Number(req.params.id);
    const trackId = Number(req.body.track_id);
    if (!playlistId || !trackId) return res.status(400).json({ error: 'playlist id and track_id required' });

    const owned = await ensurePlaylistOwnedByUser(playlistId, user.id);
    if (!owned) return res.status(404).json({ error: 'Playlist not found' });

    const adminOverride = isAdminIncludeUnapproved(req);

    // validate track visibility
    const validation = await validateTrackVisibility(trackId, adminOverride);
    if (!validation.ok) {
      // map statuses to HTTP codes similar to other controllers
      if (validation.status === 'not_found') return res.status(404).json({ error: 'Track not found' });
      if (validation.status === 'deleted') return res.status(410).json({ status: 'deleted', message: validation.message });
      if (validation.status === 'banned') return res.status(403).json({ status: 'banned', message: validation.message });
      return res.status(403).json({ status: validation.status, message: validation.message });
    }

    // compute position if not provided -> max(position)+1
    let position = (typeof req.body.position === 'number') ? req.body.position : null;
    if (position === null) {
      const [maxRows] = await pool.query('SELECT COALESCE(MAX(position), -1) AS maxpos FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
      const maxpos = (maxRows && maxRows[0] && typeof maxRows[0].maxpos === 'number') ? maxRows[0].maxpos : -1;
      position = maxpos + 1;
    }
 
    try {
      await pool.query('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', [playlistId, trackId, position]);
    } catch (e) {
      if (e && e.code === 'ER_DUP_ENTRY') {
        return res.status(200).json({ message: 'Track already in playlist' });
      }
      throw e;
    }

    return res.status(201).json({ message: 'Added', track_id: trackId, position });
  } catch (err) {
    next(err);
  }
};

/* -------------------------
   Remove track from playlist
   ------------------------- */
exports.removeTrackFromPlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const playlistId = Number(req.params.id);
    const trackId = Number(req.params.trackId);
    if (!playlistId || !trackId) return res.status(400).json({ error: 'playlist id and track id required' });

    const owned = await ensurePlaylistOwnedByUser(playlistId, user.id);
    if (!owned) return res.status(404).json({ error: 'Playlist not found' });

    await pool.query('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [playlistId, trackId]);
    return res.json({ message: 'Track removed' });
  } catch (err) {
    next(err);
  }
};

/* -------------------------
   Reorder playlist tracks
   ------------------------- */
exports.reorderPlaylistTracks = async (req, res, next) => {
  // expects body: { track_order: [<trackId>, ...] }
  let conn;
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRow = await getUserRow(user.id);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const playlistId = Number(req.params.id);
    const trackOrder = Array.isArray(req.body.track_order) ? req.body.track_order.map(x => Number(x)) : null;
    if (!playlistId || !trackOrder) {
      return res.status(400).json({ error: 'playlist id and track_order array required' });
    }

    conn = await pool.getConnection();

    // ensure ownership via connection
    const [pRows] = await conn.query('SELECT id, user_id FROM playlists WHERE id = ? LIMIT 1', [playlistId]);
    if (!pRows || !pRows.length || pRows[0].user_id !== user.id) {
      conn.release();
      return res.status(404).json({ error: 'Playlist not found' });
    }

    await conn.beginTransaction();

    // update positions in order
    for (let i = 0; i < trackOrder.length; i++) {
      const tid = trackOrder[i];
      await conn.query('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?', [i, playlistId, tid]);
    }

    await conn.commit();
    conn.release();
    return res.json({ message: 'Reordered' });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (e) { /* ignore */ }
      try { conn.release(); } catch (e) { /* ignore */ }
    }
    next(err);
  }
};