# Textile Quotation System (CSE250-DBMS)

---

## 1. Project Overview

The **Textile Quotation System** is a full-stack web application developed as part of **CSE250 – Database Management Systems** under **KT Impex**, a textile import and export business.

The system automates the process of generating quotations by allowing users to register customers, manage textile products, and generate accurate price quotations based on predefined rates and quantities — replacing manual methods to reduce errors and maintain consistent pricing records.

---

## 2. Current Implementation Status

### ✅ Fully Implemented

| # | Feature | Details |
|---|---------|---------|
| 1 | **Product Catalogue** | All 6 seeded textile products displayed with category and base price |
| 2 | **Customer Registration** | Enquiry form with frontend + backend validation; returns `customer_id` |
| 3 | **Multi-Item Quotation** | Dynamic item list, real-time subtotal/GST/grand-total preview |
| 4 | **Price Snapshot** | `unit_price_at_time` locked at quotation creation; immune to future price changes |
| 5 | **GST Calculation** | 18 % GST auto-applied on every quotation (server-side + frontend preview) |
| 6 | **Quotation History** | Full list view (no pagination); expandable row shows per-line-item detail |
| 7 | **REST API** | 5 endpoints fully wired with validation, error handling, and JSON responses |
| 8 | **Database Schema** | 4 tables, foreign keys, indices, and an ERD |
| 9 | **Security Layer** | CORS allow-list, parameterised queries, transaction rollback |
| 10 | **Dark-themed UI** | Responsive layout, toast notifications, loading & empty states |

### ❌ Not Yet Implemented

| Feature | Notes |
|---------|-------|
| Authentication / authorisation | API is open; no login or role-based access |
| Customer list / search | Customers can be registered but not viewed or edited |
| Product management UI | Products are read-only; no add/edit/delete in the UI |
| Quotation editing | Quotations are write-once; no update flow |
| Search & filter | No filter by customer, date range, or category |
| Pagination | All quotations loaded in a single request |
| PDF / Excel export | No export functionality |
| Email notifications | No transactional email on quotation creation |
| Automated tests | No unit, integration, or end-to-end tests |
| Environment-configurable API URL | Frontend hard-codes `http://localhost:5000` |

---

## 3. Features

- **Product Catalogue** — View all textile products with category and base price
- **Customer Registration** — Register new customers via enquiry form with input validation
- **Quotation Generation** — Multi-item quotations with automatic GST (18%) calculation
- **Price Snapshot** — Locks price at time of quote so future price changes do not affect old quotations
- **Quotation History** — View all past quotations with grand totals and line items
- **Input Validation** — Email format, 10-digit phone, positive quantity enforced on backend
- **Secure CORS** — API restricted to local frontend origins only

---

## 4. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Database | MariaDB | local / Docker |
| Database driver | mariadb (npm) | 3.5.2 |
| Backend | Node.js + Express.js | Express 5.2.1 |
| Security | CORS | 2.8.6 |
| Config | Dotenv | 17.3.1 |
| Frontend | React + ReactDOM | 19.2.4 |
| Build tool | Vite | 8.0.0 |
| Linter | ESLint | 9.39.4 |
| Styling | Plain CSS (App.css) | — |
| Language | JavaScript ES Modules + JSX | — |
| Dev environment | Linux / WSL | — |
| IDE | IntelliJ IDEA | — |
| Version control | GitHub | — |

---

## 5. Database Design

The system uses a **MariaDB** relational database (`kt_impex`) with 4 tables.

![ERD](database/erd.png)

### Table Definitions

#### `customers`
| Column | Type | Constraints |
|--------|------|-------------|
| `customer_id` | INT | PRIMARY KEY, AUTO_INCREMENT |
| `customer_name` | VARCHAR(150) | NOT NULL |
| `contact_phone` | VARCHAR(20) | NULL |
| `email` | VARCHAR(100) | NULL |

#### `products`
| Column | Type | Constraints |
|--------|------|-------------|
| `product_id` | INT | PRIMARY KEY, AUTO_INCREMENT |
| `product_name` | VARCHAR(150) | NOT NULL |
| `category` | ENUM('Suiting','Shirting') | NOT NULL |
| `base_price` | DECIMAL(10,2) | NOT NULL |

#### `quotations`
| Column | Type | Constraints |
|--------|------|-------------|
| `quotation_id` | INT | PRIMARY KEY, AUTO_INCREMENT |
| `customer_id` | INT | FK → customers(customer_id), NULL |
| `total_amount` | DECIMAL(15,2) | DEFAULT 0.00 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

*Index on `customer_id`.*

#### `quotation_items`
| Column | Type | Constraints |
|--------|------|-------------|
| `item_id` | INT | PRIMARY KEY, AUTO_INCREMENT |
| `quotation_id` | INT | FK → quotations(quotation_id), NULL |
| `product_id` | INT | FK → products(product_id), NULL |
| `quantity` | DECIMAL(10,2) | NULL |
| `unit_price_at_time` | DECIMAL(10,2) | NULL |

*Indices on `quotation_id` and `product_id`.*

### Seed Data — 6 Textile Products

| # | Product Name | Category | Base Price (₹/m) |
|---|---|---|---|
| 1 | Royal Wool Suiting | Suiting | 850.00 |
| 2 | Premium Cotton Suiting | Suiting | 650.00 |
| 3 | Classic Linen Suiting | Suiting | 720.00 |
| 4 | White Cotton Shirting | Shirting | 320.00 |
| 5 | Oxford Stripe Shirting | Shirting | 380.00 |
| 6 | Premium Poplin Shirting | Shirting | 290.00 |

---

## 6. Project Structure

```
CSE250-TextileQuotation/
├── backend/
│   ├── server.js          ← Express server — 5 API endpoints + security (223 lines)
│   ├── db.js              ← MariaDB connection pool (5 connections max)
│   ├── .env               ← Environment variables (not committed)
│   └── .env.example       ← Template: DB_HOST, DB_USER, DB_PASS, DB_NAME, PORT
├── database/
│   ├── schema.sql         ← CREATE TABLE statements for all 4 tables
│   ├── seed.sql           ← INSERT statements for 6 sample textile products
│   └── erd.png            ← Entity Relationship Diagram
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProductCatalogue.jsx   ← Products tab (52 lines)
│   │   │   ├── CustomerForm.jsx       ← Register Customer tab (81 lines)
│   │   │   ├── QuotationForm.jsx      ← Create Quotation tab (130 lines)
│   │   │   └── QuotationHistory.jsx   ← Quotation History tab (106 lines)
│   │   ├── App.jsx            ← Root component with 4-tab navigation (50 lines)
│   │   ├── App.css            ← Main stylesheet — dark theme (307 lines)
│   │   └── main.jsx           ← React entry point
│   ├── index.html             ← HTML shell
│   ├── vite.config.js         ← Vite build configuration
│   └── eslint.config.js       ← ESLint rules
├── package.json               ← Backend deps + `npm start` script
├── package-lock.json
└── README.md
```

---

## 7. Backend Architecture

### `backend/db.js` — Database Connection Pool

```js
// MariaDB connection pool — up to 5 concurrent connections
// Reads DB_HOST, DB_USER, DB_PASS, DB_NAME from .env
```

### `backend/server.js` — Express Application (Port 5000)

Sections in the file (in order):

1. **Imports & CORS setup** — restricts allowed origins to `localhost:5173`, `127.0.0.1:5500`, and `null`
2. **`GET /api/products`** — returns all products ordered by category
3. **`POST /api/enquiry`** — validates & inserts a new customer row
4. **`POST /api/create-quotation`** — opens a transaction; inserts quotation + all line items atomically
5. **`GET /api/quotations`** — returns all quotations with computed `grand_total` (subtotal × 1.18)
6. **`GET /api/quotations/:id`** — returns one quotation with GST breakdown + all line items

---

## 8. Frontend Architecture

Built with **React 19 + Vite 8**. All state is managed locally with `useState` hooks — no Redux or Context API.

### Colour Palette (Dark Theme)

| Role | Hex |
|------|-----|
| Page background | `#0f172a` |
| Card background | `#1e293b` |
| Accent / gold | `#f59e0b` |
| Body text | `#f1f5f9` |
| Muted text | `#94a3b8` |

### `App.jsx` — Root Component

- Renders the header (`🧵 KT Impex — Textile Quotation System`) and footer (course info)
- Holds `activeTab` state (0–3)
- Tab buttons: **Products → Register Customer → Create Quotation → Quotation History**
- Active tab highlighted in orange

### `ProductCatalogue.jsx`

- Fetches `GET /api/products` on mount
- Renders a table: `#`, `Product Name`, `Category` (colour-coded badge), `Base Price`
- Handles loading and empty states

### `CustomerForm.jsx`

- Fields: `Customer Name` (required), `Contact Phone` (optional), `Email` (optional)
- POSTs to `POST /api/enquiry`; displays returned `customer_id` in a success toast
- Resets form on success; shows error toast on failure

### `QuotationForm.jsx`

- Fetches product list on mount for the dropdown
- User enters `Customer ID` (obtained after registration)
- Dynamic item rows: add/remove products; each row has a product dropdown + quantity input
- **Real-time summary box** (shown when subtotal > 0):
  - Subtotal, GST 18 %, Grand Total
- POSTs to `POST /api/create-quotation`; shows success/error toast

### `QuotationHistory.jsx`

- Fetches `GET /api/quotations` on mount
- Main table: `ID`, `Customer`, `Phone`, `Subtotal`, `GST`, `Grand Total`, `Date`, `View`
- Clicking **View** fetches `GET /api/quotations/:id` and expands an inline detail panel
- Detail panel: per-item table with `Product`, `Category`, `Qty (m)`, `Unit Price`, `Line Total`
- Date formatted using `en-IN` locale

---

## 9. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Fetch all textile products |
| `POST` | `/api/enquiry` | Register a new customer (with validation) |
| `POST` | `/api/create-quotation` | Create a new multi-item quotation |
| `GET` | `/api/quotations` | Fetch all quotations with grand totals |
| `GET` | `/api/quotations/:id` | Fetch single quotation with line items and GST breakdown |

### Validation Rules (Backend)

| Field | Rule |
|-------|------|
| `customer_name` | Required; max 150 characters |
| `contact_phone` | Optional; must be exactly 10 digits when provided |
| `email` | Optional; must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` when provided |
| `customer_id` | Required for quotation; must be a positive integer |
| `items` | Must be a non-empty array |
| `product_id` | Must be a positive integer |
| `quantity` | Must be > 0; max 100,000 |
### Request / Response Examples

**POST `/api/enquiry`**
```json
// Request
{ "customer_name": "Rajesh Textiles", "contact_phone": "9876543210", "email": "raj@example.com" }

// Response
{ "success": true, "customer_id": 1 }
```

**POST `/api/create-quotation`**
```json
// Request
{ "customer_id": 1, "items": [{ "product_id": 2, "quantity": 50 }] }

// Response
{ "success": true, "quotation_id": 1 }
```

**GET `/api/quotations/1`**
```json
// Response
{
  "quotation_id": 1,
  "customer_name": "Rajesh Textiles",
  "total_amount": 32500.00,
  "gst_18": 5850.00,
  "grand_total": 38350.00,
  "items": [
    {
      "product_name": "Premium Cotton Suiting",
      "category": "Suiting",
      "quantity": 50,
      "unit_price_at_time": 650.00,
      "line_total": 32500.00
    }
  ]
}
```

---

## 10. Data Flow

```
Browser (React)
    │
    │  HTTP JSON (fetch)
    ▼
Express Server (port 5000)
    │  Validates input
    │  Runs parameterised SQL
    ▼
MariaDB (kt_impex)
    │  Returns rows
    ▼
Express  →  JSON response  →  React component updates state  →  Re-render
```

**Quotation creation** uses a **database transaction**:
1. `INSERT INTO quotations` → get `quotation_id`
2. `INSERT INTO quotation_items` (one row per item, price snapshotted)
3. `UPDATE quotations SET total_amount` with the computed subtotal
4. `COMMIT` — or `ROLLBACK` on any error

---

## 11. Security Features

| Mechanism | Implementation |
|-----------|---------------|
| CORS allow-list | Only `localhost:5173`, `127.0.0.1:5500`, `null` are permitted origins |
| Input validation | Email regex, 10-digit phone regex, name/quantity length checks |
| Item sanitization | `product_id` must be a positive integer; `quantity` must be > 0 and ≤ 100,000 |
| SQL injection prevention | All queries use MariaDB `?` placeholders (parameterised statements) |
| Transaction rollback | Any mid-flight DB error during quotation creation rolls back all inserts |

---

## 12. Installation & Setup

### Prerequisites

- Node.js (≥ 18)
- MariaDB (≥ 10.6) running locally or via Docker

### Steps

```bash
git clone https://github.com/Rewant1908/CSE250-TextileQuotation.git
cd CSE250-TextileQuotation

# 1. Create the database and seed it
#    Connect to MariaDB and run:
#    SOURCE database/schema.sql;
#    SOURCE database/seed.sql;

# 2. Configure environment variables
cp backend/.env.example backend/.env
# Edit backend/.env → set DB_PASS (and other values if needed)

# Terminal A — Backend (port 5000)
npm install
npm start

# Terminal B — Frontend (port 5173)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Environment Variables (`backend/.env`)

```
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=kt_impex
PORT=5000
```

---

## 13. Dependencies

### Backend (`package.json` at root)

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^5.2.1 | HTTP server and routing |
| mariadb | ^3.5.2 | MariaDB connection pool |
| cors | ^2.8.6 | CORS middleware |
| dotenv | ^17.3.1 | Environment variable loading |

### Frontend (`frontend/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.2.4 | UI framework |
| react-dom | ^19.2.4 | DOM rendering |
| vite | ^8.0.0 | Dev server and bundler |
| @vitejs/plugin-react | ^6.0.0 | React Fast Refresh |
| eslint | ^9.39.4 | Code linting |

---

## 14. Course Information

- **Course**: CSE250 – Database Management Systems
- **Project**: Textile Quotation System
- **Business**: KT Impex (Textile Import & Export)
- **Database**: kt_impex

---

## 15. Team Members

- Rewant Agrawal
- Vijay Kumar
- Kishna Rana
