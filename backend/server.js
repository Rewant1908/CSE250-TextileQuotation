import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/products', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT * FROM products");
        res.json(rows);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        if (conn) conn.release();
    }
});

app.listen(5000, () => console.log(`🚀 Dealer Server running on port 5000`));
