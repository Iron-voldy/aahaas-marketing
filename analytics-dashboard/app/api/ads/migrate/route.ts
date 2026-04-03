import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";

export async function POST() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pool = getMysqlPool();
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
            created_at           DATETIME      DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_batch (batch_id),
            INDEX idx_ad_name (ad_name(100))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    return NextResponse.json({ ok: true });
}
