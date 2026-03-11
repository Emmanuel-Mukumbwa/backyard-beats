// src/server/controllers/artists.controller.js
const pool = require('../db').pool;

/**
 * Helper: isAdminIncludeUnapproved
 * Returns true if current request is from an authenticated admin & explicitly asked to include unapproved
 */
function isAdminIncludeUnapproved(req) {
  return !!(req.user && req.user.role === 'admin' && req.query.include_unapproved === '1');
}

/**
 * Normalize boolean values from DB (0/1 or null)
 */
function bool(v) {
  return !!v;
}

/**
 * GET /artists
 * Optional query params:
 *   - district (id)         -> filters by users.district_id
 *   - q (search by display_name)
 *   - include_unapproved=1  -> only for admin
 *   - limit                 -> optional limit (max 500)
 *   - offset                -> optional offset
 *
 * By default only returns approved artists whose account is not deleted and not banned.
 *
 * Returns genre_names and mood_names (comma-separated -> array) to help frontend display badges.
 * Also returns tracks_count and approved_tracks_count.
 */
exports.listArtists = async (req, res, next) => {
  try {
    const params = [];
    let where = 'WHERE 1=1';

    const adminOverride = isAdminIncludeUnapproved(req);

    // Search by district (uses users.district_id)
    if (req.query.district) {
      const districtId = Number(req.query.district);
      if (!Number.isInteger(districtId)) {
        return res.status(400).json({ error: 'Invalid district id' });
      }
      where += ' AND u.district_id = ?';
      params.push(districtId);
    }

    // Search by name (display_name)
    if (req.query.q) {
      where += ' AND a.display_name LIKE ?';
      params.push(`%${req.query.q}%`);
    }

    // Default visibility constraints (unless admin override)
    if (!adminOverride) {
      where += ' AND a.is_approved = 1 AND a.is_rejected = 0';
      // Ensure associated user account is active (not soft-deleted and not banned)
      where += ' AND u.deleted_at IS NULL AND u.banned = 0';
    }

    // Pagination / limit (safe caps)
    const maxLimit = 500;
    let limit = 200;
    if (req.query.limit) {
      const qlim = Number(req.query.limit);
      if (Number.isInteger(qlim) && qlim > 0) limit = Math.min(qlim, maxLimit);
    }
    let offset = 0;
    if (req.query.offset) {
      const qoff = Number(req.query.offset);
      if (Number.isInteger(qoff) && qoff >= 0) offset = qoff;
    }

    /**
     * NOTE: We left the genre/mood joins in place and add a LEFT JOIN to tracks
     * for counts. We use COUNT(DISTINCT ...) to avoid inflated counts due to
     * the other joins.
     */
    const sql = `
      SELECT
        a.*,
        u.username,
        u.banned,
        u.deleted_at,
        u.district_id AS user_district_id,
        d.name AS district_name,
        GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR ',') AS genre_names,
        GROUP_CONCAT(DISTINCT m.name ORDER BY m.name SEPARATOR ',') AS mood_names,
        COUNT(DISTINCT t.id) AS tracks_count,
        COUNT(DISTINCT CASE WHEN (t.is_approved = 1 AND t.is_rejected = 0) THEN t.id END) AS approved_tracks_count
      FROM artists a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN districts d ON u.district_id = d.id
      LEFT JOIN artist_genres ag ON ag.artist_id = a.id
      LEFT JOIN genres g ON ag.genre_id = g.id
      LEFT JOIN artist_moods am ON am.artist_id = a.id
      LEFT JOIN moods m ON am.mood_id = m.id
      LEFT JOIN tracks t ON t.artist_id = a.id
      ${where}
      GROUP BY a.id
      ORDER BY a.id DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);

    const result = (rows || []).map(r => {
      const status = r.is_approved ? 'approved' : (r.is_rejected ? 'rejected' : 'pending');

      // genre_names & mood_names -> arrays
      const genres = r.genre_names ? String(r.genre_names).split(',').map(s => s.trim()).filter(Boolean) : [];
      const moods = r.mood_names ? String(r.mood_names).split(',').map(s => s.trim()).filter(Boolean) : [];

      const base = {
        id: r.id,
        display_name: r.display_name,
        bio: r.bio,
        photo_url: r.photo_url,
        lat: r.lat,
        lng: r.lng,
        district_id: r.user_district_id || null,
        district_name: r.district_name || null,
        genres,
        moods,
        avg_rating: r.avg_rating,
        follower_count: r.follower_count,
        has_upcoming_event: bool(r.has_upcoming_event),
        status,
        tracks_count: Number(r.tracks_count || 0),
        approved_tracks_count: Number(r.approved_tracks_count || 0)
      };

      // Admin-only metadata when explicitly requested by an admin
      if (adminOverride) {
        base.is_approved = bool(r.is_approved);
        base.is_rejected = bool(r.is_rejected);
        base.approved_at = r.approved_at;
        base.rejected_at = r.rejected_at;
        base.approved_by = r.approved_by;
        base.rejected_by = r.rejected_by;
        base.rejection_reason = r.rejection_reason;
        base.user = {
          username: r.username,
          banned: bool(r.banned),
          deleted_at: r.deleted_at
        };
      }

      return base;
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /artists/:id
 * Returns artist data for public use.
 * Includes tracks[] and events[] using the same visibility rules:
 * - Admin with include_unapproved=1 => all tracks/events
 * - Artist owner => all tracks/events
 * - Public => only approved & not rejected tracks/events
 *
 * Returns genres & moods as arrays of objects.
 */
exports.getArtistById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid artist id' });

    const adminOverride = isAdminIncludeUnapproved(req);

    const [rows] = await pool.query(
      `SELECT
         a.*,
         u.id AS user_id,
         u.username,
         u.created_at AS user_created_at,
         u.banned,
         u.deleted_at,
         u.district_id AS user_district_id,
         d.name AS district_name,
         GROUP_CONCAT(DISTINCT g.id ORDER BY g.name SEPARATOR ',') AS genre_ids,
         GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR ',') AS genre_names,
         GROUP_CONCAT(DISTINCT m.id ORDER BY m.name SEPARATOR ',') AS mood_ids,
         GROUP_CONCAT(DISTINCT m.name ORDER BY m.name SEPARATOR ',') AS mood_names
       FROM artists a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN districts d ON u.district_id = d.id
       LEFT JOIN artist_genres ag ON ag.artist_id = a.id
       LEFT JOIN genres g ON ag.genre_id = g.id
       LEFT JOIN artist_moods am ON am.artist_id = a.id
       LEFT JOIN moods m ON am.mood_id = m.id
       WHERE a.id = ?
       GROUP BY a.id
       LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const artist = rows[0];

    // Check user account state first
    if (artist.deleted_at) {
      return res.status(410).json({
        status: 'deleted',
        message: 'This artist account has been deleted.'
      });
    }
    if (artist.banned) {
      return res.status(403).json({
        status: 'banned',
        message: 'This artist account has been banned.'
      });
    }

    // Parse genres / moods into arrays of objects if available
    const genreNames = artist.genre_names ? String(artist.genre_names).split(',').map(s => s.trim()).filter(Boolean) : [];
    const genreIds = artist.genre_ids ? String(artist.genre_ids).split(',').map(s => Number(s)) : [];
    const genres = genreNames.map((name, i) => ({ id: genreIds[i] || null, name }));

    const moodNames = artist.mood_names ? String(artist.mood_names).split(',').map(s => s.trim()).filter(Boolean) : [];
    const moodIds = artist.mood_ids ? String(artist.mood_ids).split(',').map(s => Number(s)) : [];
    const moods = moodNames.map((name, i) => ({ id: moodIds[i] || null, name }));

    // Determine requester permissions
    const isOwnerRequest = !!(req.user && req.user.id && Number(req.user.id) === Number(artist.user_id));

    // Tracks: apply visibility rules
    const trackParams = [artist.id];
    let trackSql = `SELECT id, artist_id, title, preview_url, duration, preview_artwork, genre, release_date, created_at,
                           is_approved, is_rejected, rejection_reason
                    FROM tracks
                    WHERE artist_id = ?`;
    if (!(adminOverride || isOwnerRequest)) {
      trackSql += ' AND is_approved = 1 AND is_rejected = 0';
    }
    trackSql += ' ORDER BY created_at DESC LIMIT 500';

    const [trackRows] = await pool.query(trackSql, trackParams);
    const tracks = (trackRows || []).map(tr => ({
      id: tr.id,
      artist_id: tr.artist_id,
      title: tr.title,
      preview_url: tr.preview_url || tr.file_url || null,
      duration: tr.duration != null ? Number(tr.duration) : null,
      preview_artwork: tr.preview_artwork || tr.artwork_url || null,
      genre: tr.genre || null,
      release_date: tr.release_date || null,
      created_at: tr.created_at || null,
      is_approved: bool(tr.is_approved),
      is_rejected: bool(tr.is_rejected),
      rejection_reason: tr.rejection_reason || null
    }));

    // Events: apply same visibility rules
    const eventParams = [artist.id];
    let eventSql = `SELECT id, title, description, event_date, artist_id, district_id, venue, address, ticket_url, image_url,
                           lat, lng, capacity, is_approved, is_rejected, rejection_reason, created_at
                    FROM events
                    WHERE artist_id = ?`;
    if (!(adminOverride || isOwnerRequest)) {
      eventSql += ' AND is_approved = 1 AND is_rejected = 0';
    }
    eventSql += ' ORDER BY event_date ASC LIMIT 500';

    const [eventRows] = await pool.query(eventSql, eventParams);
    const events = (eventRows || []).map(ev => ({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      event_date: ev.event_date,
      artist_id: ev.artist_id,
      district_id: ev.district_id,
      venue: ev.venue,
      address: ev.address,
      ticket_url: ev.ticket_url,
      image_url: ev.image_url || null,
      lat: ev.lat,
      lng: ev.lng,
      capacity: ev.capacity,
      created_at: ev.created_at,
      is_approved: bool(ev.is_approved),
      is_rejected: bool(ev.is_rejected),
      rejection_reason: ev.rejection_reason || null
    }));

    // compute events_count (active events returned)
    const events_count = Array.isArray(events) ? events.length : 0;

    // RATINGS: fetch total reviews and average rating from ratings table
    const [ratingRows] = await pool.query(
      `SELECT COUNT(*) AS total_reviews, AVG(rating) AS avg_rating
       FROM ratings
       WHERE artist_id = ?`,
      [artist.id]
    );

    const ratingsData = (ratingRows && ratingRows[0]) ? ratingRows[0] : { total_reviews: 0, avg_rating: null };
    const total_reviews = Number(ratingsData.total_reviews || 0);
    const avg_rating_value = (ratingsData.avg_rating !== null && ratingsData.avg_rating !== undefined)
      ? Number(Number(ratingsData.avg_rating).toFixed(2))
      : null;

    // Artist application status
    if (artist.is_approved || adminOverride) {
      // Approved -> return full artist payload for public view
      const payload = {
        id: artist.id,
        display_name: artist.display_name,
        bio: artist.bio,
        photo_url: artist.photo_url,
        lat: artist.lat,
        lng: artist.lng,
        district_id: artist.user_district_id || null,
        district_name: artist.district_name || null,
        genres,
        moods,
        // prefer computed avg_rating from ratings table, fallback to artist.avg_rating if present
        avg_rating: avg_rating_value !== null ? avg_rating_value : (artist.avg_rating || null),
        total_reviews,
        follower_count: artist.follower_count,
        has_upcoming_event: bool(artist.has_upcoming_event),
        approved_at: artist.approved_at,
        user: {
          id: artist.user_id,
          username: artist.username,
          created_at: artist.user_created_at || null
        },
        tracks, // visibility applied
        events, // visibility applied
        events_count
      };

      if (adminOverride) {
        payload.is_approved = bool(artist.is_approved);
        payload.is_rejected = bool(artist.is_rejected);
        payload.approved_by = artist.approved_by;
        payload.rejected_by = artist.rejected_by;
        payload.rejection_reason = artist.rejection_reason;
      }

      return res.json({ artist: payload });
    }

    if (artist.is_rejected) {
      return res.status(403).json({
        status: 'rejected',
        message: artist.rejection_reason ? `Artist application rejected: ${artist.rejection_reason}` : 'Artist application rejected.',
        rejection_reason: artist.rejection_reason || null,
        // include tracks/events for owner/admin only
        tracks: (adminOverride || isOwnerRequest) ? tracks : undefined,
        events: (adminOverride || isOwnerRequest) ? events : undefined,
        events_count: (adminOverride || isOwnerRequest) ? events_count : undefined,
        // ratings visible to owner/admin when profile is rejected
        total_reviews: (adminOverride || isOwnerRequest) ? total_reviews : undefined,
        avg_rating: (adminOverride || isOwnerRequest) ? avg_rating_value : undefined
      });
    }

    // Pending verification
    return res.status(403).json({
      status: 'pending',
      message: 'Artist profile is pending verification. It will be visible once approved.',
      // owner/admin can still see tracks/events
      tracks: (adminOverride || isOwnerRequest) ? tracks : undefined,
      events: (adminOverride || isOwnerRequest) ? events : undefined,
      events_count: (adminOverride || isOwnerRequest) ? events_count : undefined,
      // ratings visible to owner/admin when profile is pending
      total_reviews: (adminOverride || isOwnerRequest) ? total_reviews : undefined,
      avg_rating: (adminOverride || isOwnerRequest) ? avg_rating_value : undefined
    });
  } catch (err) {
    next(err);
  }
};