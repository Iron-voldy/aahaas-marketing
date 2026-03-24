-- ============================================================
--  Aahaas Marketing Analytics - MySQL Database Schema
--  Database:  aahaas_marketing
--  Mirrors the Firebase Firestore collections:
--    packages, seasonal_offers, audit_logs
-- ============================================================

CREATE DATABASE IF NOT EXISTS aahaas_marketing
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE aahaas_marketing;

-- ─────────────────────────────────────────
--  TABLE: packages
--  Mirrors the `packages` Firestore collection.
--  Every Firestore document is one row.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
    -- Ids & Meta
    id                              VARCHAR(100)    NOT NULL,   -- Firestore document ID
    package_name                    VARCHAR(255),               -- "Package" field
    country                         VARCHAR(100),
    date_published                  VARCHAR(50),                -- stored as-is (DD-MM-YYYY or similar)
    validity_period                 VARCHAR(100),

    -- Facebook metrics
    fb_reach                        BIGINT          DEFAULT 0,
    fb_reactions                    BIGINT          DEFAULT 0,  -- "FB Interactions (Reactions)"
    fb_comments                     BIGINT          DEFAULT 0,
    fb_shares                       BIGINT          DEFAULT 0,
    fb_saves                        BIGINT          DEFAULT 0,  -- "FB Interactions (Saves)"
    fb_total_clicks                 BIGINT          DEFAULT 0,
    fb_link_clicks                  BIGINT          DEFAULT 0,

    -- Instagram metrics
    ig_reach                        BIGINT          DEFAULT 0,
    ig_reactions                    BIGINT          DEFAULT 0,  -- "IG Interactions (Reactions)"
    ig_comments                     BIGINT          DEFAULT 0,
    ig_shares                       BIGINT          DEFAULT 0,
    ig_saves                        BIGINT          DEFAULT 0,  -- "IG Interactions (Saves)"

    -- Combined / Aggregated
    combined_reach                  BIGINT          DEFAULT 0,
    total_reactions                 BIGINT          DEFAULT 0,
    total_shares                    BIGINT          DEFAULT 0,
    total_comments                  BIGINT          DEFAULT 0,

    -- Ad / Boost metrics
    amount_spent_usd                DECIMAL(12, 4)  DEFAULT 0,
    messaging_conversations_started BIGINT          DEFAULT 0,
    impressions                     BIGINT          DEFAULT 0,
    ad_cpm                          DECIMAL(12, 4)  DEFAULT 0,

    -- Media
    image_url                       TEXT,

    -- History snapshot (JSON map: date -> { metric: value })
    history                         JSON,

    -- Timestamps
    updated_at                      DATETIME,
    created_at                      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────
--  TABLE: package_history
--  Flattened version of the history JSON for
--  easy time-series queries.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS package_history (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    package_id      VARCHAR(100)    NOT NULL,
    snapshot_date   DATE            NOT NULL,               -- YYYY-MM-DD
    metric_key      VARCHAR(150)    NOT NULL,
    metric_value    DOUBLE,

    PRIMARY KEY (id),
    INDEX idx_pkg_date (package_id, snapshot_date),
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────
--  TABLE: seasonal_offers
--  Mirrors the `seasonal_offers` Firestore collection.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seasonal_offers (
    -- Identity
    id                  VARCHAR(100)    NOT NULL,           -- Firestore document ID
    name                VARCHAR(255),
    category            VARCHAR(100),                       -- e.g. "Spa", "Buffet"
    post_type           ENUM('single','group'),
    description         TEXT,
    validity_period     VARCHAR(100),
    price               VARCHAR(50),
    original_price      VARCHAR(50),
    date_published      VARCHAR(50),
    image_url           TEXT,
    image_urls          JSON,                               -- array of extra image URLs
    is_boosted          TINYINT(1)      DEFAULT 0,

    -- Facebook stats
    fb_reach            BIGINT          DEFAULT 0,
    fb_reactions        BIGINT          DEFAULT 0,
    fb_comments         BIGINT          DEFAULT 0,
    fb_shares           BIGINT          DEFAULT 0,
    fb_clicks           BIGINT          DEFAULT 0,

    -- Instagram stats
    ig_reach            BIGINT          DEFAULT 0,
    ig_reactions        BIGINT          DEFAULT 0,
    ig_comments         BIGINT          DEFAULT 0,
    ig_shares           BIGINT          DEFAULT 0,
    ig_saves            BIGINT          DEFAULT 0,
    combined_reach      BIGINT          DEFAULT 0,

    -- Ad / Boost stats
    ad_spend            DECIMAL(12, 4)  DEFAULT 0,
    impressions         BIGINT          DEFAULT 0,
    conversations       BIGINT          DEFAULT 0,

    -- Inquiries & Bookings
    inquiries           BIGINT          DEFAULT 0,
    inquiries_fb        BIGINT          DEFAULT 0,
    inquiries_ig        BIGINT          DEFAULT 0,
    inquiries_wa        BIGINT          DEFAULT 0,
    inquiries_web       BIGINT          DEFAULT 0,
    inquiries_other     BIGINT          DEFAULT 0,
    bookings            BIGINT          DEFAULT 0,

    -- Timestamps
    updated_at          DATETIME,
    created_at          DATETIME        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────
--  TABLE: audit_logs
--  Mirrors the `audit_logs` Firestore collection.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id          VARCHAR(100)    NOT NULL,                   -- Firestore document ID
    email       VARCHAR(255),
    action      TEXT,
    timestamp   DATETIME,
    created_at  DATETIME        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_email     (email),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────
--  Useful views
-- ─────────────────────────────────────────

-- Latest snapshot per package (most recent history date)
CREATE OR REPLACE VIEW v_package_latest AS
SELECT p.*,
       ph.snapshot_date AS latest_snapshot_date
FROM   packages p
LEFT JOIN (
    SELECT package_id,
           MAX(snapshot_date) AS snapshot_date
    FROM   package_history
    GROUP BY package_id
) ph ON ph.package_id = p.id;


-- Offer performance overview
CREATE OR REPLACE VIEW v_offer_performance AS
SELECT id,
       name,
       category,
       date_published,
       (fb_reach + ig_reach)                                AS total_reach,
       (fb_reactions + ig_reactions)                        AS total_reactions,
       (fb_comments + ig_comments)                          AS total_comments,
       (fb_shares + ig_shares)                              AS total_shares,
       combined_reach,
       ad_spend,
       inquiries,
       bookings,
       CASE WHEN inquiries > 0
            THEN ROUND(bookings / inquiries * 100, 2)
            ELSE 0 END                                       AS booking_rate_pct
FROM   seasonal_offers;
