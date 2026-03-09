// src/server/controllers/admin/analytics.controller.js
const pool = require('../../db').pool;

/**
 * GET /admin/analytics
 *
 * Returns aggregated metrics used by the Admin Dashboard analytics panel.
 * Uses the existing schema (users, artists, tracks, playlists, listens, favorites, ratings, events).
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    // Run independent counts in parallel where possible
    const [
      usersRows,
      artistsRows,
      tracksRows,
      playlistsRows,
      eventsRows,
      upcomingEventsRows,
      listensRows,
      uniqueListenersRows,
      favoritesRows,
      avgRatingRows,
      userGrowthRows,
      topArtistsRows
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS totalUsers FROM users'),
      pool.query('SELECT COUNT(*) AS totalArtists FROM artists'),
      pool.query('SELECT COUNT(*) AS totalTracks FROM tracks'),
      pool.query('SELECT COUNT(*) AS totalPlaylists FROM playlists'),
      pool.query('SELECT COUNT(*) AS totalEvents FROM events'),
      pool.query('SELECT COUNT(*) AS upcomingEvents FROM events WHERE event_date >= NOW()'),
      pool.query('SELECT COUNT(*) AS totalListens FROM listens'),
      pool.query('SELECT COUNT(DISTINCT user_id) AS uniqueListenersLast30 FROM listens WHERE played_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'),
      pool.query('SELECT COUNT(*) AS totalFavorites FROM favorites'),
      pool.query('SELECT ROUND(AVG(rating),2) AS avgRating FROM ratings'),
      pool.query(
        `SELECT
           SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS last30,
           SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND created_at < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS prev30
         FROM users`
      ),
      // top artists by plays in last 30 days
      pool.query(
        `SELECT a.id, a.display_name AS name, COUNT(l.id) AS plays
         FROM listens l
         JOIN artists a ON l.artist_id = a.id
         WHERE l.played_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY a.id
         ORDER BY plays DESC
         LIMIT 5`
      )
    ]);

    // Helper to safely read values
    const totalUsers = Number(usersRows[0][0]?.totalUsers ?? 0);
    const totalArtists = Number(artistsRows[0][0]?.totalArtists ?? 0);
    const totalTracks = Number(tracksRows[0][0]?.totalTracks ?? 0);
    const totalPlaylists = Number(playlistsRows[0][0]?.totalPlaylists ?? 0);
    const totalEvents = Number(eventsRows[0][0]?.totalEvents ?? 0);
    const upcomingEvents = Number(upcomingEventsRows[0][0]?.upcomingEvents ?? 0);
    const totalListens = Number(listensRows[0][0]?.totalListens ?? 0);
    const uniqueListenersLast30 = Number(uniqueListenersRows[0][0]?.uniqueListenersLast30 ?? 0);
    const totalFavorites = Number(favoritesRows[0][0]?.totalFavorites ?? 0);
    const avgRating = avgRatingRows[0][0]?.avgRating !== null ? Number(avgRatingRows[0][0].avgRating) : null;

    // userGrowth: compute percent change between last30 and prev30
    const last30 = Number(userGrowthRows[0][0]?.last30 ?? 0);
    const prev30 = Number(userGrowthRows[0][0]?.prev30 ?? 0);

    let userGrowth = '0%';
    if (prev30 === 0) {
      userGrowth = last30 === 0 ? '0%' : `+${last30}`; // if no previous period, show new count (could be "new: N")
    } else {
      const raw = ((last30 - prev30) / prev30) * 100;
      userGrowth = `${raw >= 0 ? '+' : ''}${raw.toFixed(1)}%`;
    }

    // engagementRate: percent of users who listened at least once in last 30 days
    let engagementRate = '0%';
    if (totalUsers > 0) {
      engagementRate = `${((uniqueListenersLast30 / totalUsers) * 100).toFixed(1)}%`;
    }

    // Top artists: normalize rows
    const topArtistsByPlays = (topArtistsRows[0] || []).map(r => ({
      id: r.id,
      name: r.name,
      plays: Number(r.plays)
    }));

    const analytics = {
      totalUsers,
      totalArtists,
      totalTracks,
      totalPlaylists,
      totalEvents,
      upcomingEvents,
      totalListens,
      uniqueListenersLast30,
      totalFavorites,
      avgRating, // number or null
      userGrowth,
      engagementRate,
      topArtistsByPlays
    };

    res.json({ analytics });
  } catch (err) {
    next(err);
  }
};