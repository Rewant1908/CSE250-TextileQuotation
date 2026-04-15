-- schema.sql — Canonical migration. Run this once to create all tables.
-- After running, create the admin user with a bcrypt password:
--   Step 1: Generate hash:
--     node -e "import('bcrypt').then(b => b.default.hash('yourpassword', 10).then(console.log))"
--   Step 2: Insert admin row:
--     INSERT INTO users (username, password, role) VALUES ('admin', '<paste_hash_here>', 'admin');

CREATE TABLE IF NOT EXISTS users (
    user_id    INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50)            NOT NULL UNIQUE,
    password   VARCHAR(255)           NOT NULL,
    email      VARCHAR(150)           NULL UNIQUE,
    role       ENUM('admin', 'user')  NOT NULL DEFAULT 'user',
    created_at TIMESTAMP              DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP              DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id   INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(20)  NULL,
    email         VARCHAR(100) NULL,
    CONSTRAINT chk_customer_email_fmt CHECK (email IS NULL OR email LIKE '%@%.%')
);

CREATE TABLE IF NOT EXISTS products (
    product_id   INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(150)   NOT NULL,
    category     VARCHAR(50)    NOT NULL,
    base_price   DECIMAL(10, 2) NOT NULL,
    CONSTRAINT chk_base_price CHECK (base_price > 0),
    created_at   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotations (
    quotation_id   INT AUTO_INCREMENT PRIMARY KEY,
    customer_id    INT            NULL,
    user_id        INT            NULL,
    total_amount   DECIMAL(15, 2) DEFAULT 0.00 NULL,
    status         ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
    decline_reason VARCHAR(500)   NULL,
    created_at     TIMESTAMP      DEFAULT CURRENT_TIMESTAMP NULL,
    updated_at     TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NULL,
    CONSTRAINT quotations_ibfk_1 FOREIGN KEY (customer_id) REFERENCES customers (customer_id),
    CONSTRAINT fk_quot_user      FOREIGN KEY (user_id)      REFERENCES users (user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS quotation_items (
    item_id            INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id       INT            NULL,
    product_id         INT            NULL,
    quantity           DECIMAL(10, 2) NULL,
    unit_price_at_time DECIMAL(10, 2) NULL,
    CONSTRAINT chk_qty CHECK (quantity > 0),
    CONSTRAINT chk_unit_price CHECK (unit_price_at_time > 0),
    CONSTRAINT quotation_items_ibfk_1 FOREIGN KEY (quotation_id) REFERENCES quotations (quotation_id) ON DELETE CASCADE,
    CONSTRAINT quotation_items_ibfk_2 FOREIGN KEY (product_id)   REFERENCES products (product_id)
);

CREATE INDEX IF NOT EXISTS idx_qi_product   ON quotation_items (product_id);
CREATE INDEX IF NOT EXISTS idx_qi_quotation ON quotation_items (quotation_id);
CREATE INDEX IF NOT EXISTS idx_q_customer   ON quotations (customer_id);
CREATE INDEX IF NOT EXISTS idx_q_user       ON quotations (user_id);
