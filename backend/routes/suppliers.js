/**
 * /api/suppliers
 *
 * Phase 5 fix #7: soft deletes — DELETE now sets is_deleted=1 + deleted_at
 * instead of hard-deleting (which caused FK constraint errors when bales exist).
 */
import { Router } from 'express';
import pool from '../db.js';
import { checkPermission } from '../middleware/checkPermission.js';
import logger from '../logger.js';

const router = Router();
const SOFT_DELETE_FILTER = `(s.is_deleted = 0 OR s.is_deleted IS NULL)`;

router.get('/', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            `SELECT s.supplier_id, s.supplier_name, s.contact_name, s.contact_phone,
                    s.email, s.city, s.quality_rating, s.delay_frequency,
                    s.trend_alignment, s.notes, s.created_at
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
            `SELECT * FROM suppliers s
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
    const { supplier_name, contact_name, contact_phone, email, city,
            quality_rating, delay_frequency, trend_alignment, notes } = req.body;
    if (!supplier_name?.trim()) return res.status(400).json({ error: 'supplier_name is required' });
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            `INSERT INTO suppliers
                (supplier_name, contact_name, contact_phone, email, city,
                 quality_rating, delay_frequency, trend_alignment, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                supplier_name.trim(), contact_name?.trim() || null,
                contact_phone?.trim() || null, email?.trim() || null,
                city?.trim() || null, quality_rating || null,
                delay_frequency || null, trend_alignment || null,
                notes?.trim() || null
            ]
        );
        res.status(201).json({ success: true, supplier_id: Number(result.insertId) });
    } catch (err) {
        logger.error({ err }, '[suppliers] POST /');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

router.put('/:id', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    const { supplier_name, contact_name, contact_phone, email, city,
            quality_rating, delay_frequency, trend_alignment, notes } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            `UPDATE suppliers SET
                supplier_name   = COALESCE(?, supplier_name),
                contact_name    = COALESCE(?, contact_name),
                contact_phone   = COALESCE(?, contact_phone),
                email           = COALESCE(?, email),
                city            = COALESCE(?, city),
                quality_rating  = COALESCE(?, quality_rating),
                delay_frequency = COALESCE(?, delay_frequency),
                trend_alignment = COALESCE(?, trend_alignment),
                notes           = COALESCE(?, notes)
             WHERE supplier_id = ? AND ${SOFT_DELETE_FILTER}`,
            [
                supplier_name || null, contact_name || null, contact_phone || null,
                email || null, city || null, quality_rating || null,
                delay_frequency || null, trend_alignment || null,
                notes || null, req.params.id
            ]
        );
        res.json({ success: true });
    } catch (err) {
        logger.error({ err }, '[suppliers] PUT /:id');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// Phase 5 fix #7: SOFT DELETE — avoids FK constraint errors when bales exist
router.delete('/:id', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            `UPDATE suppliers
             SET is_deleted = 1,
                 deleted_at  = NOW(),
                 deleted_by  = ?
             WHERE supplier_id = ? AND ${SOFT_DELETE_FILTER}`,
            [req.user.user_id, req.params.id]
        );
        if (Number(result.affectedRows) === 0) {
            return res.status(404).json({ error: 'Supplier not found or already deleted' });
        }
        res.json({ success: true, message: 'Supplier soft-deleted. Bale history preserved.' });
    } catch (err) {
        logger.error({ err }, '[suppliers] DELETE /:id');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

export default router;
