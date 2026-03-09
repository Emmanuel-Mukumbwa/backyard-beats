// src/server/controllers/admin/users.controller.js
const pool = require('../../db').pool;

/**
 * GET /admin/users
 * Query params:
 *  - page (default 1)
 *  - limit (default 25)
 *  - q (search username or email)
 *  - role (fan|artist) - admin is excluded automatically
 *  - includeDeleted (true|1) optional
 *
 * Returns: { users: [...], meta: { total, page, limit } }
 */
exports.listUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const q = (req.query.q || '').trim();
    const roleFilter = (req.query.role || '').trim();
    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    // Base where clauses
    const where = [];
    const params = [];

    // Exclude admins from the list by default
    where.push('role != ?');
    params.push('admin');

    // Soft-delete filter
    if (!includeDeleted) {
      where.push('deleted_at IS NULL');
    }

    // Role filter (fan|artist)
    if (roleFilter) {
      where.push('role = ?');
      params.push(roleFilter);
    }

    // Search
    if (q) {
      where.push('(username LIKE ? OR email LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Total count
    const countSql = `SELECT COUNT(*) as total FROM users ${whereSql}`;
    const [countRows] = await pool.query(countSql, params);
    const total = Number(countRows[0]?.total ?? 0);

    // Fetch page
    const sql = `
      SELECT id, username, email, role, has_profile, created_at,
             deleted_at,
             CASE WHEN banned = 1 THEN 1 ELSE 0 END AS banned
      FROM users
      ${whereSql}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;
    const pageParams = params.concat([limit, offset]);
    const [rows] = await pool.query(sql, pageParams);

    res.json({
      users: rows,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /admin/users/:id
 * Body: { displayName?, email?, role? }
 * Updates username (displayName), email and role in users table.
 */
exports.updateUser = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user id' });

    const { displayName, email, role } = req.body;

    // Minimal validation
    if (email !== undefined && typeof email !== 'string') return res.status(400).json({ error: 'Invalid email' });
    if (role !== undefined && !['fan', 'artist', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const updates = [];
    const params = [];

    if (displayName !== undefined) {
      updates.push('username = ?');
      params.push(displayName);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    params.push(id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await pool.query(sql, params);

    // Return updated user
    const [rows] = await pool.query('SELECT id, username, email, role, has_profile, created_at, deleted_at, IFNULL(banned,0) AS banned FROM users WHERE id = ? LIMIT 1', [id]);
    res.json({ success: true, user: rows[0] || null });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/users/:id/ban
 * Body: { ban: true|false }
 * Sets banned flag (soft, reversible)
 */
exports.banUser = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user id' });

    const { ban } = req.body;
    const banFlag = ban === true || ban === 'true' || ban === 1 || ban === '1' ? 1 : 0;

    const [result] = await pool.query('UPDATE users SET banned = ? WHERE id = ?', [banFlag, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, banned: Boolean(banFlag) });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /admin/users/:id
 * Soft-delete: sets deleted_at = NOW(), deleted_by = req.user?.id if available
 */
exports.softDeleteUser = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user id' });

    // do not allow deleting admins via this endpoint
    const [check] = await pool.query('SELECT role FROM users WHERE id = ? LIMIT 1', [id]);
    if (!check || check.length === 0) return res.status(404).json({ error: 'User not found' });
    if (check[0].role === 'admin') return res.status(403).json({ error: 'Cannot delete admin user' });

    const deletedBy = (req.user && req.user.id) ? req.user.id : null;
    await pool.query('UPDATE users SET deleted_at = NOW(), deleted_by = ? WHERE id = ?', [deletedBy, id]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/users/:id/restore
 * Remove soft-delete (deleted_at = NULL)
 */
exports.restoreUser = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user id' });

    const [result] = await pool.query('UPDATE users SET deleted_at = NULL, deleted_by = NULL WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};