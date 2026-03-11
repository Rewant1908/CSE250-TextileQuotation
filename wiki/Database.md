# Database Design

This page explains every decision made in the database design of the Textile Quotation System.

---

## Why MariaDB?

MariaDB is a relational database — meaning data is stored in structured tables with defined relationships between them. It was chosen because:

- It is open source and free
- It is fully compatible with MySQL syntax
- It works well with Node.js via the `mariadb` npm package
- It supports transactions which are critical for quotation generation

---

## Database Name
```
kt_impex
```

Named after the business — KT Impex (textile import and export).

---

## Tables

### 1. `customers`

Stores every customer who submits an enquiry.

| Column | Data Type | Constraint | Why |
|---|---|---|---|
| `customer_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for each customer |
| `customer_name` | VARCHAR(150) | NOT NULL | Every customer must have a name |
| `contact_phone` | VARCHAR(20) | NULL allowed | Phone is optional |
| `email` | VARCHAR(100) | NULL allowed | Email is optional |

> `contact_phone` is VARCHAR not INT because phone numbers can start with 0 and may contain country codes like +91.

---

### 2. `products`

Stores the textile product catalogue.

| Column | Data Type | Constraint | Why |
|---|---|---|---|
| `product_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for each product |
| `product_name` | VARCHAR(150) | NOT NULL | Every product must have a name |
| `category` | ENUM('Suiting','Shirting') | NOT NULL | Only two valid categories in KT Impex |
| `base_price` | DECIMAL(10,2) | NOT NULL | Price per metre, cannot be null |

> `DECIMAL(10,2)` is used instead of FLOAT because FLOAT has rounding errors with money. DECIMAL stores exact values — critical for financial data.

> `ENUM` is used for category so only valid values can be inserted — prevents data entry errors.

---

### 3. `quotations`

Stores the quotation header — one row per quotation.

| Column | Data Type | Constraint | Why |
|---|---|---|---|
| `quotation_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for each quotation |
| `customer_id` | INT | FOREIGN KEY → customers | Links quotation to a customer |
| `total_amount` | DECIMAL(15,2) | DEFAULT 0.00 | Sum of all line items |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Automatically records when quotation was created |

> `FOREIGN KEY` on `customer_id` ensures you cannot create a quotation for a customer that does not exist — enforces referential integrity.

---

### 4. `quotation_items`

Junction table that links quotations to products. One quotation can have many products.

| Column | Data Type | Constraint | Why |
|---|---|---|---|
| `item_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for each line item |
| `quotation_id` | INT | FOREIGN KEY → quotations | Links item to its quotation |
| `product_id` | INT | FOREIGN KEY → products | Links item to its product |
| `quantity` | DECIMAL(10,2) | NULL allowed | Quantity in metres — decimal because fabric is measured in fractions |
| `unit_price_at_time` | DECIMAL(10,2) | NULL allowed | Price snapshot at time of quote |

> `unit_price_at_time` is the most important design decision. It copies the product's base price at the time the quotation is created. This means if a product price changes in the future, old quotations are not affected — which is critical for billing accuracy.

---

## Relationships
```
customers (1) ──── (many) quotations (1) ──── (many) quotation_items (many) ──── (1) products
```

- One customer can have many quotations
- One quotation can have many quotation items
- Each quotation item belongs to one product
- `quotation_items` is a junction table resolving the many-to-many relationship between quotations and products

---

## Indexes
```sql
INDEX customer_id ON quotations
INDEX quotation_id ON quotation_items
INDEX product_id ON quotation_items
```

Indexes are added on all foreign key columns to speed up JOIN queries when fetching quotation details.

---

## ERD

![ERD](https://raw.githubusercontent.com/Rewant1908/CSE250-TextileQuotation/main/database/erd.png)
