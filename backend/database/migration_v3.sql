-- =============================================================================
-- KT IMPEX — migration_v3.sql
-- Phase 5 database fixes — run ONCE on your MariaDB instance
-- Safe to run multiple times: all DDL uses IF NOT EXISTS / IF EXISTS guards
-- =============================================================================

-- ── Fix #1: quotation_number column ──────────────────────────────────────────
-- Add the quotation_number column that sales.MEMORY.md and agent prompts reference.
-- The application layer generates KTQ-YYYY-NNNNNN after INSERT and writes it back.
ALTER TABLE quotations
    ADD COLUMN IF NOT EXISTS quotation_number VARCHAR(20) NULL UNIQUE
        COMMENT 'Human-readable ref: KTQ-YYYY-000001. Set by app after INSERT.' AFTER quotation_id;

-- ── Fix #2: unified dead-stock status + lifecycle ENUM ────────────────────────
-- Extend quotations.status to match sales.MEMORY.md lifecycle:
--   draft → sent → accepted | declined
-- 'pending' is kept as a valid value so old rows are not broken.
ALTER TABLE quotations
    MODIFY COLUMN IF EXISTS status
        ENUM('draft','pending','sent','accepted','declined')
        NOT NULL DEFAULT 'draft'
        COMMENT 'Lifecycle: draft→sent→accepted|declined. pending=legacy alias for draft.';

-- ── Fix #3: preferred_categories_json already exists (migration_v2) ──────────
-- No DDL needed — column exists. Routes now query it (see retailers.js v3).

-- ── Fix #4: product_id on transactions ────────────────────────────────────────
-- Ensure product_id column exists (it may already be there in some deployments).
-- Routes now always populate it from thans.product_id at INSERT time.
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS product_id INT NULL
        COMMENT 'Denormalised from thans.product_id at sale time for analytics joins.'
        AFTER retailer_id;

ALTER TABLE transactions
    ADD CONSTRAINT IF NOT EXISTS fk_transactions_product
        FOREIGN KEY (product_id) REFERENCES products(product_id)
        ON DELETE SET NULL;

-- ── Fix #5: critical indexes ──────────────────────────────────────────────────
-- These cover the analytics queries most likely to table-scan on production data.

-- transactions: retailer analytics, date-range revenue queries
CREATE INDEX IF NOT EXISTS idx_tx_retailer_date
    ON transactions (retailer_id, transaction_date);

-- transactions: product-level analytics (now that product_id is populated)
CREATE INDEX IF NOT EXISTS idx_tx_product
    ON transactions (product_id);

-- inventory_movements: dead-stock classifier, movement history per than
CREATE INDEX IF NOT EXISTS idx_im_than_date
    ON inventory_movements (than_id, movement_date);

-- inventory_movements: movement_type filter (stock_out queries in refreshMovementSpeed)
CREATE INDEX IF NOT EXISTS idx_im_type
    ON inventory_movements (movement_type);

-- thans: dashboard dead-stock filter + movement_speed ORDER BY
CREATE INDEX IF NOT EXISTS idx_thans_speed_status
    ON thans (movement_speed, status);

-- thans: remaining_stock filter for inventory search
CREATE INDEX IF NOT EXISTS idx_thans_stock
    ON thans (remaining_stock);

-- retailers: soft-delete filter
CREATE INDEX IF NOT EXISTS idx_retailers_deleted
    ON retailers (is_deleted);

-- suppliers: soft-delete filter
CREATE INDEX IF NOT EXISTS idx_suppliers_deleted
    ON suppliers (is_deleted);

-- ── Fix #7: soft-delete columns on retailers + suppliers ─────────────────────
ALTER TABLE retailers
    ADD COLUMN IF NOT EXISTS is_deleted  TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Soft delete flag. 1 = deleted.' AFTER outstanding_balance,
    ADD COLUMN IF NOT EXISTS deleted_at  DATETIME   NULL AFTER is_deleted,
    ADD COLUMN IF NOT EXISTS deleted_by  INT        NULL
        COMMENT 'user_id of the user who deleted this row.' AFTER deleted_at;

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS is_deleted  TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Soft delete flag. 1 = deleted.' AFTER notes,
    ADD COLUMN IF NOT EXISTS deleted_at  DATETIME   NULL AFTER is_deleted,
    ADD COLUMN IF NOT EXISTS deleted_by  INT        NULL
        COMMENT 'user_id of the user who deleted this row.' AFTER deleted_at;

-- ── Fix #9: assigned_user_id on retailers ─────────────────────────────────────
-- Links a retailer to the salesperson who owns the relationship.
-- Sales agents see only their assigned retailers; admin sees all.
ALTER TABLE retailers
    ADD COLUMN IF NOT EXISTS assigned_user_id INT NULL
        COMMENT 'FK to users.user_id — salesperson who owns this retailer account.'
        AFTER deleted_by;

ALTER TABLE retailers
    ADD CONSTRAINT IF NOT EXISTS fk_retailers_assigned_user
        FOREIGN KEY (assigned_user_id) REFERENCES users(user_id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_retailers_assigned_user
    ON retailers (assigned_user_id);

-- ── Fix #10: embeddings table for Phase 6 vector/semantic search ──────────────
-- MariaDB does not support pgvector. We store embeddings as JSON arrays.
-- Phase 6 will compute cosine similarity in the application layer or
-- via a sidecar Python service. This scaffold ensures the table is ready.
CREATE TABLE IF NOT EXISTS retailer_embeddings (
    embedding_id    INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    retailer_id     INT          NOT NULL,
    embedding_model VARCHAR(64)  NOT NULL DEFAULT 'text-embedding-3-small'
                    COMMENT 'OpenAI model name used to generate this embedding.',
    embedding_json  LONGTEXT     NOT NULL
                    COMMENT 'JSON array of floats: [0.023, -0.14, ...]',
    input_text      TEXT         NULL
                    COMMENT 'The text that was embedded — for debugging / re-embedding.',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_embeddings_retailer
        FOREIGN KEY (retailer_id) REFERENCES retailers(retailer_id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_retailer_model (retailer_id, embedding_model)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Phase 6: retailer preference embeddings for semantic similarity search.';

CREATE INDEX IF NOT EXISTS idx_embeddings_retailer
    ON retailer_embeddings (retailer_id);

-- ── Done ──────────────────────────────────────────────────────────────────────
-- After running this migration:
--  1. Restart the backend (new routes expect the columns above)
--  2. Run POST /api/admin/recalculate-speeds to re-classify dead stock at 60 days
--  3. Verify quotation_number is generated on the next quotation POST
SELECT 'migration_v3 complete' AS status;
