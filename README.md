# Textile Quotation System (CSE250-DBMS)

---

## 1. Project Overview

The **Textile Quotation System** is a full-stack web application developed as part of **CSE250 – Database Management Systems** under **KT Impex**, a textile import and export business.

The system automates the process of generating quotations by allowing users to register customers, manage textile products, and generate accurate price quotations based on predefined rates and quantities — replacing manual methods to reduce errors and maintain consistent pricing records.

---

## 2. Features

- **Product Catalogue** — View all textile products with category and base price
- **Customer Registration** — Register new customers via enquiry form with input validation
- **Quotation Generation** — Multi-item quotations with automatic GST (18%) calculation
- **Price Snapshot** — Locks price at time of quote so future price changes do not affect old quotations
- **Quotation History** — View all past quotations with grand totals and line items
- **Input Validation** — Email format, 10-digit phone, positive quantity enforced on backend
- **Secure CORS** — API restricted to local frontend origins only

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Database | MariaDB |
| Backend | Node.js + Express.js |
| Frontend | React (Vite) + JSX |
| Styling | CSS (App.css + index.css) |
| Language | SQL, JavaScript (ES Modules) |
| Environment | Linux (WSL) |
| Dev Tool | IntelliJ IDEA |
| Version Control | GitHub |

---

## 4. Database Design

The system uses a **MariaDB** relational database (`kt_impex`) with 5 tables — `customers`, `products`, `quotations`, `quotation_items` and `users`..

![ERD](database/erd.png)

---

## 5. Project Structure

```
CSE250-TextileQuotation/
├── backend/
│   ├── server.js          ← Express server with all 5 API endpoints + security
│   ├── db.js              ← MariaDB connection pool
│   ├── .env               ← Environment variables (not committed)
│   └── .env.example       ← Template for environment variables
├── database/
│   ├── schema.sql         ← All CREATE TABLE statements
│   ├── seed.sql           ← Sample product data (6 textile products)
│   └── erd.png            ← Entity Relationship Diagram
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProductCatalogue.jsx   ← Products tab
│   │   │   ├── CustomerForm.jsx       ← Register Customer tab
│   │   │   ├── QuotationForm.jsx      ← Create Quotation tab
│   │   │   └── QuotationHistory.jsx   ← Quotation History tab
│   │   ├── App.jsx            ← Root component with tab navigation
│   │   ├── App.css            ← Main stylesheet
│   │   └── main.jsx           ← React entry point
│   └── index.html         ← HTML shell
├── package.json
└── README.md
```

---

## 6. Frontend Architecture

Built with **React + Vite**. The app has 4 components — `ProductCatalogue`, `CustomerForm`, `QuotationForm`, and `QuotationHistory` — managed via tab navigation in `App.jsx`.

---

## 7. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Fetch all textile products |
| `POST` | `/api/enquiry` | Register a new customer (with validation) |
| `POST` | `/api/create-quotation` | Create a new multi-item quotation |
| `GET` | `/api/quotations` | Fetch all quotations with grand totals |
| `GET` | `/api/quotations/:id` | Fetch single quotation with line items and GST breakdown |

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
  "items": [{ "product_name": "Premium Cotton Suiting", "quantity": 50, "line_total": 32500.00 }]
}
```

---

## 8. Installation & Setup

```bash
git clone https://github.com/Rewant1908/CSE250-TextileQuotation.git
cd CSE250-TextileQuotation

# Terminal 1 — Backend
npm install && npm start

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 9. Security Features

- **CORS restricted** — Only local frontend origins are allowed
- **Input validation** — Email format, 10-digit phone number, name length enforced
- **Item sanitization** — Product IDs must be positive integers, quantity must be > 0
- **Parameterized queries** — All SQL uses `?` placeholders to prevent SQL injection
- **Transaction rollback** — Failed quotation creation rolls back all DB changes

---

## 10. Course Information

- **Course**: CSE250 – Database Management Systems
- **Project**: Textile Quotation System
- **Business**: KT Impex (Textile Import & Export)
- **Database**: kt_impex

---

## 11. Team Members

- Rewant Agrawal
- Vijay Kumar
- Kishna Rana
