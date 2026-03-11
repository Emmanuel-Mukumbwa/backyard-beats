// src/server/models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db'); // this is the sequelize instance exported from server/db.js

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  role: {
    type: DataTypes.ENUM('fan', 'artist', 'admin'),
    allowNull: false,
    defaultValue: 'fan'
  },
  has_profile: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  // district_id sits on users (normalized)
  district_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // optional extras that may exist in your schema:
  banned: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deleted_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: false,
  underscored: true
});

module.exports = User;