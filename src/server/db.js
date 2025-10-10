const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('backyardbeatsDB', 'root', 'Mali2419.', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false,
});

module.exports = sequelize;
