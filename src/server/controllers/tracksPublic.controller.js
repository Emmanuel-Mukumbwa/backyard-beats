// src/server/controllers/tracksPublic.controller.js
const pool = require('../db').pool;
const path = require('path');

const UPLOADS_PREFIX = process.env.UPLOADS_PREFIX || '/uploads';

/**
 * Helper: turn stored DB value into a public path under /uploads (or return absolute URL if already absolute)
 */
function buildPublicUrl(value, type = 'generic') {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith(UPLOADS_PREFIX) || v.startsWith('/uploads')) return v;
  if (v.includes('/')) {
    // Already a relative path like 'tracks/artwork/img.jpg' or 'artists/photos/img.jpg'
    return path.posix.join(UPLOADS_PREFIX, v);
  }
  // fallback by type
  if (type === 'trackArtwork') return path.posix.join(UPLOADS_PREFIX, 'tracks', 'artwork', v);
  if (type === 'trackFile') return path.posix.join(UPLOADS_PREFIX, 'tracks', v);
  if (type === 'artist') return path.posix.join(UPLOADS_PREFIX, 'artists', 'photos', v);
  if (type === 'eventImage') return path.posix.join(UPLOADS_PREFIX, 'events', 'images', v);
  return path.posix.join(UPLOADS_PREFIX, v);
}

/**
 * Convert /uploads/relative (or relative) to absolute URL using request host/protocol
 */
function makeAbsoluteUrl(relOrAbs, req) {
  if (!relOrAbs) return null;
  if (/^https?:\/\//i.test(relOrAbs)) return relOrAbs;
  // ensure leading slash
  const rel = relOrAbs.startsWith('/') ? relOrAbs : `/${relOrAbs}`;
  const base = `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
  return `${base}${rel}`;
}

/**
 * Helper to run count + items for pagination
 * queryItemsSql must include placeholders for LIMIT and OFFSET as the last two params
 */
async function runPaginated(queryCountSql, queryItemsSql, params = [], page = 1, limit = 12) {
  const offset = (page - 1) * limit;
  // count
  const [countRows] = await pool.query(queryCountSql, params);
  const total = countRows && countRows[0] && (countRows[0].total || countRows[0].cnt) ? Number(countRows[0].total || countRows[0].cnt) : 0;
  // items
  const [rows] = await pool.query(queryItemsSql, [...params, limit, offset]);
  return { total, rows };
}

/**
 * GET /public/tracks/new-releases?limit=12&page=1
 */
exports.getNewReleases = async (req, res, next) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 12);
    const page = Math.max(1, Number(req.query.page) || 1);

    const countSql = `
      SELECT COUNT(1) AS total
      FROM tracks t
      LEFT JOIN artists a ON t.artist_id = a.id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE t.is_approved = 1
        AND a.is_approved = 1
        AND a.is_rejected = 0
        AND u.deleted_at IS NULL
        AND u.banned = 0
    `;

    const itemsSql = `
      SELECT
        t.id,
        t.title,
        t.preview_url,
        t.preview_artwork,
        t.duration,
        t.genre,
        t.release_date,
        t.created_at,
        a.id AS artist_id,
        a.display_name AS artist_name
      FROM tracks t
      LEFT JOIN artists a ON t.artist_id = a.id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE t.is_approved = 1
        AND a.is_approved = 1 
        AND a.is_rejected = 0
        AND u.deleted_at IS NULL
        AND u.banned = 0
      ORDER BY COALESCE(t.release_date, t.created_at) DESC
      LIMIT ? OFFSET ?
    `;

    const { total, rows } = await runPaginated(countSql, itemsSql, [], page, limit);

    const items = (rows || []).map(r => {
      const rawPreview = buildPublicUrl(r.preview_url, 'trackFile');
      const rawArtwork = buildPublicUrl(r.preview_artwork, 'trackArtwork');
      return {
        id: r.id,
        title: r.title,
        preview_url: makeAbsoluteUrl(rawPreview, req),
        artwork_url: makeAbsoluteUrl(rawArtwork, req),
        duration: r.duration,
        genre: r.genre,
        release_date: r.release_date ? (new Date(r.release_date).toISOString().slice(0,10)) : null,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
        artist: {
          id: r.artist_id,
          display_name: r.artist_name
        }
      };
    });

    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /public/tracks/most-played?limit=12&page=1
 */
exports.getMostPlayed = async (req, res, next) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 12);
    const page = Math.max(1, Number(req.query.page) || 1);

    const countSql = `
      SELECT COUNT(1) AS total
      FROM (
        SELECT t.id
        FROM tracks t
        LEFT JOIN artists a ON t.artist_id = a.id
        LEFT JOIN users u ON a.user_id = u.id
        WHERE t.is_approved = 1
          AND a.is_approved = 1
          AND a.is_rejected = 0
          AND u.deleted_at IS NULL
          AND u.banned = 0
        GROUP BY t.id
      ) x
    `;

    const itemsSql = `
      SELECT
        t.id,
        t.title,
        t.preview_url,
        t.preview_artwork,
        t.duration,
        t.genre,
        t.release_date,
        t.created_at,
        a.id AS artist_id,
        a.display_name AS artist_name,
        COUNT(l.id) AS plays
      FROM tracks t
      LEFT JOIN artists a ON t.artist_id = a.id
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN listens l ON l.track_id = t.id
      WHERE t.is_approved = 1
        AND a.is_approved = 1
        AND a.is_rejected = 0
        AND u.deleted_at IS NULL
        AND u.banned = 0
      GROUP BY t.id
      ORDER BY plays DESC, COALESCE(t.release_date, t.created_at) DESC
      LIMIT ? OFFSET ?
    `;

    const { total, rows } = await runPaginated(countSql, itemsSql, [], page, limit);

    const items = (rows || []).map(r => {
      const rawPreview = buildPublicUrl(r.preview_url, 'trackFile');
      const rawArtwork = buildPublicUrl(r.preview_artwork, 'trackArtwork');
      return {
        id: r.id,
        title: r.title,
        preview_url: makeAbsoluteUrl(rawPreview, req),
        download_url: makeAbsoluteUrl(rawPreview, req), // same file can be used for download
        artwork_url: makeAbsoluteUrl(rawArtwork, req),
        duration: r.duration,
        genre: r.genre,
        release_date: r.release_date ? (new Date(r.release_date).toISOString().slice(0,10)) : null,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
        plays: Number(r.plays || 0),
        artist: {
          id: r.artist_id,
          display_name: r.artist_name
        }
      };
    });

    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
};

// Backwards-compatible alias: /public/tracks/recent should behave like new-releases
exports.getRecentTracks = exports.getNewReleases;