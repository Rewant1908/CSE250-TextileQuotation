/**
 * /api/suppliers
 *
 * Actual schema columns:
 *   supplier_id, supplier_name, factory_name, product_specialization,
 *   quality_rating, delay_frequency, price_range, popular_categories,
 *   return_issues, trend_alignment, created_at,
 *   is_deleted, deleted_at, deleted_by
 */
import { Router } from 'express';
import pool from '../db.js';
import { checkPermission } from '../middleware/checkPermission.js';
import logger from '../logger.js';

const router = Router();

const SOFT_DELETE_FILTER = `(IFNULL(s.is_deleted, 0) = 0)`;

const SELECT_COLS = `
    s.supplier_id, s.supplier_name, s.factory_name, s.product_specialization,
    s.quality_rating, s.delay_frequency, s.price_range, s.popular_categories,
    s.return_issues, s.trend_alignment, s.created_at`;

// GET /api/suppliers/full — enriched with than counts
// Must be before /:id so Express doesn't treat "full" as an id param
router.get('/full', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            `SELECT ${SELECT_COLS},
                    COUNT(t.than_id)                 AS total_thans,
                    COALESCE(SUM(t.total_meters), 0) AS total_meters
             FROM suppliers s
             LEFT JOIN thans t ON t.supplier_id = s.supplier_id
             WHERE ${SOFT_DELETE_FILTER}
             GROUP BY s.supplier_id
             ORDER BY s.supplier_name`
        );
        res.json(rows);
    } catch (err) {
        logger.error({ err }, '[suppliers] GET /full');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

router.get('/', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            `SELECT ${SELECT_COLS}
             FROM suppliers s
             WHERE ${SOFT_DELETE_FILTER}
             ORDER BY s.supplier_name`
        );
        res.json(rows);
    } catch (err) {
        logger.error({ err }, '[suppliers] GET /');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

router.get('/:id', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [supplier] = await conn.query(
            `SELECT ${SELECT_COLS}
             FROM suppliers s
             WHERE s.supplier_id = ? AND ${SOFT_DELETE_FILTER}`,
            [req.params.id]
        );
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
        res.json(supplier);
    } catch (err) {
        logger.error({ err }, '[suppliers] GET /:id');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

router.post('/', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    const { supplier_name, factory_name, product_specialization,
            quality_rating, delay_frequency, price_range,
            popular_categories, return_issues, trend_alignment } = req.body;
    if (!supplier_name?.trim()) return res.status(400).json({ error: 'supplier_name is required' });
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            `INSERT INTO suppliers
                (supplier_name, factory_name, product_specialization,
                 quality_rating, delay_frequency, price_range,
                 popular_categories, return_issues, trend_alignment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                supplier_name.trim(),
                factory_name?.trim()            || null,
                product_specialization?.trim()  || null,
                quality_rating                  || null,
                delay_frequency                 || 'medium',
                price_range?.trim()             || null,
                popular_categories?.trim()      || null,
                return_issues?.trim()           || null,
                trend_alignment                 || 'average',
            ]
        );
        res.status(201).json({ success: true, supplier_id: Number(result.insertId) });
    } catch (err) {
        logger.error({ err }, '[suppliers] POST /');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

router.put('/:id', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    const { supplier_name, factory_name, product_specialization,
            quality_rating, delay_frequency, price_range,
            popular_categories, return_issues, trend_alignment } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            `UPDATE suppliers SET
                supplier_name          = COALESCE(?, supplier_name),
                factory_name           = COALESCE(?, factory_name),
                product_specialization = COALESCE(?, product_specialization),
                quality_rating         = COALESCE(?, quality_rating),
                delay_frequency        = COALESCE(?, delay_frequency),
                price_range            = COALESCE(?, price_range),
                popular_categories     = COALESCE(?, popular_categories),
                return_issues          = COALESCE(?, return_issues),
                trend_alignment        = COALESCE(?, trend_alignment)
             WHERE supplier_id = ? AND ${SOFT_DELETE_FILTER}`,
            [
                supplier_name          || null,
                factory_name           || null,
                product_specialization || null,
                quality_rating         || null,
                delay_frequency        || null,
                price_range            || null,
                popular_categories     || null,
                return_issues          || null,
                trend_alignment        || null,
                req.params.id,
            ]
        );
        res.json({ success: true });
    } catch (err) {
        logger.error({ err }, '[suppliers] PUT /:id');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

router.delete('/:id', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            `UPDATE suppliers
             SET is_deleted = 1, deleted_at = NOW(), deleted_by = ?
             WHERE supplier_id = ? AND ${SOFT_DELETE_FILTER}`,
            [req.user.user_id, req.params.id]
        );
        if (Number(result.affectedRows) === 0) {
            return res.status(404).json({ error: 'Supplier not found or already deleted' });
        }
        res.json({ success: true, message: 'Supplier soft-deleted. Than history preserved.' });
    } catch (err) {
        logger.error({ err }, '[suppliers] DELETE /:id');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

export default router;
