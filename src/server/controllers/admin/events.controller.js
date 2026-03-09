// src/server/controllers/admin/events.controller.js
const pool = require('../../db').pool;
const path = require('path');

const UPLOADS_PREFIX = process.env.UPLOADS_PREFIX || '/uploads';

function buildPublicUrl(value, type = 'generic') {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith(UPLOADS_PREFIX) || v.startsWith('/uploads')) return v;
  if (v.includes('/')) return path.posix.join(UPLOADS_PREFIX, v);
  if (type === 'eventImage') return path.posix.join(UPLOADS_PREFIX, 'events', 'images', v);
  return path.posix.join(UPLOADS_PREFIX, v);
}

function makeAbsoluteUrl(relOrAbs, req) {
  if (!relOrAbs) return null;
  if (/^https?:\/\//i.test(relOrAbs)) return relOrAbs;
  const rel = relOrAbs.startsWith('/') ? relOrAbs : `/${relOrAbs}`;
  const base = `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
  return `${base}${rel}`;
}

/**
 * GET /admin/pending/events
 * Pending events: is_approved = 0 AND is_rejected = 0
 */
exports.pendingEvents = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.id, e.title, e.description, e.event_date, e.artist_id, a.display_name AS artist,
              e.district_id, d.name AS district, e.venue, e.address, e.ticket_url, e.image_url,
              e.lat, e.lng, e.capacity,
              COALESCE(e.is_approved,0) AS is_approved, COALESCE(e.is_rejected,0) AS is_rejected,
              e.approved_at, e.rejected_at, e.rejection_reason, e.created_at
       FROM events e
       LEFT JOIN artists a ON e.artist_id = a.id
       LEFT JOIN districts d ON e.district_id = d.id
       WHERE COALESCE(e.is_approved,0) = 0 AND COALESCE(e.is_rejected,0) = 0
       ORDER BY e.created_at DESC
       LIMIT 500`
    );

    const mapped = rows.map(r => {
      const rawImage = buildPublicUrl(r.image_url, 'eventImage');
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        event_date: r.event_date,
        artist_id: r.artist_id,
        artist: r.artist,
        district_id: r.district_id,
        district: r.district,
        venue: r.venue,
        address: r.address,
        ticket_url: r.ticket_url,
        image_url: makeAbsoluteUrl(rawImage, req),
        lat: r.lat,
        lng: r.lng,
        capacity: r.capacity,
        is_approved: !!r.is_approved,
        is_rejected: !!r.is_rejected,
        approved_at: r.approved_at,
        rejected_at: r.rejected_at,
        rejection_reason: r.rejection_reason,
        created_at: r.created_at
      };
    });

    res.json({ pending: mapped });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/pending/events/:id/approve
 */
exports.approveEvent = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid event id' });

    const approvedBy = req.user?.id || null;

    await pool.query(
      `UPDATE events
       SET is_approved = 1,
           is_rejected = 0,
           approved_at = NOW(),
           approved_by = ?,
           rejected_at = NULL,
           rejected_by = NULL,
           rejection_reason = NULL
       WHERE id = ?`,
      [approvedBy, id]
    );

    const [rows] = await pool.query('SELECT id, title, event_date, image_url FROM events WHERE id = ? LIMIT 1', [id]);
    const rawImage = rows[0] ? buildPublicUrl(rows[0].image_url, 'eventImage') : null;
    const ev = rows[0] ? {
      id: rows[0].id,
      title: rows[0].title,
      event_date: rows[0].event_date,
      image_url: makeAbsoluteUrl(rawImage, req)
    } : null;

    res.json({ success: true, event: ev });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/pending/events/:id/reject
 * Body: { reason?: string, delete?: boolean }
 */
exports.rejectEvent = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid event id' });

    const rejectedBy = req.user?.id || null;
    const reason = (req.body && req.body.reason) ? String(req.body.reason).slice(0, 512) : null;
    const deleteOnReject = !!req.body.delete;

    if (deleteOnReject) {
      await pool.query('DELETE FROM events WHERE id = ?', [id]);
      return res.json({ success: true, deleted: true });
    }

    await pool.query(
      `UPDATE events
       SET is_rejected = 1,
           is_approved = 0,
           rejected_at = NOW(),
           rejected_by = ?,
           rejection_reason = ?
       WHERE id = ?`,
      [rejectedBy, reason, id]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};