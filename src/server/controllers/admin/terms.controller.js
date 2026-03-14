const pool = require('../../db').pool;
const path = require('path');

/**
 * Terms & Conditions controller (admin + public)
 *
 * Admin endpoints:
 *  - GET /admin/terms         (list)
 *  - POST /admin/terms        (create)
 *  - PUT /admin/terms/:id     (update)
 *  - DELETE /admin/terms/:id  (delete)
 *
 * Public endpoint (in public.routes.js):
 *  - GET /terms               (returns latest active term or latest by created_at)
 */

// Admin: list all terms (admin)
exports.listTerms = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, title, body, is_active, created_at, updated_at FROM terms_and_conditions ORDER BY created_at DESC');
    res.json({ terms: rows });
  } catch (err) {
    next(err);
  }
};

// Admin: create a new term
exports.createTerm = async (req, res, next) => {
  try {
    const title = (req.body && req.body.title) ? String(req.body.title).trim() : '';
    const body = (req.body && req.body.body) ? String(req.body.body) : '';
    const is_active = req.body && (req.body.is_active === 1 || req.body.is_active === '1' || req.body.is_active === true || req.body.is_active === 'true') ? 1 : 0;

    if (!title || !body) return res.status(400).json({ error: 'Title and body are required' });

    // if setting active, deactivate others
    if (is_active) {
      await pool.query('UPDATE terms_and_conditions SET is_active = 0 WHERE is_active = 1');
    }

    const [result] = await pool.query('INSERT INTO terms_and_conditions (title, body, is_active, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [title, body, is_active]);
    const [row] = await pool.query('SELECT id, title, body, is_active, created_at, updated_at FROM terms_and_conditions WHERE id = ? LIMIT 1', [result.insertId]);
    res.json({ success: true, term: row[0] });
  } catch (err) {
    next(err);
  }
};

// Admin: update a term
exports.updateTerm = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const title = (req.body && typeof req.body.title !== 'undefined') ? String(req.body.title).trim() : null;
    const body = (req.body && typeof req.body.body !== 'undefined') ? String(req.body.body) : null;
    const is_active = (req.body && typeof req.body.is_active !== 'undefined') ? (req.body.is_active ? 1 : 0) : null;

    // if trying to set active, deactivate others first
    if (is_active === 1) {
      await pool.query('UPDATE terms_and_conditions SET is_active = 0 WHERE is_active = 1');
    }

    // build update query dynamically
    const updates = [];
    const params = [];
    if (title !== null) { updates.push('title = ?'); params.push(title); }
    if (body !== null) { updates.push('body = ?'); params.push(body); }
    if (is_active !== null) { updates.push('is_active = ?'); params.push(is_active); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    params.push(id);
    const sql = `UPDATE terms_and_conditions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
    await pool.query(sql, params);

    const [row] = await pool.query('SELECT id, title, body, is_active, created_at, updated_at FROM terms_and_conditions WHERE id = ? LIMIT 1', [id]);
    res.json({ success: true, term: row[0] });
  } catch (err) {
    next(err);
  }
};

// Admin: delete
exports.deleteTerm = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await pool.query('DELETE FROM terms_and_conditions WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// Public: get latest active term (or latest by created_at)
exports.getActiveTerm = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, title, body, is_active, created_at, updated_at FROM terms_and_conditions WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1');
    if (rows && rows.length) return res.json({ terms: rows[0] });
    // fallback: return most recent
    const [fallback] = await pool.query('SELECT id, title, body, is_active, created_at, updated_at FROM terms_and_conditions ORDER BY created_at DESC LIMIT 1');
    return res.json({ terms: fallback[0] || null });
  } catch (err) {
    next(err);
  }
};