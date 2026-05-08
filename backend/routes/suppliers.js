import express from 'express';
import pool from '../db.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = express.Router();

// MariaDB BigInt → Number serializer
const serialize = (data) =>
    JSON.parse(JSON.stringify(data, (_, v) =>
        typeof v === 'bigint' ? Number(v) : v
    ));

// GET /api/suppliers/full
// Frontend (SupplierManager.jsx) calls this endpoint.
// Aliases DB column `specialization` → `product_specialization` to match frontend state key.
router.get('/full', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            `SELECT supplier_id, supplier_name, factory_name,
                    specialization AS product_specialization,
                    price_range, quality_rating,
                    delay_frequency, trend_alignment,
                    popular_categories, return_issues
             FROM suppliers ORDER BY supplier_name`
        );
        res.json(serialize(rows));
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (conn) conn.release(); }
});

// GET /api/suppliers
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            `SELECT supplier_id, supplier_name, factory_name,
                    specialization, price_range, quality_rating,
                    delay_frequency, trend_alignment,
                    popular_categories, return_issues
             FROM suppliers ORDER BY supplier_name`
        );
        res.json(serialize(rows));
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (conn) conn.release(); }
});

// POST /api/suppliers
// Accepts both `specialization` and `product_specialization` (frontend sends the latter)
router.post('/', checkPermission('MANAGE_SUPPLIERS'), async (req, res) => {
    const {
        supplier_name, factory_name,
        specialization, product_specialization,
        price_range, quality_rating, delay_frequency,
        trend_alignment, popular_categories, return_issues
    } = req.body;

    if (!supplier_name?.trim())
        return res.status(400).json({ error: 'supplier_name is required' });

    const spec = (specialization || product_specialization || '').trim() || null;

    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            `INSERT INTO suppliers
                (supplier_name, factory_name, specialization, price_range,
                 quality_rating, delay_frequency, trend_alignment,
                 popular_categories, return_issues)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                supplier_name.trim(),
                factory_name?.trim()       || null,
                spec,
                price_range?.trim()        || null,
                quality_rating != null ? Number(quality_rating) : null,
                delay_frequency?.trim()    || null,
                trend_alignment?.trim()    || null,
                popular_categories?.trim() || null,
                return_issues?.trim()      || null
            ]
        );
        res.status(201).json({ success: true, supplier_id: Number(result.insertId) });
    } catch (err) {
        console.error('[suppliers] POST error:', err.message);
        res.status(500).json({ error: err.message });
    }
    finally { if (conn) conn.release(); }
});

// PUT /api/suppliers/:id
router.put('/:id', checkPermission('MANAGE_SUPPLIERS'), async (req, res) => {
    const {
        supplier_name, factory_name,
        specialization, product_specialization,
        price_range, quality_rating, delay_frequency,
        trend_alignment, popular_categories, return_issues
    } = req.body;

    if (!supplier_name?.trim())
        return res.status(400).json({ error: 'supplier_name is required' });

    const spec = (specialization || product_specialization || '').trim() || null;

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            `UPDATE suppliers
             SET supplier_name=?, factory_name=?, specialization=?, price_range=?,
                 quality_rating=?, delay_frequency=?, trend_alignment=?,
                 popular_categories=?, return_issues=?
             WHERE supplier_id=?`,
            [
                supplier_name.trim(),
                factory_name?.trim()       || null,
                spec,
                price_range?.trim()        || null,
                quality_rating != null ? Number(quality_rating) : null,
                delay_frequency?.trim()    || null,
                trend_alignment?.trim()    || null,
                popular_categories?.trim() || null,
                return_issues?.trim()      || null,
                req.params.id
            ]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[suppliers] PUT error:', err.message);
        res.status(500).json({ error: err.message });
    }
    finally { if (conn) conn.release(); }
});

// DELETE /api/suppliers/:id
router.delete('/:id', checkPermission('MANAGE_SUPPLIERS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('DELETE FROM suppliers WHERE supplier_id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('[suppliers] DELETE error:', err.message);
        // Surface foreign-key violations clearly so the frontend can show a helpful message
        res.status(500).json({ error: err.message });
    }
    finally { if (conn) conn.release(); }
});

export default router;
