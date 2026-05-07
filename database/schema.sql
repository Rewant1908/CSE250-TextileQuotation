-- =============================================================
-- KT IMPEX — Wholesale Textile Operating Schema
-- Database : kt_impex
-- Engine   : MariaDB
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- Drop tables in reverse dependency order.
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `inventory_movements`;
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `quotation_items`;
DROP TABLE IF EXISTS `quotations`;
DROP TABLE IF EXISTS `thans`;
DROP TABLE IF EXISTS `bales`;
DROP TABLE IF EXISTS `retailers`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `suppliers`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- 1. users
-- =============================================================
CREATE TABLE `users` (
  `user_id`    int(11)              NOT NULL AUTO_INCREMENT,
  `username`   varchar(50)          NOT NULL,
  `password`   varchar(255)         NOT NULL,
  `email`      varchar(254)         DEFAULT NULL,
  `role`       enum('admin','user') NOT NULL DEFAULT 'user',
  `created_at` timestamp            NULL DEFAULT current_timestamp(),
  `updated_at` timestamp            NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_username` (`username`),
  UNIQUE KEY `uq_user_email` (`email`),
  CONSTRAINT `chk_user_email_fmt`
    CHECK (`email` IS NULL OR `email` LIKE '%@%.%')
);

-- =============================================================
-- 2. suppliers
--    Factory and supplier intelligence for procurement decisions.
-- =============================================================
CREATE TABLE `suppliers` (
  `supplier_id`            int(11)      NOT NULL AUTO_INCREMENT,
  `supplier_name`          varchar(150) NOT NULL,
  `factory_name`           varchar(150) DEFAULT NULL,
  `product_specialization` varchar(150) DEFAULT NULL,
  `quality_rating`         decimal(3,2) DEFAULT NULL,
  `delay_frequency`        enum('low','medium','high') DEFAULT 'medium',
  `price_range`            varchar(80)  DEFAULT NULL,
  `popular_categories`     varchar(255) DEFAULT NULL,
  `return_issues`          text         DEFAULT NULL,
  `trend_alignment`        enum('weak','average','strong') DEFAULT 'average',
  `created_at`             timestamp    NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`supplier_id`),
  UNIQUE KEY `uq_supplier_name` (`supplier_name`),
  CONSTRAINT `chk_supplier_quality`
    CHECK (`quality_rating` IS NULL OR (`quality_rating` >= 0 AND `quality_rating` <= 5))
);

-- =============================================================
-- 3. customers
--    Existing quotation customer table retained for compatibility.
-- =============================================================
CREATE TABLE `customers` (
  `customer_id`   int(11)      NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(150) NOT NULL,
  `contact_phone` varchar(20)  DEFAULT NULL,
  `email`         varchar(254) DEFAULT NULL,
  PRIMARY KEY (`customer_id`),
  CONSTRAINT `chk_customer_email_fmt`
    CHECK (`email` IS NULL OR `email` LIKE '%@%.%')
);

-- =============================================================
-- 4. retailers
--    Retailer memory layer. Can map to a quotation customer.
-- =============================================================
CREATE TABLE `retailers` (
  `retailer_id`             int(11)      NOT NULL AUTO_INCREMENT,
  `customer_id`             int(11)      DEFAULT NULL,
  `shop_name`               varchar(150) NOT NULL,
  `market_location`         varchar(150) DEFAULT NULL,
  `phone_number`            varchar(20)  DEFAULT NULL,
  `preferred_categories`    varchar(255) DEFAULT NULL,
  `payment_pattern`         enum('advance','on_delivery','credit_good','credit_slow','risky') DEFAULT 'on_delivery',
  `average_order_size`      decimal(12,2) DEFAULT NULL,
  `seasonal_trends`         text         DEFAULT NULL,
  `outstanding_balance`     decimal(12,2) NOT NULL DEFAULT 0.00,
  `preferred_price_segment` enum('budget','mid','premium','mixed') DEFAULT 'mixed',
  `notes`                   text         DEFAULT NULL,
  `created_at`              timestamp    NULL DEFAULT current_timestamp(),
  `updated_at`              timestamp    NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`retailer_id`),
  KEY `idx_retailer_customer` (`customer_id`),
  KEY `idx_retailer_market` (`market_location`),
  CONSTRAINT `fk_retailer_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`)
    ON DELETE SET NULL
);

-- =============================================================
-- 5. products
--    Fabric product catalogue with category and base pricing.
-- =============================================================
CREATE TABLE `products` (
  `product_id`   int(11) NOT NULL AUTO_INCREMENT,
  `product_name` varchar(150) NOT NULL,
  `category`     enum('Suiting','Shirting','Dress Material','Furnishing','Denim','Knitwear','Cotton','Synthetic','Printed') NOT NULL,
  `base_price`   decimal(10,2) NOT NULL,
  `created_at`   timestamp NULL DEFAULT current_timestamp(),
  `updated_at`   timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`product_id`),
  KEY `idx_product_category` (`category`),
  CONSTRAINT `chk_product_price`
    CHECK (`base_price` > 0)
);

-- =============================================================
-- 6. bales
--    Parent purchase unit: factory-packed Gathri/Bale.
-- =============================================================
CREATE TABLE `bales` (
  `bale_id`          int(11) NOT NULL AUTO_INCREMENT,
  `bale_code`        varchar(40) NOT NULL,
  `supplier_id`      int(11) DEFAULT NULL,
  `factory_name`     varchar(150) DEFAULT NULL,
  `arrival_date`     date NOT NULL,
  `purchase_cost`    decimal(12,2) NOT NULL,
  `transport_cost`   decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_rolls`      int(11) NOT NULL,
  `fabric_category`  varchar(100) NOT NULL,
  `purchase_invoice` varchar(100) DEFAULT NULL,
  `status`           enum('received','opened','partially_sold','sold_out','returned') NOT NULL DEFAULT 'received',
  `created_at`       timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`bale_id`),
  UNIQUE KEY `uq_bale_code` (`bale_code`),
  KEY `idx_bale_supplier` (`supplier_id`),
  KEY `idx_bale_arrival` (`arrival_date`),
  CONSTRAINT `fk_bale_supplier`
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`)
    ON DELETE SET NULL,
  CONSTRAINT `chk_bale_cost`
    CHECK (`purchase_cost` >= 0 AND `transport_cost` >= 0),
  CONSTRAINT `chk_bale_rolls`
    CHECK (`total_rolls` > 0)
);

-- =============================================================
-- 7. thans
--    Sellable inventory unit broken out from a bale.
-- =============================================================
CREATE TABLE `thans` (
  `than_id`            int(11) NOT NULL AUTO_INCREMENT,
  `than_code`          varchar(40) NOT NULL,
  `bale_id`            int(11) DEFAULT NULL,
  `product_id`         int(11) DEFAULT NULL,
  `fabric_type`        varchar(100) NOT NULL,
  `color`              varchar(80) DEFAULT NULL,
  `design`             varchar(120) DEFAULT NULL,
  `gsm`                int(11) DEFAULT NULL,
  `meter_length`       decimal(10,2) NOT NULL DEFAULT 17.00,
  `cost_per_meter`     decimal(10,2) NOT NULL,
  `selling_price`      decimal(10,2) NOT NULL,
  `remaining_stock`    decimal(10,2) NOT NULL,
  `warehouse_location` varchar(80) DEFAULT NULL,
  `movement_speed`     enum('new','slow','medium','fast','dead') NOT NULL DEFAULT 'new',
  `status`             enum('available','reserved','sold_out','damaged','returned') NOT NULL DEFAULT 'available',
  `image_url`          varchar(500) DEFAULT NULL,
  `created_at`         timestamp NULL DEFAULT current_timestamp(),
  `updated_at`         timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`than_id`),
  UNIQUE KEY `uq_than_code` (`than_code`),
  KEY `idx_than_bale` (`bale_id`),
  KEY `idx_than_product` (`product_id`),
  KEY `idx_than_location` (`warehouse_location`),
  KEY `idx_than_speed` (`movement_speed`),
  CONSTRAINT `fk_than_bale`
    FOREIGN KEY (`bale_id`) REFERENCES `bales` (`bale_id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_than_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`)
    ON DELETE SET NULL,
  CONSTRAINT `chk_than_meter_length`
    CHECK (`meter_length` > 0),
  CONSTRAINT `chk_than_remaining`
    CHECK (`remaining_stock` >= 0),
  CONSTRAINT `chk_than_prices`
    CHECK (`cost_per_meter` >= 0 AND `selling_price` >= 0)
);

-- =============================================================
-- 8. quotations
-- =============================================================
CREATE TABLE `quotations` (
  `quotation_id`   int(11) NOT NULL AUTO_INCREMENT,
  `customer_id`    int(11) DEFAULT NULL,
  `user_id`        int(11) DEFAULT NULL,
  `status`         enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  `total_amount`   decimal(15,2) DEFAULT 0.00,
  `decline_reason` varchar(500) DEFAULT NULL,
  `created_at`     timestamp NULL DEFAULT current_timestamp(),
  `updated_at`     timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`quotation_id`),
  KEY `idx_quot_customer` (`customer_id`),
  KEY `idx_quot_user` (`user_id`),
  CONSTRAINT `fk_quot_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`)
    ON DELETE RESTRICT,
  CONSTRAINT `fk_quot_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
    ON DELETE SET NULL
);

-- =============================================================
-- 9. quotation_items
-- =============================================================
CREATE TABLE `quotation_items` (
  `item_id`            int(11) NOT NULL AUTO_INCREMENT,
  `quotation_id`       int(11) DEFAULT NULL,
  `product_id`         int(11) DEFAULT NULL,
  `than_id`            int(11) DEFAULT NULL,
  `quantity`           decimal(10,2) NOT NULL,
  `unit_price_at_time` decimal(10,2) NOT NULL,
  PRIMARY KEY (`item_id`),
  KEY `idx_qi_quotation` (`quotation_id`),
  KEY `idx_qi_product` (`product_id`),
  KEY `idx_qi_than` (`than_id`),
  CONSTRAINT `fk_qi_quotation`
    FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`quotation_id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_qi_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`)
    ON DELETE RESTRICT,
  CONSTRAINT `fk_qi_than`
    FOREIGN KEY (`than_id`) REFERENCES `thans` (`than_id`)
    ON DELETE SET NULL,
  CONSTRAINT `chk_qty`
    CHECK (`quantity` > 0),
  CONSTRAINT `chk_unit_price`
    CHECK (`unit_price_at_time` > 0)
);

-- =============================================================
-- 10. transactions
--     Accepted sales facts used by analytics and future AI.
-- =============================================================
CREATE TABLE `transactions` (
  `transaction_id` int(11) NOT NULL AUTO_INCREMENT,
  `retailer_id`    int(11) DEFAULT NULL,
  `quotation_id`   int(11) DEFAULT NULL,
  `than_id`        int(11) DEFAULT NULL,
  `product_id`     int(11) DEFAULT NULL,
  `quantity`       decimal(10,2) NOT NULL,
  `price`          decimal(10,2) NOT NULL,
  `discount`       decimal(10,2) NOT NULL DEFAULT 0.00,
  `payment_method` enum('cash','bank','upi','credit','mixed') DEFAULT 'cash',
  `margin`         decimal(12,2) NOT NULL DEFAULT 0.00,
  `transaction_date` date NOT NULL,
  `created_at`     timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`transaction_id`),
  KEY `idx_txn_retailer` (`retailer_id`),
  KEY `idx_txn_than` (`than_id`),
  KEY `idx_txn_product` (`product_id`),
  KEY `idx_txn_date` (`transaction_date`),
  CONSTRAINT `fk_txn_retailer`
    FOREIGN KEY (`retailer_id`) REFERENCES `retailers` (`retailer_id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_txn_quotation`
    FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`quotation_id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_txn_than`
    FOREIGN KEY (`than_id`) REFERENCES `thans` (`than_id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_txn_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`)
    ON DELETE SET NULL,
  CONSTRAINT `chk_txn_amounts`
    CHECK (`quantity` > 0 AND `price` >= 0 AND `discount` >= 0)
);

-- =============================================================
-- 11. inventory_movements
--     Complete stock ledger for stock in/out/transfers/returns.
-- =============================================================
CREATE TABLE `inventory_movements` (
  `movement_id`   int(11) NOT NULL AUTO_INCREMENT,
  `than_id`       int(11) DEFAULT NULL,
  `movement_type` enum('stock_in','stock_out','transfer','return','adjustment','damage') NOT NULL,
  `quantity`      decimal(10,2) NOT NULL,
  `from_location` varchar(80) DEFAULT NULL,
  `to_location`   varchar(80) DEFAULT NULL,
  `reference_type` varchar(40) DEFAULT NULL,
  `reference_id`   int(11) DEFAULT NULL,
  `notes`          varchar(500) DEFAULT NULL,
  `movement_date`  timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`movement_id`),
  KEY `idx_move_than` (`than_id`),
  KEY `idx_move_type` (`movement_type`),
  KEY `idx_move_date` (`movement_date`),
  CONSTRAINT `fk_move_than`
    FOREIGN KEY (`than_id`) REFERENCES `thans` (`than_id`)
    ON DELETE SET NULL,
  CONSTRAINT `chk_move_qty`
    CHECK (`quantity` > 0)
);
