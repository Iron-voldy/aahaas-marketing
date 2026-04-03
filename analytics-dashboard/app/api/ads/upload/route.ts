import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import * as XLSX from "xlsx";
import { randomUUID } from "crypto";

// Map Excel column header → DB column name
const HEADER_MAP: Record<string, string> = {
    "Reporting starts": "reporting_starts",
    "Reporting ends": "reporting_ends",
    "Ad name": "ad_name",
    "Ad delivery": "ad_delivery",
    "Results": "results",
    "Result indicator": "result_indicator",
    "Reach": "reach",
    "Frequency": "frequency",
    "Cost per results": "cost_per_result",
    "Ad set budget": "ad_set_budget",
    "Ad set budget type": "ad_set_budget_type",
    "Amount spent (USD)": "amount_spent_usd",
    "Ends": "ends",
    "Impressions": "impressions",
    "CPM (cost per 1,000 impressions) (USD)": "cpm_usd",
    "Link clicks": "link_clicks",
    "CPC (cost per link click) (USD)": "cpc_link_click_usd",
    "CTR (link click-through rate)": "ctr_link_click",
    "Clicks (all)": "clicks_all",
    "CTR (all)": "ctr_all",
    "CPC (all) (USD)": "cpc_all_usd",
};

const DATE_FIELDS = new Set(["reporting_starts", "reporting_ends", "ends"]);

function toSqlDate(val: unknown): string | null {
    if (!val) return null;
    if (typeof val === "string") {
        // Already ISO string like "2026-01-01"
        const clean = val.trim().slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    }
    if (typeof val === "number") {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(val);
        if (d) {
            const mm = String(d.M).padStart(2, "0");
            const dd = String(d.d).padStart(2, "0");
            return `${d.y}-${mm}-${dd}`;
        }
    }
    return null;
}

export async function POST(request: Request) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) return NextResponse.json({ error: "Empty workbook" }, { status: 400 });

        const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
        if (rows.length < 2) return NextResponse.json({ error: "No data rows found" }, { status: 400 });

        const headers = (rows[0] as string[]).map((h) => String(h ?? "").trim());
        const dataRows = rows.slice(1).filter((r) => (r as unknown[]).some((c) => c !== null && c !== undefined && c !== ""));

        const pool = getMysqlPool();

        // Ensure table exists
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

        const batchId = randomUUID();
        let inserted = 0;

        for (const rawRow of dataRows) {
            const row = rawRow as unknown[];
            const record: Record<string, unknown> = { batch_id: batchId };

            headers.forEach((header, i) => {
                const dbCol = HEADER_MAP[header];
                if (!dbCol) return;
                const val = row[i];
                if (DATE_FIELDS.has(dbCol)) {
                    record[dbCol] = toSqlDate(val);
                } else if (typeof val === "number") {
                    record[dbCol] = val;
                } else if (val !== null && val !== undefined && val !== "") {
                    record[dbCol] = String(val);
                } else {
                    record[dbCol] = null;
                }
            });

            // Skip rows missing an ad name
            if (!record["ad_name"]) continue;

            const cols = Object.keys(record).join(", ");
            const placeholders = Object.keys(record).map(() => "?").join(", ");
            const vals = Object.values(record);

            await pool.query(
                `INSERT INTO ad_campaigns (${cols}) VALUES (${placeholders})`,
                vals
            );
            inserted++;
        }

        return NextResponse.json({ ok: true, inserted, batchId });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[ads/upload]", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
