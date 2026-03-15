/**
 * Main server bootstrap
 * - Mounts API routes
 * - Connects to the database via server/db.js
 */

require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const app = express();
const db = require('./db'); // sequelize instance + pool
const cors = require('cors');

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const profileRoutes = require('./routes/profile.routes');

// CORS: expose Content-Disposition and custom X-Track-* headers so browser JS (axios) can read them
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
  exposedHeaders: ['Content-Disposition', 'X-Track-Title', 'X-Track-Artist', 'X-Track-Genre', 'Content-Type']
}));

// (Optional) Ensure the Access-Control-Expose-Headers header is present for all responses as backup
app.use((req, res, next) => {
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Track-Title, X-Track-Artist, X-Track-Genre, Content-Type');
  next();
});

// Parse JSON bodies and URL-encoded (forms)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger (helps debug 404/routes)
app.use((req, res, next) => {
  console.log(`--> ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/artistOnboard', require('./routes/artistOnboard.routes'));
app.use('/artists', require('./routes/artists.routes'));
app.use('/tracks', require('./routes/tracks.routes'));
app.use('/download', require('./routes/download.routes'));
app.use('/events', require('./routes/events.routes'));
app.use('/users', require('./routes/users.routes'));
app.use('/', require('./routes/ratings.routes'));   // this contains /artist/:id
app.use('/districts', require('./routes/districts.routes'));
app.use('/auth', require('./routes/auth.routes'));
app.use('/favorites', require('./routes/favorites.routes'));
app.use('/profile', profileRoutes);
app.use('/fan', require('./routes/fan.routes'));
app.use('/public', require('./routes/public.routes'));
app.use('/fan/playlists', require('./routes/fan.playlists.routes'));
app.use('/admin', require('./routes/admin.routes'));
app.use('/meta', require('./routes/meta.routes'));
app.use('/support', require('./routes/support.routes'));
app.use('/minetracks', require('./routes/tracks.mine.routes'));
app.use('/mineevents', require('./routes/events.mine.routes'));

// Basic health check
app.get('/health', (req, res) => {
  console.log('💓 Health check pinged at', new Date().toISOString());
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Error handling middleware (keeps your existing handler)
app.use((err, req, res, next) => {
  console.error('Error:', err.stack || err.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error' });
  } else {
    next(err);
  }
});

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    if (typeof db.testConnection === 'function') {
      await db.testConnection();
    } else if (typeof db.authenticate === 'function') {
      await db.authenticate();
      console.log('✅ Successfully connected to MySQL database.');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`🚀 Files are served via Cloudinary (no local /uploads)`);
    });
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1); 
  }
};

startServer();