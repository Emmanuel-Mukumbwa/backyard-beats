// src/server/models/District.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const District = sequelize.define('District', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'districts',
  timestamps: false,
  underscored: true
});

module.exports = District;