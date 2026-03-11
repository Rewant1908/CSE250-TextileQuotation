# Textile Quotation System (CSE250-DBMS)

---

## 1. Project Overview

The **Textile Quotation System** is a web-based application developed as part of **CSE250 – Database Management Systems** under **KT Impex**, a textile import and export business.

The system automates the process of generating quotations by allowing users to register customers, manage textile products, and generate accurate price quotations based on predefined rates and quantities — replacing manual methods to reduce errors and maintain consistent pricing records.

---

## 2. Features

- **Product Catalogue** — View all textile products with category and base price
- **Customer Registration** — Register new customers via enquiry form
- **Quotation Generation** — Multi-item quotations with automatic GST (18%) calculation
- **Price Snapshot** — Locks price at time of quote so future price changes do not affect old quotations
- **Quotation History** — View all past quotations with grand totals and line items

----

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Database | MariaDB |
| Backend | Node.js + Express.js |
| Frontend | HTML, CSS, JavaScript |
| Language | SQL, JavaScript |
| Environment | Linux (WSL) |
| Dev Tool | IntelliJ IDEA |
| Version Control | GitHub |

---

## 4. Project Structure

```
CSE250-TextileQuotation/
├── backend/
│   ├── server.js          ← Express server with all 5 API endpoints
│   ├── db.js              ← MariaDB connection pool
│   ├── .env               ← Environment variables (not committed)
│   └── .env.example       ← Template for environment variables
├── database/
│   ├── schema.sql         ← All CREATE TABLE statements
│   └── erd.png            ← Entity Relationship Diagram
├── frontend/
│   ├── index.html         ← Main HTML page
│   ├── style.css          ← Stylesheet
│   └── main.js            ← Frontend logic
├── package.json
└── README.md
```

---

## 5. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Fetch all textile products |
| `POST` | `/api/enquiry` | Register a new customer |
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
  "total_amount": 3750.00,
  "gst_18": 675.00,
  "grand_total": 4425.00,
  "created_at": "2026-03-11T11:00:00.000Z",
  "items": [
    {
      "product_name": "Premium Wool Suiting",
      "category": "Suiting",
      "quantity": 50,
      "unit_price_at_time": 75.00,
      "line_total": 3750.00
    }
  ]
}
```

---

## 6. Installation & Setup

### Prerequisites
- Node.js v18+
- MariaDB
- WSL (Linux) or Linux/macOS

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/Rewant1908/CSE250-TextileQuotation.git
cd CSE250-TextileQuotation
```

**2. Install dependencies**
```bash
npm install
```

**3. Set up the database**
```bash
mariadb -u root -p -e "CREATE DATABASE kt_impex;"
mariadb -u root -p kt_impex < database/schema.sql
```

**4. Configure environment**
```bash
cp backend/.env.example backend/.env
```

Edit `.env` and fill in your credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=kt_impex
PORT=5000
```

**5. Start the server**
```bash
npm start
```

Server runs on `http://localhost:5000`

**6. Open the frontend**

Open `frontend/index.html` in your browser.

---

## 7. Course Information

- **Course**: CSE250 – Database Management Systems
- **Project**: Textile Quotation System
- **Business**: KT Impex (Textile Import & Export)
- **Database**: kt_impex
