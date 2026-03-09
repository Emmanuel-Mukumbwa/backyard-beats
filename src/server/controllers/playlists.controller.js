// src/server/controllers/playlists.controller.js
const pool = require('../db').pool;

/**
 * Playlists controller
 * - GET  /fan/playlists                -> list user's playlists with track counts
 * - POST /fan/playlists                -> create playlist
 * - GET  /fan/playlists/:id            -> playlist details + ordered tracks
 * - PUT  /fan/playlists/:id            -> update playlist name/description
 * - DELETE /fan/playlists/:id          -> delete playlist
 * - POST /fan/playlists/:id/tracks     -> add track to playlist { track_id, position? }
 * - DELETE /fan/playlists/:id/tracks/:trackId -> remove track
 * - PUT  /fan/playlists/:id/reorder    -> reorder playlist with { track_order: [trackId,...] }
 *
 * All endpoints require authentication and enforce user ownership.
 */

async function ensurePlaylistOwnedByUser(playlistId, userId) {
  const [rows] = await pool.query('SELECT id, user_id FROM playlists WHERE id = ? LIMIT 1', [playlistId]);
  if (!rows || rows.length === 0) return false;
  return rows[0].user_id === userId;
}

exports.getUserPlaylists = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

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

exports.createPlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

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

exports.getPlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

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
             a.id AS artist_id, a.display_name AS artist_name
      FROM playlist_tracks pt
      LEFT JOIN tracks t ON pt.track_id = t.id
      LEFT JOIN artists a ON t.artist_id = a.id
      WHERE pt.playlist_id = ?
      ORDER BY pt.position ASC, pt.added_at ASC
    `;
    const [tracks] = await pool.query(sql, [playlistId]);

    const mapped = (tracks || []).map(r => ({
      track_id: r.track_id,
      position: r.position,
      added_at: r.added_at,
      id: r.track_id,
      title: r.title,
      preview_url: r.preview_url,
      duration: r.duration,
      artwork_url: r.artwork_url,
      genre: r.genre,
      artist: r.artist_id ? { id: r.artist_id, display_name: r.artist_name } : null
    }));

    return res.json({ ...playlist, tracks: mapped });
  } catch (err) {
    next(err);
  }
};

exports.updatePlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

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

exports.deletePlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

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

exports.addTrackToPlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const playlistId = Number(req.params.id);
    const trackId = Number(req.body.track_id);
    if (!playlistId || !trackId) return res.status(400).json({ error: 'playlist id and track_id required' });

    const owned = await ensurePlaylistOwnedByUser(playlistId, user.id);
    if (!owned) return res.status(404).json({ error: 'Playlist not found' });

    // ensure track exists
    const [trows] = await pool.query('SELECT id FROM tracks WHERE id = ? LIMIT 1', [trackId]);
    if (!trows || trows.length === 0) return res.status(404).json({ error: 'Track not found' });

    // compute position if not provided -> max(position)+1
    let position = typeof req.body.position === 'number' ? req.body.position : null;
    if (position === null) {
      const [maxRows] = await pool.query('SELECT COALESCE(MAX(position), -1) AS maxpos FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
      const maxpos = (maxRows && maxRows[0] && typeof maxRows[0].maxpos === 'number') ? maxRows[0].maxpos : -1;
      position = maxpos + 1;
    }

    // attempt insert
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

exports.removeTrackFromPlaylist = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

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

exports.reorderPlaylistTracks = async (req, res, next) => {
  // expects body: { track_order: [<trackId>, ...] }
  const conn = await pool.getConnection();
  try {
    const user = req.user;
    if (!user || !user.id) {
      conn.release();
      return res.status(401).json({ error: 'Authentication required' });
    }
    const playlistId = Number(req.params.id);
    const trackOrder = Array.isArray(req.body.track_order) ? req.body.track_order.map(x => Number(x)) : null;
    if (!playlistId || !trackOrder) {
      conn.release();
      return res.status(400).json({ error: 'playlist id and track_order array required' });
    }

    // ensure ownership
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
    try { await conn.rollback(); } catch (e) { /* ignore */ }
    conn.release();
    next(err);
  }
};