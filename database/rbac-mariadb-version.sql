-- ============================================================
-- RBAC Schema for kt_impex (Textile Quotation System)
-- Adapted from AU-SAS/cse250 professor reference schema
-- Tables: app, permission, role, role_permission, user, app_user_role
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS app_user_role;
DROP TABLE IF EXISTS role_permission;
DROP TABLE IF EXISTS `permission`;
DROP TABLE IF EXISTS `role`;
DROP TABLE IF EXISTS `rbac_user`;
DROP TABLE IF EXISTS app;

SET FOREIGN_KEY_CHECKS = 1;

-- ── app ──────────────────────────────────────────────────────
CREATE TABLE app (
  id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(100)      NOT NULL,
  name        VARCHAR(200)      NOT NULL,
  description VARCHAR(500)      NULL,
  is_active   TINYINT(1)        NOT NULL DEFAULT 1,
  created_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_app_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── rbac_user ────────────────────────────────────────────────
-- NOTE: Named rbac_user to avoid clash with existing `users` table.
-- In a full migration, `users` should be replaced by this table.
CREATE TABLE `rbac_user` (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  username      VARCHAR(100)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,   -- bcrypt hash, never plaintext
  email         VARCHAR(254)  NULL,
  display_name  VARCHAR(200)  NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rbac_user_username (username),
  UNIQUE KEY uk_rbac_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── permission ───────────────────────────────────────────────
CREATE TABLE `permission` (
  id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  app_id      SMALLINT UNSIGNED NOT NULL,
  code        VARCHAR(100)      NOT NULL,
  name        VARCHAR(200)      NOT NULL,
  description VARCHAR(500)      NULL,
  created_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_permission_app_code (app_id, code),
  KEY idx_permission_app_id (app_id),
  CONSTRAINT fk_permission_app
    FOREIGN KEY (app_id) REFERENCES app(id)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── role ─────────────────────────────────────────────────────
CREATE TABLE `role` (
  id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  app_id      SMALLINT UNSIGNED NOT NULL,
  code        VARCHAR(100)      NOT NULL,
  name        VARCHAR(200)      NOT NULL,
  description VARCHAR(500)      NULL,
  created_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_role_app_code (app_id, code),
  KEY idx_role_app_id (app_id),
  CONSTRAINT fk_role_app
    FOREIGN KEY (app_id) REFERENCES app(id)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── role_permission ──────────────────────────────────────────
CREATE TABLE role_permission (
  role_id       SMALLINT UNSIGNED NOT NULL,
  permission_id SMALLINT UNSIGNED NOT NULL,
  granted_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_rp_permission_id (permission_id),
  CONSTRAINT fk_rp_role
    FOREIGN KEY (role_id) REFERENCES `role`(id)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_rp_permission
    FOREIGN KEY (permission_id) REFERENCES `permission`(id)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── app_user_role ─────────────────────────────────────────────
CREATE TABLE app_user_role (
  app_id      SMALLINT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED      NOT NULL,
  role_id     SMALLINT UNSIGNED NOT NULL,
  assigned_at DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (app_id, user_id, role_id),
  KEY idx_aur_user_id (user_id),
  KEY idx_aur_role_id (role_id),
  CONSTRAINT fk_aur_app
    FOREIGN KEY (app_id)  REFERENCES app(id)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_aur_user
    FOREIGN KEY (user_id) REFERENCES `rbac_user`(id)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_aur_role
    FOREIGN KEY (role_id) REFERENCES `role`(id)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA for kt_impex Textile Quotation System
-- ============================================================

-- App entry
INSERT INTO app (code, name, description) VALUES
  ('KT-IMPEX', 'KT Impex Textile Quotation', 'Pacific International import-export textile quotation management system');

-- Permissions (app_id = 1)
INSERT INTO `permission` (app_id, code, name, description) VALUES
  (1, 'VIEW_PRODUCTS',           'View Products',          'Can view the product catalogue'),
  (1, 'MANAGE_PRODUCTS',         'Manage Products',         'Can add, edit and delete products'),
  (1, 'REGISTER_CUSTOMER',       'Register Customer',       'Can register a new customer enquiry'),
  (1, 'CREATE_QUOTATION',        'Create Quotation',        'Can raise a new quotation'),
  (1, 'VIEW_OWN_QUOTATIONS',     'View Own Quotations',     'Can view quotations raised by self'),
  (1, 'VIEW_ALL_QUOTATIONS',     'View All Quotations',     'Can view all quotations in the system'),
  (1, 'MANAGE_QUOTATION_STATUS', 'Manage Quotation Status', 'Can accept or decline any quotation');

-- Roles (app_id = 1)
INSERT INTO `role` (app_id, code, name, description) VALUES
  (1, 'ADMIN', 'Administrator', 'Full access: manages products and all quotations'),
  (1, 'USER',  'Sales User',    'Can register customers and raise quotations');

-- role_permission: ADMIN (role_id=1) gets all 7 permissions
INSERT INTO role_permission (role_id, permission_id) VALUES
  (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7);

-- role_permission: USER (role_id=2) gets 4 permissions
-- VIEW_PRODUCTS(1), REGISTER_CUSTOMER(3), CREATE_QUOTATION(4), VIEW_OWN_QUOTATIONS(5)
INSERT INTO role_permission (role_id, permission_id) VALUES
  (2,1),(2,3),(2,4),(2,5);

-- Seed admin user (replace password_hash with actual bcrypt hash of 'ktimpex')
INSERT INTO `rbac_user` (username, password_hash, email, display_name) VALUES
  ('admin', '$2b$10$PLACEHOLDER_REPLACE_WITH_BCRYPT_HASH', 'admin@ktimpex.com', 'KT Impex Admin');

-- Assign admin user (user_id=1) to ADMIN role (role_id=1) in app (app_id=1)
INSERT INTO app_user_role (app_id, user_id, role_id) VALUES (1, 1, 1);
