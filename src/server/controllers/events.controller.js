// server/controllers/events.controller.js
const pool = require('../db').pool;
const path = require('path');

const UPLOADS_PREFIX = process.env.UPLOADS_PREFIX || '/uploads';
const EVENT_IMAGE_SUBDIR = path.posix.join('events', 'images');

function normalizeEventRow(row) {
  return {
    id: row.id,
    title: row.title || null,
    description: row.description || null,
    event_date: row.event_date || null,
    district_id: row.district_id ?? null,
    venue: row.venue || null,
    address: row.address || null,
    ticket_url: row.ticket_url || row.ticketUrl || null,
    image_url: row.image_url || row.imageUrl || null,
    artist_id: row.artist_id ?? null,
    createdAt: row.created_at || row.createdAt || null
  };
}

/**
 * Helper: fetch the artist row for the currently authenticated user.
 * Returns the artist row or null if not found.
 */
async function getArtistForUser(userId) {
  const [rows] = await pool.query('SELECT * FROM artists WHERE user_id = ? LIMIT 1', [userId]);
  return rows && rows.length ? rows[0] : null;
}

exports.listPublicEvents = async (req, res, next) => {
  try {
    // Optional query filters: district, from, to, q
    const { district, from, to, q } = req.query;
    let sql = `SELECT e.*, a.display_name AS artist_display_name, a.photo_url AS artist_photo
               FROM events e
               LEFT JOIN artists a ON e.artist_id = a.id
               WHERE 1=1`;
    const params = [];
    if (district) {
      sql += ' AND e.district_id = ?'; params.push(district);
    }
    if (from) { sql += ' AND e.event_date >= ?'; params.push(from); }
    if (to) { sql += ' AND e.event_date <= ?'; params.push(to); }
    if (q) { sql += ' AND (e.title LIKE ? OR e.description LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    sql += ' ORDER BY e.event_date ASC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    const events = (rows || []).map(normalizeEventRow);
    return res.json(events);
  } catch (err) {
    next(err);
  }
};

exports.getEventDetail = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid event id' });

    const [rows] = await pool.query(
      `SELECT e.*, a.display_name AS artist_display_name, a.photo_url AS artist_photo
       FROM events e LEFT JOIN artists a ON e.artist_id = a.id WHERE e.id = ? LIMIT 1`,
      [id]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    const ev = normalizeEventRow(rows[0]);

    // include RSVP counts (optional)
    const [rRows] = await pool.query(
      `SELECT status, COUNT(*) AS cnt FROM rsvps WHERE event_id = ? GROUP BY status`,
      [id]
    );
    const counts = {};
    (rRows || []).forEach(r => { counts[r.status] = Number(r.cnt); });
    ev.rsvp_counts = counts;

    return res.json(ev);
  } catch (err) {
    next(err);
  }
};

exports.listEvents = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const artist = await getArtistForUser(userId);
    if (!artist) {
      return res.json([]); // no artist yet -> no events
    }

    const [rows] = await pool.query('SELECT * FROM events WHERE artist_id = ? ORDER BY event_date DESC', [artist.id]);
    const normalized = (rows || []).map(normalizeEventRow);
    return res.json(normalized);
  } catch (err) {
    next(err);
  }
};

exports.createEvent = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const artist = await getArtistForUser(userId);
    if (!artist) {
      return res.status(400).json({ error: 'You must create an artist profile before creating events.' });
    }

    // image handled by multer single('image') -> available as req.file
    const imageFile = req.file;
    const imageUrl = imageFile ? path.posix.join(UPLOADS_PREFIX, EVENT_IMAGE_SUBDIR, imageFile.filename) : null;

    // Gather fields from body
    const title = req.body.title ? String(req.body.title).trim() : null;
    const description = typeof req.body.description !== 'undefined' ? String(req.body.description) : null;
    const event_date = typeof req.body.event_date !== 'undefined' && req.body.event_date !== '' ? req.body.event_date : null;
    const district_id = typeof req.body.district_id !== 'undefined' && req.body.district_id !== '' ? Number(req.body.district_id) : null;
    const venue = typeof req.body.venue !== 'undefined' ? String(req.body.venue) : null;
    const address = typeof req.body.address !== 'undefined' ? String(req.body.address) : null;
    const ticket_url = typeof req.body.ticket_url !== 'undefined' ? String(req.body.ticket_url) : null;
    const lat = typeof req.body.lat !== 'undefined' ? (req.body.lat === '' ? null : Number(req.body.lat)) : null;
    const lng = typeof req.body.lng !== 'undefined' ? (req.body.lng === '' ? null : Number(req.body.lng)) : null;
    const capacity = typeof req.body.capacity !== 'undefined' ? (req.body.capacity === '' ? null : Number(req.body.capacity)) : null;

    if (!title) return res.status(400).json({ error: 'Event title is required' });

    // Detect existing columns in events table
    const [cols] = await pool.query('SHOW COLUMNS FROM events');
    const colNames = (cols || []).map(c => String(c.Field));

    const fields = [];
    const vals = [];

    if (colNames.includes('title')) { fields.push('title'); vals.push(title); }
    if (colNames.includes('description')) { fields.push('description'); vals.push(description); }
    if (colNames.includes('event_date')) { fields.push('event_date'); vals.push(event_date); }
    if (colNames.includes('district_id')) { fields.push('district_id'); vals.push(district_id); }
    if (colNames.includes('artist_id')) { fields.push('artist_id'); vals.push(artist.id); }

    if (venue && colNames.includes('venue')) { fields.push('venue'); vals.push(venue); }
    if (address && colNames.includes('address')) { fields.push('address'); vals.push(address); }
    if (ticket_url && colNames.includes('ticket_url')) { fields.push('ticket_url'); vals.push(ticket_url); }
    // image columns: image_url or photo_url etc.
    const imageCol = colNames.includes('image_url') ? 'image_url' : (colNames.includes('imageUrl') ? 'imageUrl' : (colNames.includes('photo_url') ? 'photo_url' : null));
    if (imageUrl && imageCol) { fields.push(imageCol); vals.push(imageUrl); }

    if (lat !== null && colNames.includes('lat')) { fields.push('lat'); vals.push(lat); }
    if (lng !== null && colNames.includes('lng')) { fields.push('lng'); vals.push(lng); }
    if (capacity !== null && colNames.includes('capacity')) { fields.push('capacity'); vals.push(capacity); }

    if (fields.length === 0) return res.status(500).json({ error: 'No writable columns found in events table' });

    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO events (${fields.join(', ')}) VALUES (${placeholders})`;
    const [result] = await pool.query(sql, vals);

    const [rows2] = await pool.query('SELECT * FROM events WHERE id = ? LIMIT 1', [result.insertId]);
    const ev = rows2[0] ? normalizeEventRow(rows2[0]) : null;
    return res.status(201).json(ev);
  } catch (err) {
    next(err);
  }
};

exports.updateEvent = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid event id' });

    // Get artist for user
    const artist = await getArtistForUser(userId);
    if (!artist) return res.status(403).json({ error: 'Artist profile not found or you are not authorized' });

    // Ensure event belongs to this artist
    const [existing] = await pool.query('SELECT * FROM events WHERE id = ? LIMIT 1', [id]);
    if (!existing || existing.length === 0) return res.status(404).json({ error: 'Event not found' });
    const evRow = existing[0];
    if (Number(evRow.artist_id) !== Number(artist.id)) {
      return res.status(403).json({ error: 'Not authorized to update this event' });
    }

    // image file (if uploaded)
    const imageFile = req.file;
    const imageUrl = imageFile ? path.posix.join(UPLOADS_PREFIX, EVENT_IMAGE_SUBDIR, imageFile.filename) : null;

    // gather potential updates:
    const updates = [];
    const vals = [];

    // detect columns
    const [cols] = await pool.query('SHOW COLUMNS FROM events');
    const colNames = (cols || []).map(c => String(c.Field));

    if (typeof req.body.title !== 'undefined' && colNames.includes('title')) { updates.push('title = ?'); vals.push(req.body.title); }
    if (typeof req.body.description !== 'undefined' && colNames.includes('description')) { updates.push('description = ?'); vals.push(req.body.description); }
    if (typeof req.body.event_date !== 'undefined' && colNames.includes('event_date')) { updates.push('event_date = ?'); vals.push(req.body.event_date); }
    if (typeof req.body.district_id !== 'undefined' && colNames.includes('district_id')) { updates.push('district_id = ?'); vals.push(req.body.district_id); }
    if (typeof req.body.venue !== 'undefined' && colNames.includes('venue')) { updates.push('venue = ?'); vals.push(req.body.venue); }
    if (typeof req.body.address !== 'undefined' && colNames.includes('address')) { updates.push('address = ?'); vals.push(req.body.address); }
    if (typeof req.body.ticket_url !== 'undefined' && colNames.includes('ticket_url')) { updates.push('ticket_url = ?'); vals.push(req.body.ticket_url); }

    // image column resolution
    const imageCol = colNames.includes('image_url') ? 'image_url' : (colNames.includes('imageUrl') ? 'imageUrl' : (colNames.includes('photo_url') ? 'photo_url' : null));
    if (imageUrl && imageCol) { updates.push(`${imageCol} = ?`); vals.push(imageUrl); }

    if (typeof req.body.lat !== 'undefined' && colNames.includes('lat')) { updates.push('lat = ?'); vals.push(req.body.lat === '' ? null : req.body.lat); }
    if (typeof req.body.lng !== 'undefined' && colNames.includes('lng')) { updates.push('lng = ?'); vals.push(req.body.lng === '' ? null : req.body.lng); }
    if (typeof req.body.capacity !== 'undefined' && colNames.includes('capacity')) { updates.push('capacity = ?'); vals.push(req.body.capacity === '' ? null : req.body.capacity); }

    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update or unsupported schema' });

    vals.push(id);
    const sql = `UPDATE events SET ${updates.join(', ')} WHERE id = ?`;
    await pool.query(sql, vals);

    const [rows2] = await pool.query('SELECT * FROM events WHERE id = ? LIMIT 1', [id]);
    const updated = rows2[0] ? normalizeEventRow(rows2[0]) : null;
    return res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid event id' });

    const artist = await getArtistForUser(userId);
    if (!artist) return res.status(403).json({ error: 'Artist profile not found or you are not authorized' });

    // ensure event belongs to this artist
    const [existing] = await pool.query('SELECT * FROM events WHERE id = ? LIMIT 1', [id]);
    if (!existing || existing.length === 0) return res.status(404).json({ error: 'Event not found' });
    if (Number(existing[0].artist_id) !== Number(artist.id)) {
      return res.status(403).json({ error: 'Not authorized to delete this event' });
    }

    await pool.query('DELETE FROM events WHERE id = ? AND artist_id = ?', [id, artist.id]);
    return res.json({ message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
};
