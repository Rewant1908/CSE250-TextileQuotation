/**
 * /api/retailers
 *
 * Phase 5 fixes applied:
 *  3. preferred_categories_json now returned in GET / and GET /:id
 *     (was written by migration_v2 stored procedure but never queried)
 *  7. Soft deletes: DELETE now sets is_deleted=1 + deleted_at instead of hard-DELETE
 *     Existing GET queries filter WHERE r.is_deleted = 0 (or IS NULL for old rows)
 *  9. assigned_user_id FK: salespeople filter to their own retailers unless admin
 */
import { Router } from 'express';
import pool from '../db.js';
import { checkPermission } from '../middleware/checkPermission.js';
import logger from '../logger.js';

const router = Router();

const SOFT_DELETE_FILTER = `(r.is_deleted = 0 OR r.is_deleted IS NULL)`;

// ── GET /api/retailers ────────────────────────────────────────────────────────
router.get('/', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();

        // Phase 5 fix #9: admin sees all; salespeople see only their assigned retailers
        const isAdmin = req.user.role === 'admin';
        const userClause = isAdmin ? '' : 'AND (r.assigned_user_id = ? OR r.assigned_user_id IS NULL)';
        const userParam  = isAdmin ? [] : [req.user.user_id];

        const rows = await conn.query(
            `SELECT r.retailer_id, r.shop_name, r.owner_name, r.contact_phone,
                    r.market_location, r.city, r.payment_pattern,
                    r.preferred_categories, r.preferred_price_segment,
                    r.preferred_categories_json,
                    r.outstanding_balance, r.credit_limit,
                    r.assigned_user_id,
                    u.name AS assigned_to,
                    r.created_at
             FROM retailers r
             LEFT JOIN users u ON u.user_id = r.assigned_user_id
             WHERE ${SOFT_DELETE_FILTER} ${userClause}
             ORDER BY r.shop_name`,
            userParam
        );

        // Parse preferred_categories_json for frontend convenience
        const parsed = rows.map(r => ({
            ...r,
            preferred_categories_json: tryParseJson(r.preferred_categories_json)
        }));

        res.json(parsed);
    } catch (err) {
        logger.error({ err }, '[retailers] GET /');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// ── GET /api/retailers/:id ────────────────────────────────────────────────────
router.get('/:id', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [retailer] = await conn.query(
            `SELECT r.*,
                    r.preferred_categories_json,
                    u.name AS assigned_to
             FROM retailers r
             LEFT JOIN users u ON u.user_id = r.assigned_user_id
             WHERE r.retailer_id = ? AND ${SOFT_DELETE_FILTER}`,
            [req.params.id]
        );
        if (!retailer) return res.status(404).json({ error: 'Retailer not found' });

        retailer.preferred_categories_json = tryParseJson(retailer.preferred_categories_json);
        res.json(retailer);
    } catch (err) {
        logger.error({ err }, '[retailers] GET /:id');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// ── POST /api/retailers ────────────────────────────────────────────────────────
router.post('/', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    const {
        shop_name, owner_name, contact_phone, market_location, city,
        payment_pattern, preferred_categories, preferred_price_segment,
        credit_limit, assigned_user_id
    } = req.body;

    if (!shop_name?.trim()) return res.status(400).json({ error: 'shop_name is required' });

    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            `INSERT INTO retailers
                (shop_name, owner_name, contact_phone, market_location, city,
                 payment_pattern, preferred_categories, preferred_price_segment,
                 credit_limit, assigned_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                shop_name.trim(), owner_name?.trim() || null,
                contact_phone?.trim() || null, market_location?.trim() || null,
                city?.trim() || null, payment_pattern || 'cash',
                preferred_categories || null, preferred_price_segment || null,
                credit_limit || 0,
                // Phase 5 fix #9: default assigned_user_id to the creating user
                assigned_user_id || req.user.user_id
            ]
        );
        res.status(201).json({ success: true, retailer_id: Number(result.insertId) });
    } catch (err) {
        logger.error({ err }, '[retailers] POST /');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// ── PUT /api/retailers/:id ─────────────────────────────────────────────────────
router.put('/:id', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    const {
        shop_name, owner_name, contact_phone, market_location, city,
        payment_pattern, preferred_categories, preferred_price_segment,
        credit_limit, outstanding_balance, assigned_user_id
    } = req.body;

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            `UPDATE retailers SET
                shop_name              = COALESCE(?, shop_name),
                owner_name             = COALESCE(?, owner_name),
                contact_phone          = COALESCE(?, contact_phone),
                market_location        = COALESCE(?, market_location),
                city                   = COALESCE(?, city),
                payment_pattern        = COALESCE(?, payment_pattern),
                preferred_categories   = COALESCE(?, preferred_categories),
                preferred_price_segment= COALESCE(?, preferred_price_segment),
                credit_limit           = COALESCE(?, credit_limit),
                outstanding_balance    = COALESCE(?, outstanding_balance),
                assigned_user_id       = COALESCE(?, assigned_user_id)
             WHERE retailer_id = ? AND ${SOFT_DELETE_FILTER}`,
            [
                shop_name || null, owner_name || null, contact_phone || null,
                market_location || null, city || null, payment_pattern || null,
                preferred_categories || null, preferred_price_segment || null,
                credit_limit ?? null, outstanding_balance ?? null,
                assigned_user_id || null,
                req.params.id
            ]
        );
        res.json({ success: true });
    } catch (err) {
        logger.error({ err }, '[retailers] PUT /:id');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// ── DELETE /api/retailers/:id — SOFT DELETE ────────────────────────────────────
// Phase 5 fix #7: hard DELETE replaced with soft delete.
// Sets is_deleted=1, deleted_at=NOW(), deleted_by=requesting user.
// FK constraint errors (transactions referencing this retailer) are avoided entirely.
// History is fully preserved for analytics joins.
router.delete('/:id', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            `UPDATE retailers
             SET is_deleted = 1,
                 deleted_at  = NOW(),
                 deleted_by  = ?
             WHERE retailer_id = ? AND ${SOFT_DELETE_FILTER}`,
            [req.user.user_id, req.params.id]
        );
        if (Number(result.affectedRows) === 0) {
            return res.status(404).json({ error: 'Retailer not found or already deleted' });
        }
        res.json({ success: true, message: 'Retailer soft-deleted. History preserved.' });
    } catch (err) {
        logger.error({ err }, '[retailers] DELETE /:id');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// ── helper ─────────────────────────────────────────────────────────────────────
function tryParseJson(val) {
    if (!val) return null;
    if (typeof val === 'object') return val; // already parsed by MariaDB driver
    try { return JSON.parse(val); } catch { return val; }
}

export default router;
