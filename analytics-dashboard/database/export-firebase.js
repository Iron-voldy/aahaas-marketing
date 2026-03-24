/**
 * export-firebase.js
 * ──────────────────────────────────────────────────────────
 * Uses Firebase Admin SDK to export all Firestore data
 * (packages, seasonal_offers, audit_logs) to JSON files.
 *
 * SETUP (one-time):
 *  1. Go to Firebase Console → Project Settings → Service Accounts
 *  2. Click "Generate new private key"
 *  3. Save the downloaded JSON file as:
 *       analytics-dashboard/database/serviceAccountKey.json
 *  4. Run:  node database/export-firebase.js
 *
 * Output files (created in analytics-dashboard/database/exported/):
 *   packages.json
 *   seasonal_offers.json
 *   audit_logs.json
 * ──────────────────────────────────────────────────────────
 */

const admin = require("firebase-admin");
const fs    = require("fs");
const path  = require("path");

// ── Paths ─────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccountKey.json");
const OUTPUT_DIR           = path.join(__dirname, "exported");

// ─────────────────────────────────────────────────────────
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("\n✗ serviceAccountKey.json not found!\n");
    console.error("  How to get it:");
    console.error("  1. Open https://console.firebase.google.com");
    console.error("  2. Select project  →  aahaas-marketing");
    console.error("  3. Project Settings  →  Service Accounts  tab");
    console.error("  4. Click 'Generate new private key'");
    console.error("  5. Save the JSON file as:");
    console.error(`     ${SERVICE_ACCOUNT_PATH}\n`);
    process.exit(1);
}

// Init admin
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Helper: fetch a full collection as a plain JS array
async function exportCollection(collectionName) {
    console.log(`  Fetching  ${collectionName} …`);
    const snapshot = await db.collection(collectionName).get();
    const docs = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        // Convert Firestore Timestamps to ISO strings
        for (const [k, v] of Object.entries(data)) {
            if (v && typeof v.toDate === "function") {
                data[k] = v.toDate().toISOString();
            }
        }
        docs.push({ id: doc.id, ...data });
    });
    return docs;
}

async function main() {
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Aahaas Marketing — Firebase Export");
    console.log("═══════════════════════════════════════════════════════\n");

    const collections = ["packages", "seasonal_offers", "audit_logs"];
    const results     = {};

    for (const col of collections) {
        results[col] = await exportCollection(col);
        const outFile = path.join(OUTPUT_DIR, `${col}.json`);
        fs.writeFileSync(outFile, JSON.stringify(results[col], null, 2), "utf-8");
        console.log(`  ✓ ${col}: ${results[col].length} docs  →  ${outFile}`);
    }

    console.log("\n  Export COMPLETE.");
    console.log("  Now run:  node database/setup-mysql.js --from-files");
    console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
    console.error("\n✗ Fatal error:", err.message);
    process.exit(1);
});
