# Admin DB — Test SQL Entries

## Database Connection
```
DBMS      : MariaDB 10.6.23
Database  : kt_impex
Host      : localhost
Port      : 3306
```

## Seed App Entry
```sql
INSERT INTO app (code, name, description)
VALUES ('KT-IMPEX', 'KT Impex Textile Quotation', 'Textile quotation management system');
```

## Seed Permissions
```sql
INSERT INTO `permission` (app_id, code, name) VALUES
  (1, 'VIEW_PRODUCTS',           'View Products'),
  (1, 'MANAGE_PRODUCTS',         'Manage Products'),
  (1, 'REGISTER_CUSTOMER',       'Register Customer'),
  (1, 'CREATE_QUOTATION',        'Create Quotation'),
  (1, 'VIEW_OWN_QUOTATIONS',     'View Own Quotations'),
  (1, 'VIEW_ALL_QUOTATIONS',     'View All Quotations'),
  (1, 'MANAGE_QUOTATION_STATUS', 'Manage Quotation Status');
```

## Seed Roles
```sql
INSERT INTO `role` (app_id, code, name) VALUES
  (1, 'ADMIN', 'Administrator'),
  (1, 'USER',  'Sales User');
```

## Check a user's permissions
```sql
SELECT p.code, p.name
FROM app_user_role aur
JOIN role_permission rp ON rp.role_id  = aur.role_id
JOIN `permission`   p  ON p.id         = rp.permission_id
JOIN app            a  ON a.id         = aur.app_id
WHERE aur.user_id = 1
  AND a.code      = 'KT-IMPEX';
```

## Check if a user has a specific permission
```sql
SELECT COUNT(*) AS has_permission
FROM app_user_role aur
JOIN role_permission rp ON rp.role_id  = aur.role_id
JOIN `permission`   p  ON p.id         = rp.permission_id
JOIN app            a  ON a.id         = aur.app_id
WHERE aur.user_id = 1
  AND a.code      = 'KT-IMPEX'
  AND p.code      = 'MANAGE_PRODUCTS';
```

## List all users and their roles
```sql
SELECT u.username, r.code AS role, a.code AS app
FROM app_user_role aur
JOIN rbac_user u ON u.id = aur.user_id
JOIN `role`    r ON r.id = aur.role_id
JOIN app       a ON a.id = aur.app_id
WHERE a.code = 'KT-IMPEX';
```
