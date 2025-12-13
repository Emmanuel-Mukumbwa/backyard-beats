// server/controllers/rsvps.controller.js
const pool = require('../db').pool;

/**
 * RSVP controller
 * - rsvpEvent: upsert RSVP for authenticated user
 * - cancelRsvp: remove RSVP for authenticated user
 * - getMyRsvps: list RSVPs for the authenticated user
 * - getEventRsvps: list RSVPs for an event (artist must own the event)
 */

// Helper: fetch the artist row for the currently authenticated user.
async function getArtistForUser(userId) {
  if (!userId) return null;
  const [rows] = await pool.query('SELECT * FROM artists WHERE user_id = ? LIMIT 1', [userId]);
  return (rows && rows[0]) ? rows[0] : null;
}

exports.rsvpEvent = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const eventId = Number(req.params.id);
    if (!eventId) return res.status(400).json({ error: 'Invalid event id' });

    const status = typeof req.body.status === 'string' && req.body.status ? req.body.status : 'going';

    // Check event exists
    const [evRows] = await pool.query('SELECT id, artist_id, capacity FROM events WHERE id = ? LIMIT 1', [eventId]);
    if (!evRows || evRows.length === 0) return res.status(404).json({ error: 'Event not found' });

    // Optional: check capacity (if capacity column exists and is not null)
    const evRow = evRows[0];
    if (evRow.capacity !== null && typeof evRow.capacity !== 'undefined') {
      // count current 'going' RSVPs
      const [cntRows] = await pool.query('SELECT COUNT(*) AS cnt FROM rsvps WHERE event_id = ? AND status = ?', [eventId, 'going']);
      const currentGoing = cntRows && cntRows[0] ? Number(cntRows[0].cnt || 0) : 0;
      if (evRow.capacity > 0 && currentGoing >= Number(evRow.capacity) && status === 'going') {
        return res.status(400).json({ error: 'Event capacity reached' });
      }
    }

    // Upsert behavior: update existing RSVP or insert new
    const [exists] = await pool.query('SELECT id FROM rsvps WHERE event_id = ? AND user_id = ? LIMIT 1', [eventId, user.id]);
    if (exists && exists.length) {
      const id = exists[0].id;
      await pool.query('UPDATE rsvps SET status = ?, created_at = NOW() WHERE id = ?', [status, id]);
      const [row] = await pool.query('SELECT r.*, u.username AS user_name FROM rsvps r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = ? LIMIT 1', [id]);
      return res.status(200).json(row[0] || null);
    } else {
      const [ins] = await pool.query('INSERT INTO rsvps (event_id, user_id, status, created_at) VALUES (?, ?, ?, NOW())', [eventId, user.id, status]);
      const [row] = await pool.query('SELECT r.*, u.username AS user_name FROM rsvps r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = ? LIMIT 1', [ins.insertId]);
      return res.status(201).json(row[0] || null);
    }
  } catch (err) {
    next(err);
  }
};

exports.cancelRsvp = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });
    const eventId = Number(req.params.id);
    if (!eventId) return res.status(400).json({ error: 'Invalid event id' });

    await pool.query('DELETE FROM rsvps WHERE event_id = ? AND user_id = ?', [eventId, user.id]);
    return res.json({ message: 'RSVP cancelled' });
  } catch (err) {
    next(err);
  }
};

exports.getMyRsvps = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const [rows] = await pool.query(
      `SELECT r.*, e.title, e.event_date, e.district_id, e.venue, e.image_url, a.display_name as artist_display_name, a.id as artist_id
       FROM rsvps r
       LEFT JOIN events e ON r.event_id = e.id
       LEFT JOIN artists a ON e.artist_id = a.id
       WHERE r.user_id = ?
       ORDER BY e.event_date DESC
       LIMIT 500`,
      [user.id]
    );
    return res.json(rows || []);
  } catch (err) {
    next(err);
  }
};

exports.getEventRsvps = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) return res.status(401).json({ error: 'Authentication required' });

    const eventId = Number(req.params.id);
    if (!eventId) return res.status(400).json({ error: 'Invalid event id' });

    // Ensure the authenticated user owns the artist for that event
    const [evRows] = await pool.query('SELECT artist_id FROM events WHERE id = ? LIMIT 1', [eventId]);
    if (!evRows || evRows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const ev = evRows[0];

    const artist = await getArtistForUser(user.id);
    if (!artist || Number(artist.id) !== Number(ev.artist_id)) {
      return res.status(403).json({ error: 'Not authorized to view RSVPs for this event' });
    }

    const [rows] = await pool.query(
      `SELECT r.*, u.username AS user_name FROM rsvps r LEFT JOIN users u ON r.user_id = u.id WHERE r.event_id = ? ORDER BY r.created_at DESC`,
      [eventId]
    );
    return res.json(rows || []);
  } catch (err) {
    next(err);
  }
};
