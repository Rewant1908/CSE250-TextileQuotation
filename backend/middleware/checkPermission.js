/**
 * checkPermission middleware
 * Usage: router.get('/path', checkPermission('PERMISSION_CODE'), handler)
 *
 * Reads user_id from req.body or req.query,
 * then queries app_user_role + role_permission to verify access.
 */

import pool from '../db.js';

const APP_CODE = 'KT-IMPEX';

export function checkPermission(requiredPermission) {
  return async (req, res, next) => {
    const user_id = req.body?.user_id ?? req.query?.user_id;

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized: user_id required' });
    }

    let conn;
    try {
      conn = await pool.getConnection();

      const rows = await conn.query(
        `SELECT p.code
         FROM app_user_role aur
         JOIN role_permission rp ON rp.role_id = aur.role_id
         JOIN \`permission\` p   ON p.id = rp.permission_id
         JOIN app a              ON a.id = aur.app_id
         WHERE aur.user_id = ?
           AND a.code      = ?
           AND a.is_active = 1
           AND p.code      = ?`,
        [user_id, APP_CODE, requiredPermission]
      );

      if (rows.length === 0) {
        return res.status(403).json({ error: `Forbidden: requires ${requiredPermission}` });
      }

      next();
    } catch (err) {
      console.error('checkPermission error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (conn) conn.release();
    }
  };
}
