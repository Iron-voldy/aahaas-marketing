/**
 * setup-mysql.js
 * ──────────────────────────────────────────────────────────
 * 1. Creates the `aahaas_marketing` MySQL database
 * 2. Runs schema.sql to create all tables and views
 * 3. Fetches all data from the running Next.js dev server
 *    (GET http://localhost:3000/api/export-db)
 * 4. Inserts every row into MySQL
 *
 * Usage (from the analytics-dashboard folder):
 *   node database/setup-mysql.js
 *
 * Requirements:
 *   npm install mysql2   (in analytics-dashboard)
 *   The Next.js dev server must be running on localhost:3000
 * ──────────────────────────────────────────────────────────
 */

const mysql = require("mysql2/promise");
const fs    = require("fs");
const path  = require("path");
const https = require("https");
const http  = require("http");

// ── Config ────────────────────────────────────────────────
const MYSQL_CONFIG = {
    host:     "localhost",
    port:     3306,
    user:     "root",
    password: "20020224Ha",
};
const DB_NAME       = "aahaas_marketing";
const SCHEMA_FILE   = path.join(__dirname, "schema.sql");
const EXPORT_URL    = "http://localhost:3000/api/export-db";
const EXPORTED_DIR  = path.join(__dirname, "exported");

// Use --from-files to read exported JSON instead of hitting the HTTP endpoint
const FROM_FILES = process.argv.includes("--from-files");
// ─────────────────────────────────────────────────────────

// Helper: fetch JSON from a URL
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith("https") ? https : http;
        client.get(url, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`JSON parse error from ${url}: ${e.message}\nBody: ${data.slice(0, 200)}`));
                }
            });
        }).on("error", reject);
    });
}

// Helper: execute a SQL string that may contain multiple statements
async function runMultiStatement(conn, sql) {
    // Strip comments and split on semicolons
    const statements = sql
        .replace(/--.*$/gm, "")               // remove line comments
        .replace(/\/\*[\s\S]*?\*\//g, "")     // remove block comments
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    for (const stmt of statements) {
        try {
            await conn.query(stmt);
        } catch (err) {
            // Ignore "already exists" warnings for CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE VIEW
            if (err.code !== "ER_TABLE_EXISTS_ERROR") {
                console.warn(`  [WARN] ${err.message.slice(0, 120)}`);
            }
        }
    }
}

// Helper: safe integer
function toInt(v) {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
}

// Helper: safe decimal
function toDec(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
}

// Helper: safe datetime string for MySQL (null if blank / invalid)
function toDatetime(v) {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace("T", " ");
}

// ── main ─────────────────────────────────────────────────
async function main() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  Aahaas Marketing — MySQL Database Setup");
    console.log("═══════════════════════════════════════════════════════\n");

    // 1. Connect to MySQL (no database selected yet)
    console.log("▶ Connecting to MySQL …");
    const conn = await mysql.createConnection(MYSQL_CONFIG);
    console.log("  ✓ Connected\n");

    // 2. Create database
    console.log(`▶ Creating database \`${DB_NAME}\` if it does not exist …`);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${DB_NAME}\``);
    console.log("  ✓ Database ready\n");

    // 3. Run schema (creates tables + views)
    console.log("▶ Applying schema …");
    const schemaSql = fs.readFileSync(SCHEMA_FILE, "utf-8");
    await runMultiStatement(conn, schemaSql);
    console.log("  ✓ Schema applied\n");

    // 4. Load data — either from exported JSON files or via HTTP
    let packages, offers, logs;

    if (FROM_FILES) {
        console.log(`▶ Loading data from exported JSON files in ${EXPORTED_DIR} …`);
        const readJson = (file) => {
            const p = path.join(EXPORTED_DIR, file);
            if (!fs.existsSync(p)) {
                console.warn(`  [WARN] ${p} not found — skipping`);
                return [];
            }
            return JSON.parse(fs.readFileSync(p, "utf-8"));
        };
        packages = readJson("packages.json");
        offers   = readJson("seasonal_offers.json");
        logs     = readJson("audit_logs.json");
        console.log(`  ✓ Loaded  ${packages.length} packages,  ${offers.length} offers,  ${logs.length} audit logs\n`);
    } else {
        console.log(`▶ Fetching data from ${EXPORT_URL} …`);
        let exportData;
        try {
            exportData = await fetchJson(EXPORT_URL);
        } catch (err) {
            console.error(`\n  ✗ Could not reach ${EXPORT_URL}`);
            console.error("    Make sure the Next.js dev server is running:  npm run dev");
            console.error("    Or run:  node database/export-firebase.js  first, then:");
            console.error("             node database/setup-mysql.js --from-files");
            console.error(`    Error: ${err.message}`);
            await conn.end();
            process.exit(1);
        }
        packages = exportData.packages ?? [];
        offers   = exportData.offers   ?? [];
        logs     = exportData.logs     ?? [];
        console.log(`  ✓ Received  ${packages.length} packages,  ${offers.length} offers,  ${logs.length} audit logs\n`);
    }
    // ── 5. Insert packages ────────────────────────────────
    console.log(`▶ Inserting ${packages.length} packages …`);
    let pkgInserted = 0, pkgSkipped = 0;

    for (const row of packages) {
        if (!row.id) { pkgSkipped++; continue; }

        const historyJson = row.history ? JSON.stringify(row.history) : null;
        const updatedAt   = toDatetime(row.updatedAt);

        try {
            await conn.query(
                `INSERT INTO packages
                 (id, package_name, country, date_published, validity_period,
                  fb_reach, fb_reactions, fb_comments, fb_shares, fb_saves,
                  fb_total_clicks, fb_link_clicks,
                  ig_reach, ig_reactions, ig_comments, ig_shares, ig_saves,
                  combined_reach, total_reactions, total_shares, total_comments,
                  amount_spent_usd, messaging_conversations_started, impressions, ad_cpm,
                  image_url, history, updated_at)
                 VALUES (?,?,?,?,?,  ?,?,?,?,?,  ?,?,  ?,?,?,?,?,  ?,?,?,?,  ?,?,?,?,  ?,?,?)
                 ON DUPLICATE KEY UPDATE
                  package_name                    = VALUES(package_name),
                  fb_reach                        = VALUES(fb_reach),
                  fb_reactions                    = VALUES(fb_reactions),
                  combined_reach                  = VALUES(combined_reach),
                  history                         = VALUES(history),
                  updated_at                      = VALUES(updated_at)`,
                [
                    row.id,
                    row["Package"]            || null,
                    row["Country"]            || null,
                    row["Date Published"]     || null,
                    row["Validity Period"]    || null,
                    toInt(row["FB Reach"]),
                    toInt(row["FB Interactions (Reactions)"]) || toInt(row["FB Reactions"]),
                    toInt(row["FB Comments"]),
                    toInt(row["FB Shares"]),
                    toInt(row["FB Interactions (Saves)"]) || toInt(row["FB Saves"]),
                    toInt(row["FB Total Clicks"]),
                    toInt(row["FB Link Clicks"]),
                    toInt(row["IG Reach"]),
                    toInt(row["IG Interactions (Reactions)"]) || toInt(row["IG Reactions"]),
                    toInt(row["IG Comments"]),
                    toInt(row["IG Shares"]),
                    toInt(row["IG Interactions (Saves)"]) || toInt(row["IG Saves"]),
                    toInt(row["Combined Reach"]),
                    toInt(row["Total Reactions"]),
                    toInt(row["Total Shares"]),
                    toInt(row["Total Comments"]),
                    toDec(row["Amount Spent (USD)"]),
                    toInt(row["FB + IG Messaging Conversations Started"]),
                    toInt(row["Impressions"]),
                    toDec(row["Ad CPM"]),
                    row["imageUrl"] || null,
                    historyJson,
                    updatedAt,
                ]
            );
            pkgInserted++;
        } catch (err) {
            console.warn(`  [WARN] Package "${row["Package"]}": ${err.message.slice(0, 100)}`);
            pkgSkipped++;
        }

        // ── Insert flattened history rows ──────────────────
        if (row.history && typeof row.history === "object") {
            for (const [dateKey, metrics] of Object.entries(row.history)) {
                if (typeof metrics !== "object") continue;
                for (const [metricKey, metricValue] of Object.entries(metrics)) {
                    const numVal = parseFloat(metricValue);
                    if (isNaN(numVal)) continue;
                    try {
                        await conn.query(
                            `INSERT IGNORE INTO package_history (package_id, snapshot_date, metric_key, metric_value)
                             VALUES (?, ?, ?, ?)`,
                            [row.id, dateKey, metricKey, numVal]
                        );
                    } catch { /* skip bad rows */ }
                }
            }
        }
    }
    console.log(`  ✓ Inserted: ${pkgInserted}   Skipped/Updated: ${pkgSkipped}\n`);

    // ── 6. Insert seasonal offers ─────────────────────────
    console.log(`▶ Inserting ${offers.length} seasonal offers …`);
    let offInserted = 0, offSkipped = 0;

    for (const o of offers) {
        if (!o.id) { offSkipped++; continue; }
        try {
            await conn.query(
                `INSERT INTO seasonal_offers
                 (id, name, category, post_type, description, validity_period,
                  price, original_price, date_published, image_url, image_urls, is_boosted,
                  fb_reach, fb_reactions, fb_comments, fb_shares, fb_clicks,
                  ig_reach, ig_reactions, ig_comments, ig_shares, ig_saves, combined_reach,
                  ad_spend, impressions, conversations,
                  inquiries, inquiries_fb, inquiries_ig, inquiries_wa, inquiries_web, inquiries_other,
                  bookings, updated_at)
                 VALUES (?,?,?,?,?,?,  ?,?,?,?,?,?,  ?,?,?,?,?,  ?,?,?,?,?,?,  ?,?,?,  ?,?,?,?,?,?,  ?,?)
                 ON DUPLICATE KEY UPDATE
                  name          = VALUES(name),
                  fb_reach      = VALUES(fb_reach),
                  ig_reach      = VALUES(ig_reach),
                  inquiries     = VALUES(inquiries),
                  bookings      = VALUES(bookings),
                  updated_at    = VALUES(updated_at)`,
                [
                    o.id,
                    o.name            || null,
                    o.category        || null,
                    o.postType        || null,
                    o.description     || null,
                    o.validityPeriod  || null,
                    o.price           || null,
                    o.originalPrice   || null,
                    o.datePublished   || null,
                    o.imageUrl        || null,
                    o.imageUrls       ? JSON.stringify(o.imageUrls) : null,
                    o.isBoosted       ? 1 : 0,
                    toInt(o.fbReach),
                    toInt(o.fbReactions),
                    toInt(o.fbComments),
                    toInt(o.fbShares),
                    toInt(o.fbClicks),
                    toInt(o.igReach),
                    toInt(o.igReactions),
                    toInt(o.igComments),
                    toInt(o.igShares),
                    toInt(o.igSaves),
                    toInt(o.combinedReach),
                    toDec(o.adSpend),
                    toInt(o.impressions),
                    toInt(o.conversations),
                    toInt(o.inquiries),
                    toInt(o.inquiriesFb),
                    toInt(o.inquiriesIg),
                    toInt(o.inquiriesWa),
                    toInt(o.inquiriesWeb),
                    toInt(o.inquiriesOther),
                    toInt(o.bookings),
                    toDatetime(o.updatedAt),
                ]
            );
            offInserted++;
        } catch (err) {
            console.warn(`  [WARN] Offer "${o.name}": ${err.message.slice(0, 100)}`);
            offSkipped++;
        }
    }
    console.log(`  ✓ Inserted: ${offInserted}   Skipped/Updated: ${offSkipped}\n`);

    // ── 7. Insert audit logs ──────────────────────────────
    console.log(`▶ Inserting ${logs.length} audit log entries …`);
    let logInserted = 0, logSkipped = 0;

    for (const l of logs) {
        if (!l.id) { logSkipped++; continue; }
        try {
            await conn.query(
                `INSERT IGNORE INTO audit_logs (id, email, action, timestamp)
                 VALUES (?, ?, ?, ?)`,
                [l.id, l.email || null, l.action || null, toDatetime(l.timestamp)]
            );
            logInserted++;
        } catch (err) {
            console.warn(`  [WARN] Log ${l.id}: ${err.message.slice(0, 80)}`);
            logSkipped++;
        }
    }
    console.log(`  ✓ Inserted: ${logInserted}   Skipped: ${logSkipped}\n`);

    // ── 8. Quick stats ────────────────────────────────────
    const [[{ pkg_count }]]     = await conn.query("SELECT COUNT(*) AS pkg_count FROM packages");
    const [[{ offer_count }]]   = await conn.query("SELECT COUNT(*) AS offer_count FROM seasonal_offers");
    const [[{ log_count }]]     = await conn.query("SELECT COUNT(*) AS log_count FROM audit_logs");
    const [[{ hist_count }]]    = await conn.query("SELECT COUNT(*) AS hist_count FROM package_history");

    console.log("═══════════════════════════════════════════════════════");
    console.log("  Database setup COMPLETE");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  packages          : ${pkg_count}`);
    console.log(`  package_history   : ${hist_count}  (flattened snapshots)`);
    console.log(`  seasonal_offers   : ${offer_count}`);
    console.log(`  audit_logs        : ${log_count}`);
    console.log("");
    console.log("  Connect with MySQL Workbench or CLI:");
    console.log(`    mysql -u root -p aahaas_marketing`);
    console.log("═══════════════════════════════════════════════════════\n");

    await conn.end();
}

main().catch((err) => {
    console.error("\n✗ Fatal error:", err.message);
    process.exit(1);
});
