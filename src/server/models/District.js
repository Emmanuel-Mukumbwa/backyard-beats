const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const District = sequelize.define('District', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
}, {
  tableName: 'districts',
  timestamps: false,
});

module.exports = District;
