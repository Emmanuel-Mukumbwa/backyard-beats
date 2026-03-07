// server/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const pool = require('../db').pool;

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// Middleware to authenticate and attach user to req
module.exports = async function (req, res, next) {
  try { 
    const authHeader = req.headers.authorization || '';
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }
    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET); 
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Support token payloads that include either 'id' or 'userId'
    const userId = decoded.id || decoded.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Token missing user id' });
    }

    // Fetch fresh user data from DB
    const [rows] = await pool.query(
      `SELECT id, username, email, role, has_profile
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach only necessary fields
    req.user = {
      id: rows[0].id,
      username: rows[0].username,
      email: rows[0].email,
      role: rows[0].role,
      has_profile: rows[0].has_profile === 1 || rows[0].has_profile === true
    };

    next();
  } catch (err) {
    // fallback
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
