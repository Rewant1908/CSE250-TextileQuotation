-- Run this once in your MySQL database
-- Adds users table and status/user_id columns to quotations

CREATE TABLE IF NOT EXISTS users (
    user_id   INT AUTO_INCREMENT PRIMARY KEY,
    username  VARCHAR(50) NOT NULL UNIQUE,
    password  VARCHAR(100) NOT NULL,
    email     VARCHAR(150),
    role      ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin (change password as needed)
INSERT IGNORE INTO users (username, password, role) VALUES ('admin', 'ktimpex', 'admin');

-- Add user_id and status to quotations table (if not already present)
ALTER TABLE quotations
    ADD COLUMN IF NOT EXISTS user_id INT NULL,
    ADD COLUMN IF NOT EXISTS status ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
    ADD CONSTRAINT fk_quot_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;
