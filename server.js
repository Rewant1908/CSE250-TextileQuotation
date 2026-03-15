import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

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
    if (!customer_name) {
        return res.status(400).json({ error: 'customer_name is required' });
    }
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            `INSERT INTO customers (customer_name, contact_phone, email)
             VALUES (?, ?, ?)`,
            [customer_name, contact_phone || null, email || null]
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
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Insert quotation header (total_amount starts at 0, trigger will update it)
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
            [req.params.id]
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
            [req.params.id]
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
