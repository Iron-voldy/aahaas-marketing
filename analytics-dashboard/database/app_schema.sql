-- ============================================================
--  Aahaas Marketing Analytics - Full MySQL Schema (No Firebase)
--  Database:  aahaas_marketing
-- ============================================================

USE aahaas_marketing;

-- ─────────────────────────────────────────
--  App Users (for authentication)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_users (
    id            INT           NOT NULL AUTO_INCREMENT,
    email         VARCHAR(255)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    name          VARCHAR(255),
    role          VARCHAR(50)   DEFAULT 'admin',
    created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────
--  Packages  (JSON-document style)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pkg_data (
    id         VARCHAR(36)  NOT NULL,
    data       JSON         NOT NULL,   -- all Row fields stored here
    history    JSON,                    -- { "YYYY-MM-DD": { metric: value } }
    updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────
--  Seasonal Offers  (JSON-document style)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offer_data (
    id         VARCHAR(36)  NOT NULL,
    data       JSON         NOT NULL,
    updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────
--  Audit Logs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_logs (
    id         INT          NOT NULL AUTO_INCREMENT,
    email      VARCHAR(255) NOT NULL,
    action     TEXT         NOT NULL,
    timestamp  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_timestamp (timestamp DESC),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
