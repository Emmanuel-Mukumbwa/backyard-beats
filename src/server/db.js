const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('backyard_beats', 'root', 'password', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false,
});

module.exports = sequelize;
