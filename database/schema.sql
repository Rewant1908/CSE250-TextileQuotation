-- =============================================================
-- KT IMPEX — Database Schema
-- Database : kt_impex
-- Engine   : MariaDB
-- =============================================================

<<<<<<< HEAD
SET FOREIGN_KEY_CHECKS = 0;
=======
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `customer_id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(150) NOT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `email` varchar(254) DEFAULT NULL,
  PRIMARY KEY (`customer_id`),
  CONSTRAINT `chk_customer_email_fmt` CHECK (`email` is null or `email` like '%@%.%')
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `product_id` int(11) NOT NULL AUTO_INCREMENT,
  `product_name` varchar(150) NOT NULL,
  `category` enum('Suiting','Shirting','Dress Material') NOT NULL,
  `base_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`product_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `quotation_items`
--
>>>>>>> 130f1b9 (Fixed merge conflicts)

-- -------------------------------------------------------------
-- Drop tables in reverse dependency order
-- (children before parents to avoid FK conflicts)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `quotation_items`;
DROP TABLE IF EXISTS `quotations`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- 1. users
--    Stores admin and regular user accounts.
--    Passwords are stored as bcrypt hashes (varchar 255).
-- =============================================================
CREATE TABLE `users` (
  `user_id`    int(11)                  NOT NULL AUTO_INCREMENT,
  `username`   varchar(50)              NOT NULL,
  `password`   varchar(255)             NOT NULL,           -- bcrypt hash
  `email`      varchar(254)             DEFAULT NULL,
  `role`       enum('admin','user')     NOT NULL DEFAULT 'user',
  `created_at` timestamp                NULL    DEFAULT current_timestamp(),
  `updated_at` timestamp                NULL    DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_username` (`username`)
) ;


-- =============================================================
-- 2. customers
--    Stores customer contact information.
--    Email format is validated via a CHECK constraint.
-- =============================================================
CREATE TABLE `customers` (
  `customer_id`   int(11)      NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(150) NOT NULL,
  `contact_phone` varchar(20)  DEFAULT NULL,
  `email`         varchar(254) DEFAULT NULL,
  PRIMARY KEY (`customer_id`),
  CONSTRAINT `chk_customer_email_fmt`
    CHECK (`email` IS NULL OR `email` LIKE '%@%.%')
) ;


-- =============================================================
-- 3. products
--    Fabric product catalogue with category and base pricing.
-- =============================================================
CREATE TABLE `products` (
  `product_id`   int(11)                                                   NOT NULL AUTO_INCREMENT,
  `product_name` varchar(150)                                               NOT NULL,
  `category`     enum('Suiting','Shirting','Furnishing','Denim','Knitwear') NOT NULL,
  `base_price`   decimal(10,2)                                              NOT NULL,
  `created_at`   timestamp NULL DEFAULT current_timestamp(),
  `updated_at`   timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`product_id`)
) ;


-- =============================================================
-- 4. quotations
--    A quotation is raised by a user for a customer.
--    total_amount is maintained by the application layer
--    as the sum of (quantity * unit_price_at_time) across
--    all related quotation_items rows.
--    ON DELETE RESTRICT on customer_id prevents orphaned
--    quotations if a customer record is deleted.
-- =============================================================
CREATE TABLE `quotations` (
  `quotation_id`   int(11)                              NOT NULL AUTO_INCREMENT,
  `customer_id`    int(11)                              DEFAULT NULL,
  `user_id`        int(11)                              DEFAULT NULL,
  `status`         enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  `total_amount`   decimal(15,2)                        DEFAULT 0.00,
  `decline_reason` varchar(500)                         DEFAULT NULL,
  `created_at`     timestamp NULL DEFAULT current_timestamp(),
  `updated_at`     timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`quotation_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_user_id`     (`user_id`),
  CONSTRAINT `fk_quot_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`)
    ON DELETE RESTRICT,
  CONSTRAINT `fk_quot_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
    ON DELETE SET NULL
) ;


-- =============================================================
-- 5. quotation_items
--    Line items belonging to a quotation.
--    Cascade-deleted when the parent quotation is removed.
--    unit_price_at_time captures the price at quote creation
--    so future product price changes do not alter old quotes.
-- =============================================================
CREATE TABLE `quotation_items` (
  `item_id`            int(11)       NOT NULL AUTO_INCREMENT,
  `quotation_id`       int(11)       DEFAULT NULL,
  `product_id`         int(11)       DEFAULT NULL,
  `quantity`           decimal(10,2) NOT NULL,
  `unit_price_at_time` decimal(10,2) NOT NULL,
  PRIMARY KEY (`item_id`),
  KEY `idx_qi_quotation` (`quotation_id`),
  KEY `idx_qi_product`   (`product_id`),
  CONSTRAINT `fk_qi_quotation`
    FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`quotation_id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_qi_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`)
    ON DELETE RESTRICT,
  CONSTRAINT `chk_qty`
    CHECK (`quantity` > 0),
  CONSTRAINT `chk_unit_price`
    CHECK (`unit_price_at_time` > 0)
) ;

