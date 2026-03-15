// server/db.js
const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');
const fs = require('fs'); // needed for reading certificate file locally

// Database connection parameters from environment variables
const DB_NAME = process.env.DB_NAME || 'backyardbeatsDB';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || 'Mali2419.';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;

// SSL configuration (if required by your database host, e.g., Aiven)
let dialectOptions = {};

if (process.env.DB_SSL_CA) {
  // DB_SSL_CA can be either:
  //   - a file path (for local development)
  //   - the actual PEM certificate content (for production on Render)
  let caCert = process.env.DB_SSL_CA;

  // If it looks like a file path (does not start with the PEM marker), try to read it
  if (caCert && !caCert.startsWith('-----BEGIN CERTIFICATE-----')) {
    try {
      caCert = fs.readFileSync(caCert, 'utf8');
    } catch (err) {
      console.warn('⚠️ Could not read CA certificate file:', err.message);
      // Fall back to attempting SSL without a custom CA (may work for some providers)
    }
  }

  dialectOptions.ssl = {
    rejectUnauthorized: false,
    ca: caCert
  };
} else if (process.env.DB_SSL === 'true') {
  // Fallback: use SSL without specifying a CA (system certificates)
  dialectOptions.ssl = {
    rejectUnauthorized: false
  };
}

// Create Sequelize instance with the constructed options
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: false, // set to console.log for debugging
  dialectOptions: dialectOptions,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: false,
    underscored: true
  }
});

// Create a separate mysql2 pool (used for raw queries, if needed)
const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: dialectOptions.ssl // reuse the same SSL configuration
});

// Test the connection and log status
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log(`✅ Successfully connected to MySQL (${DB_NAME}).`);
    console.log(`   Pool settings: max=${sequelize.options.pool.max}, min=${sequelize.options.pool.min}, idle=${sequelize.options.pool.idle}`);
    if (dialectOptions.ssl) {
      console.log('🔐 SSL is enabled for this connection.');
    }
  } catch (err) {
    console.error('❌ Database connection failed:', err.message || err);
    throw err;
  }
}

// Attach the testConnection method and the raw pool to the sequelize export
module.exports = Object.assign(sequelize, { testConnection, pool });