// src/server/controllers/admin/artists.controller.js
const pool = require('../../db').pool;
const path = require('path');

const UPLOADS_PREFIX = process.env.UPLOADS_PREFIX || '/uploads';

/**
 * Helper to turn stored filename/path into a public URL served from /uploads
 * - if value is null -> return null
 * - if value already starts with http or /uploads -> return as-is
 * - if value contains a slash -> assume it's a relative uploads path and prefix /uploads
 * - otherwise infer folder by type: 'artist' -> artists/photos/<value>
 */
function buildPublicUrl(value, type = 'generic') {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith(UPLOADS_PREFIX) || v.startsWith('/uploads')) return v;
  // If stored value already contains a path like 'artists/photos/img-...' or 'tracks/...' then prefix /uploads
  if (v.includes('/')) {
    return path.posix.join(UPLOADS_PREFIX, v);
  }
  // fallback by type
  if (type === 'artist') return path.posix.join(UPLOADS_PREFIX, 'artists', 'photos', v);
  if (type === 'trackArtwork') return path.posix.join(UPLOADS_PREFIX, 'tracks', 'artwork', v);
  if (type === 'trackFile') return path.posix.join(UPLOADS_PREFIX, 'tracks', v);
  if (type === 'eventImage') return path.posix.join(UPLOADS_PREFIX, 'events', 'images', v);
  return path.posix.join(UPLOADS_PREFIX, v);
}

/**
 * GET /admin/pending/artists
 * Returns artists that need approval:
 *  is_approved = 0 AND is_rejected = 0 => pending
 *
 * NOTE: some schemas (yours) store district on users table, so we join users -> districts.
 */
exports.pendingArtists = async (req, res, next) => {
  try {
    const include = String(req.query.include || 'pending').toLowerCase();

    let whereClause = `WHERE a.is_approved = 0 AND a.is_rejected = 0`;
    if (include === 'all') {
      whereClause = '';
    } else if (include === 'approved') {
      whereClause = `WHERE a.is_approved = 1`;
    } else if (include === 'rejected') {
      whereClause = `WHERE a.is_rejected = 1`;
    }

    const [rows] = await pool.query(
      `SELECT
         a.id,
         a.display_name AS displayName,
         a.bio,
         a.photo_url AS photoUrl,
         a.lat, a.lng,
         u.id AS user_id,
         u.username AS username,
         u.deleted_at AS user_deleted_at,
         u.banned AS user_banned,
         u.district_id AS district_id,
         d.name AS district_name,
         a.avg_rating,
         a.follower_count,
         a.is_approved, a.is_rejected,
         a.approved_at, a.rejected_at,
         a.approved_by, a.rejected_by,
         a.rejection_reason
       FROM artists a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN districts d ON u.district_id = d.id
       ${whereClause}
       ORDER BY a.id DESC
       LIMIT 500`
    );

    const mapped = rows.map(r => ({
      id: r.id,
      displayName: r.displayName,
      bio: r.bio,
      photoUrl: buildPublicUrl(r.photoUrl, 'artist'),
      lat: r.lat,
      lng: r.lng,
      district_id: r.district_id,
      district_name: r.district_name || null,
      avg_rating: r.avg_rating,
      follower_count: r.follower_count,
      user: {
        id: r.user_id,
        username: r.username,
        deleted_at: r.user_deleted_at,
        banned: !!r.user_banned
      },
      is_approved: !!r.is_approved,
      is_rejected: !!r.is_rejected,
      approved_at: r.approved_at,
      rejected_at: r.rejected_at,
      approved_by: r.approved_by,
      rejected_by: r.rejected_by,
      rejection_reason: r.rejection_reason
    }));

    res.json({ pending: mapped });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/pending/artists/:id/approve
 */
exports.approveArtist = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid artist id' });

    const approvedBy = req.user?.id || null;

    await pool.query(
      `UPDATE artists
       SET is_approved = 1,
           is_rejected = 0,
           approved_at = NOW(),
           approved_by = ?,
           rejection_reason = NULL,
           rejected_at = NULL,
           rejected_by = NULL
       WHERE id = ?`,
      [approvedBy, id]
    );

    const [rows] = await pool.query(
      `SELECT a.id,
              a.display_name AS displayName,
              a.photo_url AS photoUrl,
              u.id AS user_id,
              u.username AS username,
              u.district_id AS district_id,
              d.name AS district_name
       FROM artists a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN districts d ON u.district_id = d.id
       WHERE a.id = ?
       LIMIT 1`,
      [id]
    );

    const artist = rows[0] ? {
      id: rows[0].id,
      displayName: rows[0].displayName,
      photoUrl: buildPublicUrl(rows[0].photoUrl, 'artist'),
      user: {
        id: rows[0].user_id,
        username: rows[0].username
      },
      district_id: rows[0].district_id,
      district_name: rows[0].district_name || null
    } : null;

    res.json({ success: true, artist });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/pending/artists/:id/reject
 * Body: { reason?: string, delete?: boolean }
 */
exports.rejectArtist = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid artist id' });

    const rejectedBy = req.user?.id || null;
    const reason = (req.body && req.body.reason) ? String(req.body.reason).slice(0, 512) : null;
    const deleteOnReject = !!req.body.delete;

    if (deleteOnReject) {
      await pool.query('DELETE FROM artists WHERE id = ?', [id]);
      return res.json({ success: true, deleted: true });
    }

    await pool.query(
      `UPDATE artists
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

/**
 * POST /admin/pending/artists/:id/undo
 * Resets approval/rejection flags and clears metadata for an artist.
 */
exports.undoArtist = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid artist id' });

    // Ensure artist exists
    const [existsRows] = await pool.query('SELECT id FROM artists WHERE id = ? LIMIT 1', [id]);
    if (!existsRows || existsRows.length === 0) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    await pool.query(
      `UPDATE artists
       SET is_approved = 0,
           is_rejected = 0,
           approved_at = NULL,
           rejected_at = NULL,
           approved_by = NULL,
           rejected_by = NULL,
           rejection_reason = NULL
       WHERE id = ?`,
      [id]
    );

    const [rows] = await pool.query(
      `SELECT a.id,
              a.display_name AS displayName,
              a.bio,
              a.photo_url AS photoUrl,
              u.id AS user_id,
              u.username AS username,
              u.district_id AS district_id,
              d.name AS district_name,
              a.avg_rating,
              a.follower_count
       FROM artists a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN districts d ON u.district_id = d.id
       WHERE a.id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Artist not found after undo' });
    }

    const artist = {
      id: rows[0].id,
      displayName: rows[0].displayName,
      bio: rows[0].bio,
      photoUrl: buildPublicUrl(rows[0].photoUrl, 'artist'),
      user: {
        id: rows[0].user_id,
        username: rows[0].username
      },
      district_id: rows[0].district_id,
      district_name: rows[0].district_name || null,
      avg_rating: rows[0].avg_rating,
      follower_count: rows[0].follower_count
    };

    res.json({ success: true, artist });
  } catch (err) {
    next(err);
  }
};