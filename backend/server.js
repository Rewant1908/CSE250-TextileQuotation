import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import pool from './db.js';
import { checkPermission } from './middleware/checkPermission.js';

const app = express();

app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));
app.use(express.json());

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[0-9]{10}$/;
const SALT_ROUNDS = 10;

app.get('/api/health', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const [db] = await conn.query('SELECT DATABASE() AS database_name');
        res.json({
            api: 'ok',
            database: 'connected',
            database_name: db?.database_name || null
        });
    } catch (err) {
        res.status(503).json({
            api: 'ok',
            database: 'disconnected',
            error: err.code || err.message
        });
    } finally {
        if (conn) conn.release();
    }
});

// ─── AUTH: SIGNUP ─────────────────────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    if (email && !emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    let conn;
    try {
        conn = await pool.getConnection();
        const [existing] = await conn.query('SELECT user_id FROM users WHERE username = ?', [username]);
        if (existing) return res.status(409).json({ error: 'Username already taken' });
        if (email) {
            const [emailExists] = await conn.query('SELECT user_id FROM users WHERE email = ?', [email]);
            if (emailExists) return res.status(409).json({ error: 'Email already registered' });
        }
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await conn.query(
            'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
            [username, password_hash, email || null, 'user']
        );
        res.status(201).json({ success: true, user_id: Number(result.insertId) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── AUTH: LOGIN ──────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    let conn;
    try {
        conn = await pool.getConnection();
        const [user] = await conn.query(
            'SELECT user_id, username, password, role FROM users WHERE username = ?',
            [username]
        );
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid username or password' });
        res.json({ success: true, user_id: user.user_id, username: user.username, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── 1. GET all products ──────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT product_id, product_name, category, base_price FROM products');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── OPERATIONS: wholesale textile intelligence dashboard ────────────────────
app.get('/api/operations/dashboard', checkPermission('VIEW_OPERATIONS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();

        const [summary] = await conn.query(
            `SELECT
                COUNT(DISTINCT b.bale_id) AS total_bales,
                COUNT(DISTINCT t.than_id) AS total_thans,
                COALESCE(SUM(t.remaining_stock), 0) AS available_meters,
                COALESCE(SUM(t.remaining_stock * t.cost_per_meter), 0) AS stock_cost_value,
                COALESCE(SUM(t.remaining_stock * t.selling_price), 0) AS stock_retail_value,
                COALESCE(SUM((t.selling_price - t.cost_per_meter) * t.remaining_stock), 0) AS unrealized_margin,
                SUM(CASE WHEN t.movement_speed = 'dead' THEN 1 ELSE 0 END) AS dead_than_count,
                COALESCE(SUM(CASE WHEN t.movement_speed = 'dead' THEN t.remaining_stock * t.cost_per_meter ELSE 0 END), 0) AS dead_stock_value
             FROM thans t
             LEFT JOIN bales b ON t.bale_id = b.bale_id`
        );

        const categoryMovement = await conn.query(
            `SELECT
                COALESCE(p.category, t.fabric_type) AS category,
                COUNT(DISTINCT t.than_id) AS than_count,
                COALESCE(SUM(t.remaining_stock), 0) AS remaining_meters,
                COALESCE(SUM(tx.quantity), 0) AS sold_meters,
                COALESCE(SUM(tx.margin), 0) AS realized_margin,
                ROUND(
                    COALESCE(SUM(tx.quantity), 0) /
                    NULLIF(COALESCE(SUM(tx.quantity), 0) + COALESCE(SUM(t.remaining_stock), 0), 0),
                    3
                ) AS sell_through_rate
             FROM thans t
             LEFT JOIN products p ON t.product_id = p.product_id
             LEFT JOIN (
                SELECT than_id, SUM(quantity) AS quantity, SUM(margin) AS margin
                FROM transactions
                GROUP BY than_id
             ) tx ON tx.than_id = t.than_id
             GROUP BY COALESCE(p.category, t.fabric_type)
             ORDER BY sold_meters DESC, realized_margin DESC
             LIMIT 8`
        );

        const deadStock = await conn.query(
            `SELECT
                t.than_id,
                t.than_code,
                t.fabric_type,
                t.color,
                t.design,
                t.remaining_stock,
                t.selling_price,
                t.warehouse_location,
                t.movement_speed,
                DATEDIFF(CURDATE(), DATE(COALESCE(MAX(im.movement_date), t.created_at))) AS days_without_movement
             FROM thans t
             LEFT JOIN inventory_movements im
                ON im.than_id = t.than_id AND im.movement_type = 'stock_out'
             WHERE t.remaining_stock > 0
             GROUP BY
                t.than_id, t.than_code, t.fabric_type, t.color, t.design,
                t.remaining_stock, t.selling_price, t.warehouse_location,
                t.movement_speed, t.created_at
             ORDER BY
                CASE WHEN t.movement_speed = 'dead' THEN 0 ELSE 1 END,
                days_without_movement DESC,
                t.remaining_stock DESC
             LIMIT 10`
        );

        const retailerSignals = await conn.query(
            `SELECT
                r.retailer_id,
                r.shop_name,
                r.market_location,
                r.payment_pattern,
                r.preferred_categories,
                r.preferred_price_segment,
                r.outstanding_balance,
                COUNT(tx.transaction_id) AS order_count,
                COALESCE(SUM(tx.quantity), 0) AS meters_bought,
                COALESCE(SUM(tx.price * tx.quantity - tx.discount), 0) AS revenue,
                COALESCE(SUM(tx.margin), 0) AS margin
             FROM retailers r
             LEFT JOIN transactions tx ON r.retailer_id = tx.retailer_id
             GROUP BY
                r.retailer_id, r.shop_name, r.market_location, r.payment_pattern,
                r.preferred_categories, r.preferred_price_segment, r.outstanding_balance
             ORDER BY revenue DESC, meters_bought DESC
             LIMIT 8`
        );

        const supplierSignals = await conn.query(
            `SELECT
                s.supplier_id,
                s.supplier_name,
                s.quality_rating,
                s.delay_frequency,
                s.trend_alignment,
                COUNT(DISTINCT b.bale_id) AS bales_received,
                COUNT(DISTINCT t.than_id) AS thans_created,
                COALESCE(SUM(tx.quantity), 0) AS meters_sold,
                COALESCE(SUM(tx.margin), 0) AS realized_margin
             FROM suppliers s
             LEFT JOIN bales b ON s.supplier_id = b.supplier_id
             LEFT JOIN thans t ON b.bale_id = t.bale_id
             LEFT JOIN (
                SELECT than_id, SUM(quantity) AS quantity, SUM(margin) AS margin
                FROM transactions
                GROUP BY than_id
             ) tx ON t.than_id = tx.than_id
             GROUP BY
                s.supplier_id, s.supplier_name, s.quality_rating,
                s.delay_frequency, s.trend_alignment
             ORDER BY realized_margin DESC, meters_sold DESC`
        );

        res.json({
            summary,
            categoryMovement,
            deadStock,
            retailerSignals,
            supplierSignals
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── OPERATIONS: natural-language-style inventory lookup foundation ─────────
app.get('/api/inventory/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const maxPrice = req.query.max_price ? Number(req.query.max_price) : null;
    const params = [];
    const clauses = ['t.remaining_stock > 0'];

    if (q) {
        const like = `%${q}%`;
        clauses.push(`(
            t.than_code LIKE ? OR t.fabric_type LIKE ? OR t.color LIKE ? OR
            t.design LIKE ? OR t.warehouse_location LIKE ? OR p.product_name LIKE ? OR
            p.category LIKE ?
        )`);
        params.push(like, like, like, like, like, like, like);
    }

    if (Number.isFinite(maxPrice)) {
        clauses.push('t.selling_price <= ?');
        params.push(maxPrice);
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            `SELECT
                t.than_id, t.than_code, t.fabric_type, t.color, t.design, t.gsm,
                t.remaining_stock, t.selling_price, t.cost_per_meter,
                ROUND(t.selling_price - t.cost_per_meter, 2) AS margin_per_meter,
                t.warehouse_location, t.movement_speed, t.image_url,
                p.product_name, p.category
             FROM thans t
             LEFT JOIN products p ON t.product_id = p.product_id
             WHERE ${clauses.join(' AND ')}
             ORDER BY
                CASE t.movement_speed
                    WHEN 'fast' THEN 0
                    WHEN 'medium' THEN 1
                    WHEN 'new' THEN 2
                    WHEN 'slow' THEN 3
                    ELSE 4
                END,
                margin_per_meter DESC
             LIMIT 25`,
            params
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── ADMIN: ADD product ───────────────────────────────────────────────────────
app.post('/api/products', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    const { product_name, category, base_price } = req.body;
    if (!product_name || !category || !base_price) return res.status(400).json({ error: 'All fields required' });
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            'INSERT INTO products (product_name, category, base_price) VALUES (?, ?, ?)',
            [product_name.trim(), category.trim(), base_price]
        );
        res.status(201).json({ success: true, product_id: Number(result.insertId) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── ADMIN: UPDATE product ────────────────────────────────────────────────────
app.put('/api/products/:id', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    const { product_name, category, base_price } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'UPDATE products SET product_name = ?, category = ?, base_price = ? WHERE product_id = ?',
            [product_name, category, base_price, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── ADMIN: DELETE product ────────────────────────────────────────────────────
app.delete('/api/products/:id', checkPermission('MANAGE_PRODUCTS'), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('DELETE FROM products WHERE product_id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── 2. POST customer enquiry ─────────────────────────────────────────────────
app.post('/api/enquiry', async (req, res) => {
    const { customer_name, contact_phone, email } = req.body;
    if (!customer_name || customer_name.trim() === '')
        return res.status(400).json({ error: 'customer_name is required' });
    if (customer_name.trim().length > 150)
        return res.status(400).json({ error: 'customer_name must be under 150 characters' });
    if (email && !emailRegex.test(email))
        return res.status(400).json({ error: 'Invalid email format' });
    if (contact_phone && !phoneRegex.test(contact_phone))
        return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            'INSERT INTO customers (customer_name, contact_phone, email) VALUES (?, ?, ?)',
            [customer_name.trim(), contact_phone || null, email || null]
        );
        res.status(201).json({ success: true, customer_id: Number(result.insertId) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── 3. POST create quotation ─────────────────────────────────────────────────
app.post('/api/create-quotation', async (req, res) => {
    const { customer_id, user_id, items } = req.body;
    if (!customer_id || !items || items.length === 0)
        return res.status(400).json({ error: 'customer_id and items are required' });
    for (const item of items) {
        if (!item.product_id || Number(item.product_id) <= 0)
            return res.status(400).json({ error: `Invalid product_id: ${item.product_id}` });
        if (!item.quantity || Number(item.quantity) <= 0)
            return res.status(400).json({ error: 'Quantity must be greater than 0' });
        if (Number(item.quantity) > 100000)
            return res.status(400).json({ error: 'Quantity too large' });
    }
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();
        const result = await conn.query(
            'INSERT INTO quotations (customer_id, user_id, status) VALUES (?, ?, ?)',
            [customer_id, user_id || null, 'pending']
        );
        const quotation_id = Number(result.insertId);
        for (const item of items) {
            const [product] = await conn.query(
                'SELECT base_price FROM products WHERE product_id = ?', [item.product_id]
            );
            if (!product) throw new Error(`Product ID ${item.product_id} not found`);
            await conn.query(
                'INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price_at_time) VALUES (?, ?, ?, ?)',
                [quotation_id, item.product_id, item.quantity, product.base_price]
            );
        }
        await conn.query(
            `UPDATE quotations SET total_amount = (
                SELECT ROUND(SUM(quantity * unit_price_at_time), 2)
                FROM quotation_items WHERE quotation_id = ?
            ) WHERE quotation_id = ?`,
            [quotation_id, quotation_id]
        );
        await conn.commit();
        res.status(201).json({ success: true, quotation_id });
    } catch (err) {
        if (conn) await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── 4. GET quotations — role verified from DB, not query string ─────────────────────
app.get('/api/quotations', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    let conn;
    try {
        conn = await pool.getConnection();
        const [requester] = await conn.query('SELECT role FROM users WHERE user_id = ?', [user_id]);
        if (!requester) return res.status(401).json({ error: 'User not found' });
        let rows;
        if (requester.role === 'admin') {
            rows = await conn.query(
                `SELECT q.quotation_id, c.customer_name, c.contact_phone, c.email,
                        q.total_amount, ROUND(q.total_amount * 1.13, 2) AS grand_total,
                        q.status, q.decline_reason, q.created_at, u.username
                 FROM quotations q
                 JOIN customers c ON q.customer_id = c.customer_id
                 LEFT JOIN users u ON q.user_id = u.user_id
                 ORDER BY q.created_at DESC`
            );
        } else {
            rows = await conn.query(
                `SELECT q.quotation_id, c.customer_name, c.contact_phone, c.email,
                        q.total_amount, ROUND(q.total_amount * 1.13, 2) AS grand_total,
                        q.status, q.decline_reason, q.created_at
                 FROM quotations q
                 JOIN customers c ON q.customer_id = c.customer_id
                 WHERE q.user_id = ?
                 ORDER BY q.created_at DESC`,
                [user_id]
            );
        }
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── 5. GET single quotation with items ──────────────────────────────────────
app.get('/api/quotations/:id', async (req, res) => {
    const quotationId = Number(req.params.id);
    if (!Number.isInteger(quotationId) || quotationId <= 0)
        return res.status(400).json({ error: 'Invalid quotation ID' });
    let conn;
    try {
        conn = await pool.getConnection();
        const [quotation] = await conn.query(
            `SELECT q.quotation_id, c.customer_name, c.contact_phone, c.email,
                    q.total_amount, ROUND(q.total_amount * 0.13, 2) AS vat_13,
                    ROUND(q.total_amount * 1.13, 2) AS grand_total,
                    q.status, q.decline_reason, q.created_at
             FROM quotations q
             JOIN customers c ON q.customer_id = c.customer_id
             WHERE q.quotation_id = ?`,
            [quotationId]
        );
        if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
        const items = await conn.query(
            `SELECT p.product_name, p.category, qi.quantity,
                    qi.unit_price_at_time,
                    ROUND(qi.quantity * qi.unit_price_at_time, 2) AS line_total
             FROM quotation_items qi
             JOIN products p ON qi.product_id = p.product_id
             WHERE qi.quotation_id = ?`,
            [quotationId]
        );
        res.json({ ...quotation, items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── ADMIN: PATCH quotation status ───────────────────────────────────────────
app.patch('/api/quotations/:id/status', checkPermission('MANAGE_QUOTATION_STATUS'), async (req, res) => {
    const { status, decline_reason } = req.body;
    if (!['accepted', 'declined', 'pending'].includes(status))
        return res.status(400).json({ error: 'Invalid status' });
    if (status === 'declined' && (!decline_reason || decline_reason.trim() === ''))
        return res.status(400).json({ error: 'Decline reason is required' });
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'UPDATE quotations SET status = ?, decline_reason = ? WHERE quotation_id = ?',
            [status, status === 'declined' ? decline_reason.trim() : null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.listen(process.env.PORT || 5000, () =>
    console.log(`🚀 Server running on port ${process.env.PORT || 5000}`)
);
