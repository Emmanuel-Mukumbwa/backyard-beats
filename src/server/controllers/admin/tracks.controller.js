// src/server/controllers/admin/tracks.controller.js
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
  if (type === 'trackArtwork') return path.posix.join(UPLOADS_PREFIX, 'tracks', 'artwork', v);
  if (type === 'trackFile') return path.posix.join(UPLOADS_PREFIX, 'tracks', v);
  return path.posix.join(UPLOADS_PREFIX, v);
}

function makeAbsoluteUrl(relOrAbs, req) {
  if (!relOrAbs) return null;
  if (/^https?:\/\//i.test(relOrAbs)) return relOrAbs;
  // ensure leading slash
  const rel = relOrAbs.startsWith('/') ? relOrAbs : `/${relOrAbs}`;
  const base = `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
  return `${base}${rel}`;
}

/**
 * GET /admin/pending/tracks
 * Tracks pending approval: is_approved = 0 AND is_rejected = 0
 */
exports.pendingTracks = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id,
              t.title,
              t.preview_url AS previewUrl,
              t.preview_artwork AS preview_artwork,
              t.duration,
              t.genre,
              t.release_date,
              t.created_at,
              t.artist_id,
              a.display_name AS artist,
              COALESCE(t.is_approved,0) AS is_approved,
              COALESCE(t.is_rejected,0) AS is_rejected,
              t.approved_at, t.rejected_at, t.rejection_reason
       FROM tracks t
       LEFT JOIN artists a ON t.artist_id = a.id
       WHERE COALESCE(t.is_approved,0) = 0 AND COALESCE(t.is_rejected,0) = 0
       ORDER BY t.created_at DESC
       LIMIT 500`
    );

    const mapped = rows.map(r => {
      const rawPreview = buildPublicUrl(r.previewUrl, 'trackFile'); // returns '/uploads/...' or path
      const rawArtwork = buildPublicUrl(r.preview_artwork, 'trackArtwork'); // returns '/uploads/...' or path

      return {
        id: r.id,
        title: r.title,
        // absolute URLs for frontend convenience:
        previewUrl: makeAbsoluteUrl(rawPreview, req),
        preview_artwork: makeAbsoluteUrl(rawArtwork, req),
        duration: r.duration,
        genre: r.genre,
        release_date: r.release_date,
        created_at: r.created_at,
        artist_id: r.artist_id,
        artist: r.artist,
        is_approved: !!r.is_approved,
        is_rejected: !!r.is_rejected,
        approved_at: r.approved_at,
        rejected_at: r.rejected_at,
        rejection_reason: r.rejection_reason
      };
    });

    res.json({ pending: mapped });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/pending/tracks/:id/approve
 */
exports.approveTrack = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid track id' });

    const approvedBy = req.user?.id || null;

    await pool.query(
      `UPDATE tracks
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

    const [rows] = await pool.query('SELECT id, title, preview_url AS previewUrl, preview_artwork AS preview_artwork FROM tracks WHERE id = ? LIMIT 1', [id]);
    const rawPreview = rows[0] ? buildPublicUrl(rows[0].previewUrl, 'trackFile') : null;
    const rawArtwork = rows[0] ? buildPublicUrl(rows[0].preview_artwork, 'trackArtwork') : null;

    const track = rows[0] ? {
      id: rows[0].id,
      title: rows[0].title,
      previewUrl: makeAbsoluteUrl(rawPreview, req),
      preview_artwork: makeAbsoluteUrl(rawArtwork, req)
    } : null;

    res.json({ success: true, track });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/pending/tracks/:id/reject
 * Body: { reason?: string, delete?: boolean }
 */
exports.rejectTrack = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid track id' });

    const rejectedBy = req.user?.id || null;
    const reason = (req.body && req.body.reason) ? String(req.body.reason).slice(0, 512) : null;
    const deleteOnReject = !!req.body.delete;

    if (deleteOnReject) {
      await pool.query('DELETE FROM tracks WHERE id = ?', [id]);
      return res.json({ success: true, deleted: true });
    }

    await pool.query(
      `UPDATE tracks
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