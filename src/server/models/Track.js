const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Track = sequelize.define('Track', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  artist_id: DataTypes.INTEGER,
  title: { type: DataTypes.STRING, allowNull: false },
  preview_url: DataTypes.STRING,
  duration: DataTypes.INTEGER,
}, {
  tableName: 'tracks', 
  timestamps: false,
});

module.exports = Track;
