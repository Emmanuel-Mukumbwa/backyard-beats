
const express = require('express');
const app = express();
const db = require('./db');

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/artists', require('./routes/artists'));
app.use('/tracks', require('./routes/tracks'));
app.use('/events', require('./routes/events'));
app.use('/users', require('./routes/users'));
app.use('/ratings', require('./routes/ratings'));
app.use('/districts', require('./routes/districts'));
app.use('/auth', require('./routes/auth'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;
db.authenticate()
  .then(() => {
    console.log('Successfully connected to MySQL database!');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
  });
