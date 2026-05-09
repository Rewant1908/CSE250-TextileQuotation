/**
 * /api/admin/settings
 *
 * Phase 7 — Configurable dead-stock threshold
 *
 * Persists key-value settings in the `app_settings` table.
 * Falls back to DEAD_DAYS (60) if the table doesn't exist yet.
 *
 * Routes:
 *   GET  /api/admin/settings              → { dead_stock_days: 60, ... }
 *   PUT  /api/admin/settings              → { dead_stock_days: 45 }  (body)
 *
 * Migration (run once):
 *   CREATE TABLE IF NOT EXISTS app_settings (
 *     setting_key   VARCHAR(64)  PRIMARY KEY,
 *     setting_value VARCHAR(255) NOT NULL,
 *     updated_at    DATETIME     DEFAULT current_timestamp() ON UPDATE current_timestamp()
 *   );
 *   INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('dead_stock_days', '60');
 */

import express from 'express';
import pool   from '../db.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { DEAD_DAYS }       from './sales.js';
import { flush }           from '../cache.js';
import logger              from '../logger.js';

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────

async function ensureTable(conn) {
    await conn.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
            setting_key   VARCHAR(64)  PRIMARY KEY,
            setting_value VARCHAR(255) NOT NULL,
            updated_at    DATETIME     DEFAULT current_timestamp()
                                       ON UPDATE current_timestamp()
        )
    `);
    await conn.query(
        `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('dead_stock_days', ?)`,
        [String(DEAD_DAYS)]
    );
}

/**
 * getDeadStockDays() — exported so operations.js and sales.js can call it.
 * Returns the persisted threshold (int), or DEAD_DAYS if the table is missing.
 */
export async function getDeadStockDays() {
    let conn;
    try {
        conn = await pool.getConnection();
        await ensureTable(conn);
        const [row] = await conn.query(
            `SELECT setting_value FROM app_settings WHERE setting_key = 'dead_stock_days'`
        );
        return row ? Math.max(1, parseInt(row.setting_value, 10)) : DEAD_DAYS;
    } catch {
        return DEAD_DAYS;
    } finally {
        if (conn) conn.release();
    }
}

// ── GET /api/admin/settings ───────────────────────────────────────────────────
router.get('/', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await ensureTable(conn);
        const rows = await conn.query(`SELECT setting_key, setting_value FROM app_settings`);
        const out  = {};
        for (const r of rows) {
            // coerce numeric-looking values to numbers
            out[r.setting_key] = isNaN(r.setting_value) ? r.setting_value : Number(r.setting_value);
        }
        res.json(out);
    } catch (err) {
        logger.error({ err }, '[settings] GET /');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// ── PUT /api/admin/settings ───────────────────────────────────────────────────
router.put('/', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    const { dead_stock_days } = req.body;

    if (dead_stock_days === undefined)
        return res.status(400).json({ error: 'dead_stock_days is required' });

    const days = parseInt(dead_stock_days, 10);
    if (isNaN(days) || days < 1)
        return res.status(400).json({ error: 'dead_stock_days must be a positive integer' });

    let conn;
    try {
        conn = await pool.getConnection();
        await ensureTable(conn);
        await conn.query(
            `INSERT INTO app_settings (setting_key, setting_value) VALUES ('dead_stock_days', ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [String(days)]
        );
        // Bust dashboard cache so the new threshold is reflected immediately
        await flush('dashboard').catch(() => {});
        logger.info({ days }, '[settings] dead_stock_days updated');
        res.json({ success: true, dead_stock_days: days });
    } catch (err) {
        logger.error({ err }, '[settings] PUT /');
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

export default router;
