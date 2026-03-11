// src/server/models/index.js
const sequelize = require('../db');

// Import all models (each file should export the model without setting associations)
const User = require('./User');
const Artist = require('./Artist');
const Genre = require('./Genre');
const ArtistGenre = require('./ArtistGenre');
const District = require('./District');
const Event = require('./Event');
const Rating = require('./Rating');
const Track = require('./Track');

// ------------------------
// Associations (centralized)
// ------------------------

// Artist <-> User
// An Artist belongs to a User (artist.user) and a User can have one Artist (user.artist)
Artist.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasOne(Artist, { foreignKey: 'user_id', as: 'artist' });

// User <-> District
// District is owned by users (users.district_id) — normalized design
User.belongsTo(District, { foreignKey: 'district_id', as: 'district' });
District.hasMany(User, { foreignKey: 'district_id', as: 'users' });

// Artist <-> Genre (many-to-many)
Artist.belongsToMany(Genre, {
  through: ArtistGenre,
  foreignKey: 'artist_id',
  otherKey: 'genre_id',
  as: 'Genres'
});
Genre.belongsToMany(Artist, {
  through: ArtistGenre,
  foreignKey: 'genre_id',
  otherKey: 'artist_id',
  as: 'Artists'
});

// Optional / helpful associations (if your other controllers use them)
// Track belongs to Artist (if you store track.artist_id)
if (Track && Artist) {
  Track.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });
  Artist.hasMany(Track, { foreignKey: 'artist_id', as: 'tracks' });
}

// Ratings and Events associations can be wired here if used elsewhere.
// Example (uncomment if you have these FKs in DB):
// Rating.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });
// Artist.hasMany(Rating, { foreignKey: 'artist_id', as: 'ratings' });
// Event.belongsTo(Artist, { foreignKey: 'artist_id', as: 'artist' });
// Artist.hasMany(Event, { foreignKey: 'artist_id', as: 'events' });

// Export models and sequelize instance
module.exports = {
  sequelize,
  User,
  Artist,
  Genre,
  ArtistGenre,
  District,
  Event,
  Rating,
  Track
};