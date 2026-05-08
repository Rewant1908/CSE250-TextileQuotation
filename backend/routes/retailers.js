import express from 'express';
import pool from '../db.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = express.Router();

// Exact ENUM values from live DB
// payment_pattern ENUM('advance','on_delivery','credit_good','credit_slow','risky')
// preferred_price_segment ENUM('budget','mid','premium','mixed')
const PAYMENT_PATTERNS = ['advance', 'on_delivery', 'credit_good', 'credit_slow', 'risky'];
const PRICE_SEGMENTS   = ['budget', 'mid', 'premium', 'mixed'];

const sanitizePayment = (v) => PAYMENT_PATTERNS.includes(v) ? v : 'on_delivery';
const sanitizeSegment = (v) => PRICE_SEGMENTS.includes(v)   ? v : 'mixed';

// GET /api/retailers
router.get('/', checkPermission('VIEW_RETAILERS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            `SELECT retailer_id, shop_name, contact_person, phone, market_location,
                    payment_pattern, preferred_categories, preferred_price_segment,
                    outstanding_balance, notes
             FROM retailers ORDER BY shop_name`
        );
        res.json(rows);
    } catch (err) {
        console.error('[retailers] GET / error:', err.message);
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// POST /api/retailers
router.post('/', checkPermission('CREATE_RETAILER'), async (req, res) => {
    const {
        shop_name, contact_person, phone, market_location,
        payment_pattern, preferred_categories, preferred_price_segment, notes
    } = req.body;
    if (!shop_name?.trim()) return res.status(400).json({ error: 'shop_name is required' });
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            `INSERT INTO retailers
                (shop_name, contact_person, phone, market_location,
                 payment_pattern, preferred_categories, preferred_price_segment,
                 outstanding_balance, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [
                shop_name.trim(),
                contact_person?.trim()       || null,
                phone?.trim()                || null,
                market_location?.trim()      || null,
                sanitizePayment(payment_pattern),
                preferred_categories?.trim() || null,
                sanitizeSegment(preferred_price_segment),
                notes?.trim()                || null
            ]
        );
        res.status(201).json({ success: true, retailer_id: Number(result.insertId) });
    } catch (err) {
        console.error('[retailers] POST error:', err.message);
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// PUT /api/retailers/:id
router.put('/:id', checkPermission('UPDATE_RETAILER'), async (req, res) => {
    const {
        shop_name, contact_person, phone, market_location,
        payment_pattern, preferred_categories, preferred_price_segment,
        outstanding_balance, notes
    } = req.body;
    if (!shop_name?.trim()) return res.status(400).json({ error: 'shop_name is required' });
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            `UPDATE retailers
             SET shop_name=?, contact_person=?, phone=?, market_location=?,
                 payment_pattern=?, preferred_categories=?, preferred_price_segment=?,
                 outstanding_balance=?, notes=?
             WHERE retailer_id=?`,
            [
                shop_name.trim(),
                contact_person?.trim()       || null,
                phone?.trim()                || null,
                market_location?.trim()      || null,
                sanitizePayment(payment_pattern),
                preferred_categories?.trim() || null,
                sanitizeSegment(preferred_price_segment),
                Number(outstanding_balance   || 0),
                notes?.trim()                || null,
                req.params.id
            ]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[retailers] PUT error:', err.message);
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// DELETE /api/retailers/:id
router.delete('/:id', checkPermission('DELETE_RETAILER'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('DELETE FROM retailers WHERE retailer_id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('[retailers] DELETE error:', err.message);
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

export default router;
