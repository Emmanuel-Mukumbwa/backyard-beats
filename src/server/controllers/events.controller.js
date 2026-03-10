// File: src/server/controllers/events.controller.js
const pool = require('../db').pool;
const path = require('path');

const UPLOADS_PREFIX = process.env.UPLOADS_PREFIX || '/uploads';
const EVENT_IMAGE_SUBDIR = path.posix.join('events', 'images');
const UPLOAD_BASE = path.join(__dirname, '..', 'uploads');

function publicUrlFromFilePath(filePath) {
  if (!filePath) return null;
  try {
    const rel = path.relative(UPLOAD_BASE, filePath);
    if (!rel) return null;
    const urlPath = rel.split(path.sep).join('/');
    return path.posix.join(UPLOADS_PREFIX, urlPath);
  } catch (err) {
    return null;
  }
}

function normalizeEventRow(row) {
  return {
    id: row.id,
    title: row.title || null,
    description: row.description || null,
    event_date: row.event_date || null,
    district_id: row.district_id ?? null,
    district_name: row.district_name || null,
    venue: row.venue || null,
    address: row.address || null,
    ticket_url: row.ticket_url || row.ticketUrl || null,
    image_url: row.image_url || row.imageUrl || row.photo_url || null,
    artist_id: row.artist_id ?? null,
    createdAt: row.created_at || row.createdAt || null,
    // include approval meta for dashboard
    is_approved: !!row.is_approved,
    is_rejected: !!row.is_rejected,
    rejection_reason: row.rejection_reason || null,
    approved_at: row.approved_at || null,
    rejected_at: row.rejected_at || null
  };
}

function isAdminIncludeUnapproved(req) {
  return !!(req.user && req.user.role === 'admin' && req.query.include_unapproved === '1');
}

async function getArtistForUser(userId) {
  const [rows] = await pool.query('SELECT * FROM artists WHERE user_id = ? LIMIT 1', [userId]);
  return rows && rows.length ? rows[0] : null;
}

async function getUserRow(userId) {
  if (!userId) return null;
  const [rows] = await pool.query('SELECT id, username, banned, deleted_at FROM users WHERE id = ? LIMIT 1', [userId]);
  return (rows && rows[0]) || null;
}

/**
 * Public events listing — only returns approved events from approved artists and active users
 */
exports.listPublicEvents = async (req, res, next) => {
  try {
    const { district, from, to, q } = req.query;
    const adminOverride = isAdminIncludeUnapproved(req);

    let sql = `
      SELECT e.*,
             d.name AS district_name,
             a.display_name AS artist_display_name,
             a.photo_url AS artist_photo,
             a.is_approved AS artist_is_approved,
             a.is_rejected AS artist_is_rejected,
             u.deleted_at AS user_deleted_at,
             u.banned AS user_banned
      FROM events e
      LEFT JOIN districts d ON e.district_id = d.id
      LEFT JOIN artists a ON e.artist_id = a.id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (district) { sql += ' AND e.district_id = ?'; params.push(district); }
    if (from) { sql += ' AND e.event_date >= ?'; params.push(from); }
    if (to) { sql += ' AND e.event_date <= ?'; params.push(to); }
    if (q) { sql += ' AND (e.title LIKE ? OR e.description LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }

    if (!adminOverride) {
      sql += ' AND e.is_approved = 1';
      sql += ' AND a.is_approved = 1';
      sql += ' AND a.is_rejected = 0';
      sql += ' AND u.deleted_at IS NULL';
      sql += ' AND u.banned = 0';
    }

    sql += ' ORDER BY e.event_date ASC LIMIT 500';

    const [rows] = await pool.query(sql, params);

    const events = (rows || []).map(r => {
      const ev = normalizeEventRow(r);
      if (adminOverride) {
        ev.artist = {
          display_name: r.artist_display_name,
          photo: r.artist_photo,
          is_approved: !!r.artist_is_approved,
          is_rejected: !!r.artist_is_rejected
        };
      }
      return ev;
    });
    return res.json(events);
  } catch (err) {
    next(err);
  }
};

exports.getEventDetail = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid event id' });

    const adminOverride = isAdminIncludeUnapproved(req);

    const [rows] = await pool.query(
      `SELECT e.*,
              d.name AS district_name,
              a.display_name AS artist_display_name,
              a.photo_url AS artist_photo,
              a.is_approved AS artist_is_approved,
              a.is_rejected AS artist_is_rejected,
              u.deleted_at AS user_deleted_at,
              u.banned AS user_banned
       FROM events e
       LEFT JOIN districts d ON e.district_id = d.id
       LEFT JOIN artists a ON e.artist_id = a.id
       LEFT JOIN users u ON a.user_id = u.id
       WHERE e.id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    const row = rows[0];

    // Visibility checks for public detail
    if (!adminOverride) {
      if (!row.is_approved) {
        return res.status(403).json({ status: 'pending', message: 'Event awaiting approval.' });
      }
      if (!row.artist_is_approved) {
        return res.status(403).json({ status: 'pending', message: 'Artist profile not approved.' });
      }
      if (row.artist_is_rejected) {
        return res.status(403).json({ status: 'rejected', message: 'Artist profile rejected.' });
      }
      if (row.user_deleted_at) {
        return res.status(410).json({ status: 'deleted', message: 'Artist account deleted.' });
      }
      if (row.user_banned) {
        return res.status(403).json({ status: 'banned', message: 'Artist account banned.' });
      }
    }

    const ev = normalizeEventRow(row);

    // include RSVP counts (optional)
    const [rRows] = await pool.query(
      `SELECT status, COUNT(*) AS cnt FROM rsvps WHERE event_id = ? GROUP BY status`,
      [id]
    );
    const counts = {};
    (rRows || []).forEach(r => { counts[r.status] = Number(r.cnt); });
    ev.rsvp_counts = counts;

    if (adminOverride) {
      ev.artist = {
        display_name: row.artist_display_name,
        photo: row.artist_photo,
        is_approved: !!row.artist_is_approved,
        is_rejected: !!row.artist_is_rejected
      };
    }

    return res.json(ev);
  } catch (err) {
    next(err);
  }
};

exports.listEvents = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const userRow = await getUserRow(userId);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const artist = await getArtistForUser(userId);
    if (!artist) return res.json([]); // not an artist

    // Allow owner to view their events even if artist is pending/rejected.
    // Keep adminOverride for admins to view everything via query param.
    const adminOverride = isAdminIncludeUnapproved(req);

    const [rows] = await pool.query(
      `SELECT e.*, d.name AS district_name FROM events e LEFT JOIN districts d ON e.district_id = d.id WHERE e.artist_id = ? ORDER BY event_date DESC`,
      [artist.id]
    );
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

    const userRow = await getUserRow(userId);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const artist = await getArtistForUser(userId);
    if (!artist) return res.status(400).json({ error: 'You must create an artist profile before creating events.' });

    const adminOverride = isAdminIncludeUnapproved(req);
    if (!adminOverride) {
      if (artist.is_rejected) return res.status(403).json({ status: 'rejected', message: 'Artist profile rejected.' });
      if (!artist.is_approved) return res.status(403).json({ status: 'pending_verification', message: 'Artist profile pending verification.' });
    }

    const imageFile = req.file;
    const imageUrl = imageFile ? publicUrlFromFilePath(imageFile.path) : null;

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

    const userRow = await getUserRow(userId);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid event id' });

    const artist = await getArtistForUser(userId);
    if (!artist) return res.status(403).json({ error: 'Artist profile not found or you are not authorized' });

    const [existing] = await pool.query('SELECT * FROM events WHERE id = ? LIMIT 1', [id]);
    if (!existing || existing.length === 0) return res.status(404).json({ error: 'Event not found' });
    const evRow = existing[0];
    if (Number(evRow.artist_id) !== Number(artist.id) && !(req.user && req.user.role === 'admin')) {
      return res.status(403).json({ error: 'Not authorized to update this event' });
    }

    const adminOverride = isAdminIncludeUnapproved(req);
    if (!adminOverride) {
      if (artist.is_rejected) return res.status(403).json({ status: 'rejected', message: 'Artist profile rejected.' });
      if (!artist.is_approved) return res.status(403).json({ status: 'pending_verification', message: 'Artist profile pending verification.' });
    }

    const imageFile = req.file;
    const imageUrl = imageFile ? publicUrlFromFilePath(imageFile.path) : null;

    const updates = [];
    const vals = [];

    const [cols] = await pool.query('SHOW COLUMNS FROM events');
    const colNames = (cols || []).map(c => String(c.Field));

    if (typeof req.body.title !== 'undefined' && colNames.includes('title')) { updates.push('title = ?'); vals.push(req.body.title); }
    if (typeof req.body.description !== 'undefined' && colNames.includes('description')) { updates.push('description = ?'); vals.push(req.body.description); }
    if (typeof req.body.event_date !== 'undefined' && colNames.includes('event_date')) { updates.push('event_date = ?'); vals.push(req.body.event_date); }
    if (typeof req.body.district_id !== 'undefined' && colNames.includes('district_id')) { updates.push('district_id = ?'); vals.push(req.body.district_id); }
    if (typeof req.body.venue !== 'undefined' && colNames.includes('venue')) { updates.push('venue = ?'); vals.push(req.body.venue); }
    if (typeof req.body.address !== 'undefined' && colNames.includes('address')) { updates.push('address = ?'); vals.push(req.body.address); }
    if (typeof req.body.ticket_url !== 'undefined' && colNames.includes('ticket_url')) { updates.push('ticket_url = ?'); vals.push(req.body.ticket_url); }

    const imageCol = colNames.includes('image_url') ? 'image_url' : (colNames.includes('imageUrl') ? 'imageUrl' : (colNames.includes('photo_url') ? 'photo_url' : null));
    if (imageUrl && imageCol) { updates.push(`${imageCol} = ?`); vals.push(imageUrl); }

    if (typeof req.body.lat !== 'undefined' && colNames.includes('lat')) { updates.push('lat = ?'); vals.push(req.body.lat === '' ? null : req.body.lat); }
    if (typeof req.body.lng !== 'undefined' && colNames.includes('lng')) { updates.push('lng = ?'); vals.push(req.body.lng === '' ? null : req.body.lng); }
    if (typeof req.body.capacity !== 'undefined' && colNames.includes('capacity')) { updates.push('capacity = ?'); vals.push(req.body.capacity === '' ? null : req.body.capacity); }

    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update or unsupported schema' });

    vals.push(id);
    const sql = `UPDATE events SET ${updates.join(', ')} WHERE id = ?`;
    await pool.query(sql, vals);

    // If a non-admin user edited an already-approved event, revert it to pending approval.
    // Admin edits (adminOverride === true) do not change approval status automatically.
    try {
      const wasApproved = Number(evRow.is_approved) === 1;
      if (wasApproved && !adminOverride) {
        await pool.query(
          `UPDATE events SET is_approved = 0, is_rejected = 0, approved_at = NULL, rejected_at = NULL, rejection_reason = NULL WHERE id = ?`,
          [id]
        );
      }
    } catch (e) {
      // Non-fatal: log and continue; we still return the updated row below.
      // If you have a logger, replace console.error with your logger.
      console.error('Failed to reset approval state after edit:', e);
    }

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

    const userRow = await getUserRow(userId);
    if (!userRow) return res.status(401).json({ error: 'User not found' });
    if (userRow.deleted_at) return res.status(410).json({ status: 'deleted', message: 'Account deleted' });
    if (userRow.banned) return res.status(403).json({ status: 'banned', message: 'Account banned' });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid event id' });

    const artist = await getArtistForUser(userId);
    if (!artist) return res.status(403).json({ error: 'Artist profile not found or you are not authorized' });

    const [existing] = await pool.query('SELECT * FROM events WHERE id = ? LIMIT 1', [id]);
    if (!existing || existing.length === 0) return res.status(404).json({ error: 'Event not found' });
    if (Number(existing[0].artist_id) !== Number(artist.id) && !(req.user && req.user.role === 'admin')) {
      return res.status(403).json({ error: 'Not authorized to delete this event' });
    }

    await pool.query('DELETE FROM events WHERE id = ? AND artist_id = ?', [id, artist.id]);
    return res.json({ message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
};