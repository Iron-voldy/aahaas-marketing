import type { Pool } from "mysql2/promise";

export async function ensureAdsTable(pool: Pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ad_campaigns (
            id                   BIGINT        NOT NULL AUTO_INCREMENT,
            batch_id             VARCHAR(100)  NOT NULL,
            reporting_starts     DATE,
            reporting_ends       DATE,
            ad_name              VARCHAR(500)  NOT NULL,
            ad_delivery          VARCHAR(100),
            results              INT           DEFAULT 0,
            result_indicator     VARCHAR(500),
            reach                BIGINT        DEFAULT 0,
            frequency            DECIMAL(10,6) DEFAULT 0,
            cost_per_result      DECIMAL(12,4) DEFAULT 0,
            ad_set_budget        VARCHAR(255),
            ad_set_budget_type   DECIMAL(12,4) DEFAULT 0,
            amount_spent_usd     DECIMAL(12,4) DEFAULT 0,
            ends                 DATE,
            impressions          BIGINT        DEFAULT 0,
            cpm_usd              DECIMAL(12,4) DEFAULT 0,
            link_clicks          INT           DEFAULT 0,
            cpc_link_click_usd   DECIMAL(12,4) DEFAULT 0,
            ctr_link_click       DECIMAL(10,6) DEFAULT 0,
            clicks_all           INT           DEFAULT 0,
            ctr_all              DECIMAL(10,6) DEFAULT 0,
            cpc_all_usd          DECIMAL(12,4) DEFAULT 0,
            booking_count        INT           DEFAULT 0,
            product_image_url    LONGTEXT,
            product_image_urls   JSON,
            created_at           DATETIME      DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_batch (batch_id),
            INDEX idx_ad_name (ad_name(100))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const alterStatements = [
        "ALTER TABLE ad_campaigns ADD COLUMN booking_count INT DEFAULT 0",
        "ALTER TABLE ad_campaigns ADD COLUMN product_image_url LONGTEXT NULL",
        "ALTER TABLE ad_campaigns ADD COLUMN product_image_urls JSON NULL",
    ];

    for (const statement of alterStatements) {
        try {
            await pool.query(statement);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.toLowerCase().includes("duplicate column")) {
                throw error;
            }
        }
    }
}

function normalizeImageUrls(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((item) => String(item)).filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item)).filter(Boolean);
            }
        } catch {
            return [value];
        }
    }

    return [];
}

export function normalizeAdCampaign<T extends Record<string, unknown>>(row: T) {
    const productImageUrls = normalizeImageUrls(row.product_image_urls);
    const productImageUrl =
        typeof row.product_image_url === "string" && row.product_image_url.trim()
            ? row.product_image_url
            : productImageUrls[0] ?? null;

    return {
        ...row,
        booking_count: Number(row.booking_count) || 0,
        product_image_url: productImageUrl,
        product_image_urls: productImageUrls,
    };
}
