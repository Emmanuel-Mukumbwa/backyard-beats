// src/server/index.js
/**
 * Main server bootstrap
 * - Serves uploaded files at /uploads
 * - Mounts API routes including artist onboarding
 * - Connects to the database via server/db.js
 */

const express = require('express');
const app = express();
const db = require('./db'); // sequelize instance + pool
const cors = require('cors'); 
const path = require('path');

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const profileRoutes = require('./routes/profile.routes');

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true
}));

// Parse JSON bodies and URL-encoded (forms)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger (helps debug 404/routes)
app.use((req, res, next) => {
  console.log(`--> ${req.method} ${req.path}`);
  next();
});

// Serve uploaded files (artist photos, track files, etc.) at /uploads/*
app.use('/uploads', express.static(UPLOADS_DIR, {
  index: false,
  maxAge: '7d'
}));

app.use('/artistOnboard', require('./routes/artistOnboard.routes'));
// Then mount other routes
app.use('/artists', require('./routes/artists.routes'));
app.use('/tracks', require('./routes/tracks.routes'));
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

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Error handling middleware (keeps your existing handler)
app.use((err, req, res, next) => {
  console.error('Error:', err && (err.message || err));
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
      console.log(`Serving uploads from ${UPLOADS_DIR} at /uploads`);
    });
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
};

startServer();
