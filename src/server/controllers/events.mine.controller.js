// src/server/controllers/events.mine.controller.js
const pool = require('../db').pool;

/**
 * GET /events/mine
 */ 
async function listMyEvents(req, res) {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT e.id, e.title, e.image_url, e.event_date, e.venue, e.is_approved, e.is_rejected, e.rejection_reason, e.created_at
       FROM events e
       WHERE e.artist_id IN (SELECT id FROM artists WHERE user_id = ?)
       ORDER BY e.created_at DESC`, [userId]
    );
    res.json({ events: rows || [] });
  } catch (err) {
    console.error('listMyEvents error', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}

/**
 * GET /events/:id
 */
async function getEvent(req, res) {
  try {
    const id = req.params.id;
    const userId = req.user.id;

    const [rows] = await pool.query(`SELECT e.* FROM events e WHERE e.id = ? LIMIT 1`, [id]);
    if (!rows || !rows[0]) return res.status(404).json({ error: 'Not found' });

    const ev = rows[0];

    if (req.user.role !== 'admin') {
      const [a] = await pool.query(`SELECT id FROM artists WHERE id = ? AND user_id = ? LIMIT 1`, [ev.artist_id, userId]);
      if (!a || !a[0]) return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ event: ev });
  } catch (err) {
    console.error('getEvent error', err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
}

module.exports = {
  listMyEvents,
  getEvent
};