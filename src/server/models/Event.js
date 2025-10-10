const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Event = sequelize.define('Event', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  event_date: DataTypes.DATE,
  artist_id: DataTypes.INTEGER,
  district_id: DataTypes.INTEGER,
}, {
  tableName: 'events',
  timestamps: false,
});

module.exports = Event;
