// src/server/controllers/profile.controller.js
const pool = require('../db').pool;

/**
 * GET /profile/me
 * Returns the artist profile for the logged-in user (if any),
 * including district name, genres, and moods.
 */
exports.getMyProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.user.id;

    // Fetch artist joined to user's district (district comes from users.district_id)
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

    if (!artistRows || artistRows.length === 0) {
      return res.status(404).json({
        error: "Artist profile not found",
        artist: null
      });
    }

    const artist = artistRows[0];

    // Fetch genres for the artist (returns [{id, name}, ...])
    const [genreRows] = await pool.query(
      `
      SELECT g.id, g.name
      FROM artist_genres ag
      JOIN genres g ON g.id = ag.genre_id
      WHERE ag.artist_id = ?
      ORDER BY g.name
      `,
      [artist.id]
    );

    // Fetch moods for the artist (returns [{id, name}, ...])
    const [moodRows] = await pool.query(
      `
      SELECT m.id, m.name
      FROM artist_moods am
      JOIN moods m ON m.id = am.mood_id
      WHERE am.artist_id = ?
      ORDER BY m.name
      `,
      [artist.id]
    );

    artist.genres = genreRows || [];
    artist.moods = moodRows || [];

    // Also return a lightweight user object (useful for client-side context)
    const [urows] = await pool.query(
      'SELECT id, username, email, role, has_profile, district_id, banned, deleted_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const user = urows && urows[0] ? urows[0] : null;

    return res.json({ artist, user });
  } catch (err) {
    console.error("getMyProfile error:", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
};