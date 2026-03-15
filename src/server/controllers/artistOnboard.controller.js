// File: server/controllers/artistOnboard.controller.js
const pool = require('../db').pool;
// No longer need path or UPLOADS_PREFIX

/**
 * Helper: validate that given ids exist in table.
 * Returns array of valid ids (may be empty).
 */
async function getValidIds(conn, table, ids) {
  if (!ids || !Array.isArray(ids) || ids.length === 0) return [];
  // prepare placeholders
  const placeholders = ids.map(() => '?').join(',');
  const sql = `SELECT id FROM \`${table}\` WHERE id IN (${placeholders})`;
  const [rows] = await conn.query(sql, ids);
  return rows.map((r) => r.id);
}

exports.onboard = async (req, res, next) => {
  let conn;
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const display_name = (req.body.display_name || req.body.displayName || '').trim();
    if (!display_name) return res.status(400).json({ error: 'Display name is required' });

    const bio =
      typeof req.body.bio === 'string' && req.body.bio.trim().length > 0
        ? req.body.bio.trim()
        : null;

    // Parse genres and moods (expect arrays of IDs)
    let genres = [];
    if (req.body.genres) {
      try {
        genres = typeof req.body.genres === 'string' ? JSON.parse(req.body.genres) : req.body.genres;
      } catch {
        genres = [];
      }
    }

    let moods = [];
    if (req.body.moods) {
      try {
        moods = typeof req.body.moods === 'string' ? JSON.parse(req.body.moods) : req.body.moods;
      } catch {
        moods = [];
      }
    }

    // Handle uploaded photo (now uses Cloudinary, so file.path is the full HTTPS URL)
    let photoFile = null;
    if (req.file) {
      photoFile = req.file;
    } else if (req.files && req.files.photo && Array.isArray(req.files.photo) && req.files.photo.length > 0) {
      photoFile = req.files.photo[0];
    }

    const photo_url_from_upload = photoFile ? photoFile.path : null;

    // get a connection for transaction
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // check existing artist for this user (id only)
    const [existing] = await conn.query('SELECT id FROM artists WHERE user_id = ? LIMIT 1', [userId]);

    let artistId;

    // Validate genres/moods IDs against DB
    const suppliedGenreIds = Array.isArray(genres) ? genres.map(Number).filter((n) => !Number.isNaN(n)) : [];
    const suppliedMoodIds = Array.isArray(moods) ? moods.map(Number).filter((n) => !Number.isNaN(n)) : [];

    const validGenreIds = await getValidIds(conn, 'genres', suppliedGenreIds);
    const validMoodIds = await getValidIds(conn, 'moods', suppliedMoodIds);

    const invalidGenres = suppliedGenreIds.filter((id) => !validGenreIds.includes(id));
    const invalidMoods = suppliedMoodIds.filter((id) => !validMoodIds.includes(id));

    if (invalidGenres.length > 0 || invalidMoods.length > 0) {
      await conn.rollback();
      const problems = {};
      if (invalidGenres.length > 0) problems.invalid_genres = invalidGenres;
      if (invalidMoods.length > 0) problems.invalid_moods = invalidMoods;
      return res.status(400).json({ error: 'Invalid genre or mood IDs', ...problems });
    }

    // Determine admin override (admins editing keep approval state)
    const adminOverride = !!(req.user && req.user.role === 'admin');

    if (existing.length > 0) {
      // UPDATE EXISTING ARTIST
      artistId = existing[0].id;

      // fetch full existing artist row so we can inspect previous approval state
      const [prevRows] = await conn.query('SELECT * FROM artists WHERE id = ? LIMIT 1', [artistId]);
      const prevArtist = prevRows && prevRows[0] ? prevRows[0] : null;

      const updates = [];
      const vals = [];

      updates.push('display_name = ?');
      vals.push(display_name);

      updates.push('bio = ?');
      vals.push(bio);

      if (photo_url_from_upload) {
        updates.push('photo_url = ?');
        vals.push(photo_url_from_upload);
      }

      if (updates.length > 0) {
        vals.push(artistId);
        const sql = `UPDATE artists SET ${updates.join(', ')} WHERE id = ?`;
        await conn.query(sql, vals);
      }

      // Clear old genre relations
      await conn.query('DELETE FROM artist_genres WHERE artist_id = ?', [artistId]);

      // Insert new genres (if any)
      if (validGenreIds.length > 0) {
        const insertGenreValues = validGenreIds.map((g) => [artistId, g]);
        await conn.query('INSERT INTO artist_genres (artist_id, genre_id) VALUES ?', [insertGenreValues]);
        // NOTE: mysql2 supports bulk insert with VALUES ?
      }

      // Clear old moods
      await conn.query('DELETE FROM artist_moods WHERE artist_id = ?', [artistId]);

      // Insert new moods
      if (validMoodIds.length > 0) {
        const insertMoodValues = validMoodIds.map((m) => [artistId, m]);
        await conn.query('INSERT INTO artist_moods (artist_id, mood_id) VALUES ?', [insertMoodValues]);
      }

      // Update user record to reflect they have a profile / role
      await conn.query('UPDATE users SET has_profile = 1, role = ? WHERE id = ?', ['artist', userId]);

      // If the profile was previously approved and the editor is NOT an admin,
      // revert approval status so moderators re-review the change.
      // Admin edits keep approval metadata intact.
      try {
        const wasApproved = prevArtist && Number(prevArtist.is_approved) === 1;
        if (wasApproved && !adminOverride) {
          await conn.query(
            `UPDATE artists
             SET is_approved = 0,
                 is_rejected = 0,
                 approved_at = NULL,
                 rejected_at = NULL,
                 rejection_reason = NULL
             WHERE id = ?`,
            [artistId]
          );
        }
      } catch (resetErr) {
        // Non-fatal: log and continue; we still commit and return the updated profile.
        // Replace console.error with your app logger if available.
        console.error('Failed to reset artist approval on update:', resetErr);
      }
    } else {
      // CREATE NEW ARTIST
      const [result] = await conn.query(
        `INSERT INTO artists (display_name, bio, photo_url, user_id)
         VALUES (?, ?, ?, ?)`,
        [display_name, bio, photo_url_from_upload, userId]
      );

      artistId = result.insertId;

      // Insert genres (bulk if any)
      if (validGenreIds.length > 0) {
        const insertGenreValues = validGenreIds.map((g) => [artistId, g]);
        await conn.query('INSERT INTO artist_genres (artist_id, genre_id) VALUES ?', [insertGenreValues]);
      }

      // Insert moods
      if (validMoodIds.length > 0) {
        const insertMoodValues = validMoodIds.map((m) => [artistId, m]);
        await conn.query('INSERT INTO artist_moods (artist_id, mood_id) VALUES ?', [insertMoodValues]);
      }

      await conn.query('UPDATE users SET has_profile = 1, role = ? WHERE id = ?', ['artist', userId]);
    }

    // commit transaction before read queries
    await conn.commit();

    // Fetch artist with district + genres + moods (use pool for reads to avoid holding conn)
    const [artistRows] = await pool.query(
      `
      SELECT 
        a.*,
        d.name AS district
      FROM artists a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN districts d ON u.district_id = d.id
      WHERE a.id = ?
      `,
      [artistId]
    );

    const artist = artistRows[0] || null;

    const [genreRows] = await pool.query(
      `
      SELECT g.id, g.name
      FROM artist_genres ag
      JOIN genres g ON g.id = ag.genre_id
      WHERE ag.artist_id = ?
      `,
      [artistId]
    );

    const [moodRows] = await pool.query(
      `
      SELECT m.id, m.name
      FROM artist_moods am
      JOIN moods m ON m.id = am.mood_id
      WHERE am.artist_id = ?
      `,
      [artistId]
    );

    if (artist) {
      artist.genres = genreRows;
      artist.moods = moodRows;
    }

    const [urows] = await pool.query(
      'SELECT id, username, email, role, has_profile, district_id FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    const user = urows[0];

    return res.json({
      message: 'Artist profile saved',
      artist,
      user,
      photo_url: artist ? artist.photo_url : null
    });
  } catch (err) {
    console.error('Artist onboard error:', err);
    try {
      if (conn) await conn.rollback();
    } catch (rbErr) {
      console.error('Rollback error:', rbErr);
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
};

exports.getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const [artistRows] = await pool.query(
      `
      SELECT 
        a.*,
        d.name AS district
      FROM artists a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN districts d ON u.district_id = d.id
      WHERE a.user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!artistRows.length) return res.status(404).json({ error: 'Artist profile not found' });

    const artist = artistRows[0];

    const [genres] = await pool.query(
      `
      SELECT g.id, g.name
      FROM artist_genres ag
      JOIN genres g ON g.id = ag.genre_id
      WHERE ag.artist_id = ?
      `,
      [artist.id]
    );

    const [moods] = await pool.query(
      `
      SELECT m.id, m.name
      FROM artist_moods am
      JOIN moods m ON m.id = am.mood_id
      WHERE am.artist_id = ?
      `,
      [artist.id] 
    );

    artist.genres = genres;
    artist.moods = moods;

    return res.json({ artist });
  } catch (err) {
    console.error('Get artist profile error:', err);
    next(err);
  }
};