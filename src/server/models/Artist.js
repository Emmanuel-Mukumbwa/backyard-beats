const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Artist = sequelize.define('Artist', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  display_name: { type: DataTypes.STRING, allowNull: false },
  bio: DataTypes.TEXT,
  photo_url: DataTypes.STRING,
  lat: DataTypes.DECIMAL(9,6),
  lng: DataTypes.DECIMAL(9,6),
  district_id: DataTypes.INTEGER,
  avg_rating: DataTypes.DECIMAL(3,2),
  has_upcoming_event: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'artists',
  timestamps: false,
});

module.exports = Artist;
