-- ============================================================
--  Social Media Post Matching Tables
--  Used for bulk CSV import, post identification, and
--  automatic metric updates for packages & seasonal offers.
-- ============================================================

USE aahaas_marketing;

-- ─────────────────────────────────────────
--  TABLE: import_sessions
--  Tracks each bulk upload session.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_sessions (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    uploaded_at     DATETIME        DEFAULT CURRENT_TIMESTAMP,
    fb_posts_count  INT             DEFAULT 0,
    fb_videos_count INT             DEFAULT 0,
    ig_posts_count  INT             DEFAULT 0,
    ig_stories_count INT            DEFAULT 0,
    total_matched   INT             DEFAULT 0,
    total_unmatched INT             DEFAULT 0,
    status          ENUM('processing','review','applied','failed') DEFAULT 'processing',

    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────
--  TABLE: social_media_posts
--  Raw imported rows from all 4 CSV types.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_media_posts (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    import_session_id   BIGINT          NOT NULL,
    source_type         ENUM('fb_post','fb_video','ig_post','ig_story') NOT NULL,

    -- Identity
    post_id             VARCHAR(100),
    page_or_account_id  VARCHAR(100),
    title               TEXT,
    description         TEXT,
    publish_time        DATETIME,
    permalink           TEXT,
    post_type           VARCHAR(50),

    -- Common metrics
    reach               BIGINT          DEFAULT 0,
    views               BIGINT          DEFAULT 0,
    reactions           BIGINT          DEFAULT 0,
    comments            BIGINT          DEFAULT 0,
    shares              BIGINT          DEFAULT 0,
    saves               BIGINT          DEFAULT 0,
    total_clicks        BIGINT          DEFAULT 0,
    link_clicks         BIGINT          DEFAULT 0,
    other_clicks        BIGINT          DEFAULT 0,

    -- Video-specific
    three_sec_views     BIGINT          DEFAULT 0,
    one_min_views       BIGINT          DEFAULT 0,
    seconds_viewed      BIGINT          DEFAULT 0,
    avg_seconds_viewed  DECIMAL(10, 2)  DEFAULT 0,

    -- IG-specific
    profile_visits      BIGINT          DEFAULT 0,
    replies             BIGINT          DEFAULT 0,
    navigation          BIGINT          DEFAULT 0,
    follows             BIGINT          DEFAULT 0,

    -- Ad metrics
    ad_impressions      BIGINT          DEFAULT 0,
    ad_cpm              DECIMAL(12, 4)  DEFAULT 0,
    estimated_earnings  DECIMAL(12, 4)  DEFAULT 0,

    -- Identification results
    has_package_hashtag TINYINT(1)      DEFAULT 0,
    detected_category   ENUM('package','seasonal_offer','general') DEFAULT 'general',
    is_ignored          TINYINT(1)      DEFAULT 0,
    detected_country    VARCHAR(100),
    hashtags            TEXT,

    imported_at         DATETIME        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_session      (import_session_id),
    INDEX idx_source_post  (source_type, post_id),
    INDEX idx_publish_time (publish_time),
    INDEX idx_category     (detected_category),
    INDEX idx_is_ignored   (is_ignored),

    FOREIGN KEY (import_session_id) REFERENCES import_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────
--  TABLE: post_package_mapping
--  Links imported posts to Firebase packages
--  or seasonal offers.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_package_mapping (
    id                  BIGINT          NOT NULL AUTO_INCREMENT,
    post_id             BIGINT          NOT NULL,
    target_type         ENUM('package','seasonal_offer') NOT NULL,
    target_firebase_id  VARCHAR(100)    NOT NULL,
    match_method        ENUM('hashtag','date_country','title_keyword','date_proximity','manual') NOT NULL,
    confidence          DECIMAL(5, 2)   DEFAULT 0,
    matched_at          DATETIME        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_target (target_type, target_firebase_id),
    INDEX idx_post   (post_id),

    FOREIGN KEY (post_id) REFERENCES social_media_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
