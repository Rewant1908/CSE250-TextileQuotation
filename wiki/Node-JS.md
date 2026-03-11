# Node JS — Backend Architecture

This page explains how the backend of the Textile Quotation System is built and why each decision was made.

---

## What is Node.js?

Node.js is a JavaScript runtime that allows JavaScript to run on the server side — outside the browser. It is used here to build the backend API that connects the frontend to the MariaDB database.

---

## What is Express.js?

Express is a lightweight framework built on top of Node.js that makes it easy to create API endpoints. Without Express, setting up routes and handling HTTP requests would require much more code.

---

## Project Entry Point — `server.js`

When you run `npm start`, Node.js executes `server.js`. This file:
- Creates the Express app
- Registers all middleware
- Defines all 5 API endpoints
- Starts listening on port 5000

---

## Middleware
```js
app.use(cors());
app.use(express.json());
```

| Middleware       | Purpose                                                                   |
|------------------|---------------------------------------------------------------------------|
| `cors()`         | Allows the frontend (running on a different port) to call the backend API |
| `express.json()` | Parses incoming JSON request bodies so we can read `req.body`             |

---

## Database Connection — `db.js`
```js
const pool = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 5
});
```

A **connection pool** is used instead of a single connection. This means up to 5 database connections are kept open and reused — much more efficient than opening and closing a new connection for every request.

Credentials are loaded from `.env` using `dotenv` — never hardcoded in the source code.

---

## Why ES Modules?
```json
"type": "module"
```

This is set in `package.json` so we can use `import/export` syntax instead of the older `require()` syntax. See the [ES Modules](ES-Modules-and-Vite-Framework) wiki page for full explanation.

---

## API Endpoints

### 1. GET `/api/products`

Fetches all products from the catalogue.
```js
const rows = await conn.query(
    "SELECT product_id, product_name, category, base_price FROM products"
);
```

Simple SELECT query — no filtering needed since the frontend needs the full product list.

---

### 2. POST `/api/enquiry`

Registers a new customer.
```js
const result = await conn.query(
    `INSERT INTO customers (customer_name, contact_phone, email) VALUES (?, ?, ?)`,
    [customer_name, contact_phone || null, email || null]
);
```

`?` placeholders are used instead of string concatenation — this prevents **SQL Injection** attacks.

`contact_phone || null` means if the frontend sends an empty string, it is stored as NULL in the database.

---

### 3. POST `/api/create-quotation`

The most complex endpoint — creates a quotation with multiple items using a **database transaction**.
```js
await conn.beginTransaction();
// insert quotation header
// loop through items and insert each one
await conn.commit();
```

**Why a transaction?**
If the quotation header inserts successfully but one item fails, without a transaction the database would be left in a broken state — a quotation with missing items. With `beginTransaction` and `commit`, either everything saves or nothing saves. If anything fails, `rollback` undoes all changes.

---

### 4. GET `/api/quotations`

Fetches all quotations with customer details and grand total including GST.
```js
ROUND(q.total_amount * 1.18, 2) AS grand_total
```

GST of 18% is calculated in the SQL query itself using `* 1.18` — no need to calculate it in JavaScript.

---

### 5. GET `/api/quotations/:id`

Fetches a single quotation with all its line items.

`:id` is a route parameter — e.g. `/api/quotations/3` fetches quotation number 3.

Two queries run:
1. Quotation header with customer details and GST breakdown
2. All line items with `line_total = quantity × unit_price_at_time`

---

## Error Handling

Every endpoint follows this pattern:
```js
let conn;
try {
    conn = await pool.getConnection();
    // run queries
} catch (err) {
    res.status(500).json({ error: err.message });
} finally {
    if (conn) conn.release();
}
```

- `try` — attempts the database operation
- `catch` — if anything fails, returns a 500 error with the error message
- `finally` — always releases the connection back to the pool, even if an error occurred