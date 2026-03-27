import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import pool from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// ─── Security: Restrict CORS to local frontend only ───────────────────────────
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5500', 'null'],
    methods: ['GET', 'POST']
}));
app.use(express.json());

const missingEnv = [];
if (!process.env.AUTH_USERNAME) missingEnv.push('AUTH_USERNAME');
if (!process.env.AUTH_PASSWORD) missingEnv.push('AUTH_PASSWORD');
if (!process.env.JWT_SECRET)    missingEnv.push('JWT_SECRET');

if (missingEnv.length) {
    console.error(`Missing required auth env vars: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const AUTH_USERNAME = process.env.AUTH_USERNAME;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '8h';

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const loginRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again later.' }
});

const authRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/login',
    message: { error: 'Rate limit exceeded. Slow down requests.' }
});

const timingSafeEqualStrings = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    try {
        const hashA = crypto.createHash('sha256').update(a).digest();
        const hashB = crypto.createHash('sha256').update(b).digest();
        return crypto.timingSafeEqual(hashA, hashB);
    } catch {
        return false;
    }
};

// ─── Login endpoint ───────────────────────────────────────────────────────────
// Body: { username, password }
app.post('/api/login', loginRateLimiter, (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const usernameValid = timingSafeEqualStrings(username, AUTH_USERNAME);
    const passwordValid = timingSafeEqualStrings(password, AUTH_PASSWORD);

    if (!usernameValid || !passwordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({ token, user: { username } });
});

// ─── Authentication middleware ────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = header.replace('Bearer ', '');
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

app.use('/api', authRateLimiter);
app.use('/api', requireAuth);

// ─── Validation helpers ───────────────────────────────────────────────────────
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[0-9]{10}$/;

// ─── 1. GET all products ──────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            "SELECT product_id, product_name, category, base_price FROM products"
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── 2. POST customer enquiry ─────────────────────────────────────────────────
// Body: { customer_name, contact_phone, email }
app.post('/api/enquiry', async (req, res) => {
    const { customer_name, contact_phone, email } = req.body;

    // Input validation
    if (!customer_name || customer_name.trim() === '') {
        return res.status(400).json({ error: 'customer_name is required' });
    }
    if (customer_name.trim().length > 150) {
        return res.status(400).json({ error: 'customer_name must be under 150 characters' });
    }
    if (email && !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    if (contact_phone && !phoneRegex.test(contact_phone)) {
        return res.status(400).json({ error: 'Phone must be exactly 10 digits' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            `INSERT INTO customers (customer_name, contact_phone, email)
             VALUES (?, ?, ?)`,
            [customer_name.trim(), contact_phone || null, email || null]
        );
        res.status(201).json({
            success: true,
            customer_id: Number(result.insertId)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── 3. POST create quotation ─────────────────────────────────────────────────
// Body: { customer_id: 1, items: [{ product_id: 2, quantity: 10 }, ...] }
app.post('/api/create-quotation', async (req, res) => {
    const { customer_id, items } = req.body;

    if (!customer_id || !items || items.length === 0) {
        return res.status(400).json({ error: 'customer_id and items are required' });
    }

    // Validate each item before touching the DB
    for (const item of items) {
        if (!item.product_id || !Number.isInteger(Number(item.product_id)) || Number(item.product_id) <= 0) {
            return res.status(400).json({ error: `Invalid product_id: ${item.product_id}` });
        }
        if (!item.quantity || Number(item.quantity) <= 0) {
            return res.status(400).json({ error: `Quantity must be greater than 0` });
        }
        if (Number(item.quantity) > 100000) {
            return res.status(400).json({ error: `Quantity too large for product_id: ${item.product_id}` });
        }
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Insert quotation header
        const result = await conn.query(
            `INSERT INTO quotations (customer_id) VALUES (?)`,
            [customer_id]
        );
        const quotation_id = Number(result.insertId);

        // Insert each item — snapshot base_price into unit_price_at_time
        for (const item of items) {
            const [product] = await conn.query(
                "SELECT base_price FROM products WHERE product_id = ?",
                [item.product_id]
            );
            if (!product) throw new Error(`Product ID ${item.product_id} not found`);

            await conn.query(
                `INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price_at_time)
                 VALUES (?, ?, ?, ?)`,
                [quotation_id, item.product_id, item.quantity, product.base_price]
            );
        }

        // Manually update total_amount after all items are inserted
        await conn.query(
            `UPDATE quotations
             SET total_amount = (
                 SELECT ROUND(SUM(quantity * unit_price_at_time), 2)
                 FROM quotation_items
                 WHERE quotation_id = ?
             )
             WHERE quotation_id = ?`,
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

// ─── 4. GET all quotations ────────────────────────────────────────────────────
app.get('/api/quotations', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            `SELECT 
                q.quotation_id,
                c.customer_name,
                c.contact_phone,
                c.email,
                q.total_amount,
                ROUND(q.total_amount * 1.18, 2) AS grand_total,
                q.created_at
             FROM quotations q
             JOIN customers c ON q.customer_id = c.customer_id
             ORDER BY q.created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ─── 5. GET single quotation with all its items ───────────────────────────────
app.get('/api/quotations/:id', async (req, res) => {
    const quotationId = Number(req.params.id);
    if (!Number.isInteger(quotationId) || quotationId <= 0) {
        return res.status(400).json({ error: 'Invalid quotation ID' });
    }

    let conn;
    try {
        conn = await pool.getConnection();

        // Quotation header
        const [quotation] = await conn.query(
            `SELECT 
                q.quotation_id,
                c.customer_name,
                c.contact_phone,
                c.email,
                q.total_amount,
                ROUND(q.total_amount * 0.18, 2)  AS gst_18,
                ROUND(q.total_amount * 1.18, 2)  AS grand_total,
                q.created_at
             FROM quotations q
             JOIN customers c ON q.customer_id = c.customer_id
             WHERE q.quotation_id = ?`,
            [quotationId]
        );
        if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

        // Line items
        const items = await conn.query(
            `SELECT 
                p.product_name,
                p.category,
                qi.quantity,
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

app.listen(process.env.PORT || 5000, () =>
    console.log(`🚀 Dealer Server running on port ${process.env.PORT || 5000}`)
);
