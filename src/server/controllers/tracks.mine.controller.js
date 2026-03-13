// src/server/controllers/tracks.mine.controller.js
const pool = require('../db').pool;

/**
 * GET /tracks/mine
 * returns list of tracks owned by the current user's artist profile(s)
 */
async function listMyTracks(req, res) {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.preview_url, t.preview_artwork, t.duration, t.is_approved, t.is_rejected, t.rejection_reason, t.created_at
       FROM tracks t
       WHERE t.artist_id IN (SELECT id FROM artists WHERE user_id = ?)
       ORDER BY t.created_at DESC`, [userId]
    );
    res.json({ tracks: rows || [] });
  } catch (err) {
    console.error('listMyTracks error', err);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
}

/**
 * GET /tracks/:id
 * returns a single track if user owns it or admin requests it
 */
async function getTrack(req, res) {
  try {
    const id = req.params.id;
    const userId = req.user.id;

    const [rows] = await pool.query(`SELECT t.* FROM tracks t WHERE t.id = ? LIMIT 1`, [id]);
    if (!rows || !rows[0]) return res.status(404).json({ error: 'Not found' });

    const track = rows[0];

    // allow if admin or owner (owner via artists.user_id)
    if (req.user.role !== 'admin') {
      const [a] = await pool.query(`SELECT id FROM artists WHERE id = ? AND user_id = ? LIMIT 1`, [track.artist_id, userId]);
      if (!a || !a[0]) return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ track });
  } catch (err) {
    console.error('getTrack error', err);
    res.status(500).json({ error: 'Failed to fetch track' });
  }
}

module.exports = {
  listMyTracks,
  getTrack
};