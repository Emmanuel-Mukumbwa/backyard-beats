const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Rating = sequelize.define('Rating', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  artist_id: DataTypes.INTEGER,
  user_id: DataTypes.INTEGER,
  rating: { type: DataTypes.INTEGER, allowNull: false },
  comment: DataTypes.TEXT,
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'ratings',
  timestamps: false,
});

module.exports = Rating;
