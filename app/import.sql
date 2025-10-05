-- Vaste Backend Database Setup
-- Execute this script to create the database structure for Vaste authentication backend

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS vaste_backend;
USE vaste_backend;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    profile_picture VARCHAR(255) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    
    -- Indexes for performance
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_uuid (uuid),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create game_servers table
CREATE TABLE IF NOT EXISTS game_servers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL,
    websocket_url VARCHAR(255) NOT NULL,
    max_players INT DEFAULT 10,
    current_players INT DEFAULT 0,
    is_online BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    owner_id INT NOT NULL,
    version VARCHAR(20) DEFAULT '1.0.0',
    tags VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_ping TIMESTAMP NULL,
    
    -- Foreign key constraint
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_uuid (uuid),
    INDEX idx_owner (owner_id),
    INDEX idx_public_online (is_public, is_online),
    INDEX idx_last_ping (last_ping)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create user_sessions table for token management (optional)
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_id VARCHAR(36) UNIQUE NOT NULL,
    jwt_token TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Foreign key constraint
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_user_id (user_id),
    INDEX idx_token_id (token_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create server_stats table for future features
CREATE TABLE IF NOT EXISTS server_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id INT NOT NULL,
    total_players_served INT DEFAULT 0,
    peak_players INT DEFAULT 0,
    uptime_hours DECIMAL(10,2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    FOREIGN KEY (server_id) REFERENCES game_servers(id) ON DELETE CASCADE,
    
    -- Index for performance
    INDEX idx_server_id (server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create stored procedures for common operations

-- Procedure to clean expired sessions
DELIMITER $$
CREATE PROCEDURE CleanExpiredSessions()
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR is_active = FALSE;
END$$
DELIMITER ;

-- Procedure to mark inactive servers offline
DELIMITER $$
CREATE PROCEDURE MarkInactiveServersOffline(IN timeout_minutes INT)
BEGIN
    UPDATE game_servers 
    SET is_online = FALSE 
    WHERE last_ping < DATE_SUB(NOW(), INTERVAL timeout_minutes MINUTE);
END$$
DELIMITER ;

-- Insert initial data (optional)

-- Create a default admin user (password: admin123 - CHANGE THIS IN PRODUCTION)
INSERT IGNORE INTO users (uuid, username, email, password, is_active) VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'admin@vaste.local',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/NeG.LKj1KBrQdH6F2', -- admin123
    TRUE
);

-- Show database structure
SHOW TABLES;

-- Display table structures
DESCRIBE users;
DESCRIBE game_servers;
DESCRIBE user_sessions;
DESCRIBE server_stats;

-- Display initial data
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as server_count FROM game_servers;

-- Success message
SELECT 'Database setup completed successfully!' as message;