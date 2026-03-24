/**
 * scrape_firebase_to_mysql.mjs
 *
 * Standalone script that:
 *   1. Connects to Firebase Firestore using the client SDK
 *   2. Fetches ALL documents from "packages" and "seasonal_offers" collections
 *   3. Logs every document to console
 *   4. Inserts them into MySQL tables (pkg_data / offer_data)
 *
 * Usage:  node scripts/scrape_firebase_to_mysql.mjs
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import mysql from "mysql2/promise";

// ── Firebase config (hardcoded from .env.local) ──────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyCnZnumIya7lj6FJpT7SfotrY-5VoI96Bg",
    authDomain: "aahaas-marketing.firebaseapp.com",
    projectId: "aahaas-marketing",
    storageBucket: "aahaas-marketing.firebasestorage.app",
    messagingSenderId: "731783572658",
    appId: "1:731783572658:web:5af4c658b90ec04d292dab",
};

// ── MySQL config ─────────────────────────────────────────────────────────────
const mysqlConfig = {
    host: "localhost",
    port: 3306,
    user: "root",
    password: "20020224Ha",
    database: "aahaas_marketing",
};

async function main() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  Firebase → MySQL Migration Script");
    console.log("═══════════════════════════════════════════════════════════\n");

    // ── 1. Initialize Firebase ───────────────────────────────────────────────
    console.log("[1/5] Initializing Firebase...");
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Try anonymous auth
    try {
        console.log("[2/5] Signing in anonymously...");
        await signInAnonymously(auth);
        console.log("  ✓ Anonymous auth successful");
    } catch (err) {
        console.log("  ⚠ Anonymous auth failed:", err.message);
        console.log("  Continuing anyway (Firestore rules may allow public reads)...");
    }

    // ── 2. Fetch packages ────────────────────────────────────────────────────
    console.log("\n[3/5] Fetching packages from Firestore...");
    let packages = [];
    try {
        const pkgQuery = query(collection(db, "packages"), orderBy("Package"));
        const pkgSnap = await getDocs(pkgQuery);
        pkgSnap.forEach((docSnap) => {
            packages.push({ id: docSnap.id, ...docSnap.data() });
        });
    } catch (err) {
        console.log("  ⚠ Ordered query failed, trying without orderBy...");
        const pkgSnap = await getDocs(collection(db, "packages"));
        pkgSnap.forEach((docSnap) => {
            packages.push({ id: docSnap.id, ...docSnap.data() });
        });
    }
    console.log(`  ✓ Found ${packages.length} packages\n`);

    // Log each package
    packages.forEach((pkg, i) => {
        console.log(`  ── Package ${i + 1}: ${pkg.Package || pkg.country || "Unknown"} ──`);
        console.log(`     ID:            ${pkg.id}`);
        console.log(`     Package:       ${pkg.Package || "N/A"}`);
        console.log(`     Destination:   ${pkg.Destination || "N/A"}`);
        console.log(`     Date Published:${pkg["Date Published"] || "N/A"}`);
        console.log(`     FB Reach:      ${pkg["FB Reach"] ?? pkg.fb_reach ?? "N/A"}`);
        console.log(`     IG Reach:      ${pkg["IG Reach"] ?? pkg.ig_reach ?? "N/A"}`);
        console.log(`     Image URLs:    ${(pkg.imageUrls || []).length} images`);
        console.log(`     Post URL:      ${pkg.postUrl || "N/A"}`);
        console.log(`     History keys:  ${pkg.history ? Object.keys(pkg.history).join(", ") : "none"}`);
        console.log("");
    });

    // ── 3. Fetch seasonal offers ─────────────────────────────────────────────
    console.log("[4/5] Fetching seasonal offers from Firestore...");
    let offers = [];
    try {
        const offQuery = query(collection(db, "seasonal_offers"), orderBy("datePublished", "desc"));
        const offSnap = await getDocs(offQuery);
        offSnap.forEach((docSnap) => {
            offers.push({ id: docSnap.id, ...docSnap.data() });
        });
    } catch (err) {
        console.log("  ⚠ Ordered query failed, trying without orderBy...");
        const offSnap = await getDocs(collection(db, "seasonal_offers"));
        offSnap.forEach((docSnap) => {
            offers.push({ id: docSnap.id, ...docSnap.data() });
        });
    }
    console.log(`  ✓ Found ${offers.length} offers\n`);

    // Log each offer
    offers.forEach((offer, i) => {
        console.log(`  ── Offer ${i + 1}: ${offer.name || "Unknown"} ──`);
        console.log(`     ID:            ${offer.id}`);
        console.log(`     Category:      ${offer.category || "N/A"}`);
        console.log(`     Post Type:     ${offer.postType || "N/A"}`);
        console.log(`     Description:   ${(offer.description || "").substring(0, 80)}`);
        console.log(`     Validity:      ${offer.validityPeriod || "N/A"}`);
        console.log(`     Date Published:${offer.datePublished || "N/A"}`);
        console.log(`     FB Reach:      ${offer.fbReach ?? "N/A"}`);
        console.log(`     IG Reach:      ${offer.igReach ?? "N/A"}`);
        console.log(`     Combined:      ${offer.combinedReach ?? "N/A"}`);
        console.log(`     Image URL:     ${offer.imageUrl || "N/A"}`);
        console.log(`     Image URLs:    ${(offer.imageUrls || []).length} images`);
        console.log(`     Post URL:      ${offer.postUrl || "N/A"}`);
        console.log("");
    });

    // ── 4. Also dump full JSON to files for backup ───────────────────────────
    const fs = await import("fs");
    const path = await import("path");
    const scriptDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");

    const pkgDumpPath = path.join(scriptDir, "firebase_packages_dump.json");
    const offerDumpPath = path.join(scriptDir, "firebase_offers_dump.json");
    fs.writeFileSync(pkgDumpPath, JSON.stringify(packages, null, 2), "utf8");
    fs.writeFileSync(offerDumpPath, JSON.stringify(offers, null, 2), "utf8");
    console.log(`  ✓ Dumped packages JSON to: ${pkgDumpPath}`);
    console.log(`  ✓ Dumped offers JSON to:   ${offerDumpPath}\n`);

    // ── 5. Insert into MySQL ─────────────────────────────────────────────────
    console.log("[5/5] Inserting into MySQL...");
    const pool = mysql.createPool(mysqlConfig);

    // Clear existing data
    await pool.execute("DELETE FROM pkg_data");
    await pool.execute("DELETE FROM offer_data");
    console.log("  ✓ Cleared existing MySQL data");

    // Insert packages
    let pkgCount = 0;
    for (const pkg of packages) {
        const firebaseId = pkg.id;
        // Separate history from the rest of the data
        const { id, history, ...dataFields } = pkg;
        const dataJson = JSON.stringify(dataFields);
        const historyJson = history ? JSON.stringify(history) : null;

        await pool.execute(
            "INSERT INTO pkg_data (id, data, history) VALUES (?, ?, ?)",
            [firebaseId, dataJson, historyJson]
        );
        pkgCount++;
        console.log(`  ✓ Inserted package: ${dataFields.Package || dataFields.country || firebaseId}`);
    }

    // Insert offers
    let offerCount = 0;
    for (const offer of offers) {
        const firebaseId = offer.id;
        const { id, ...dataFields } = offer;
        const dataJson = JSON.stringify(dataFields);

        await pool.execute(
            "INSERT INTO offer_data (id, data) VALUES (?, ?)",
            [firebaseId, dataJson]
        );
        offerCount++;
        console.log(`  ✓ Inserted offer: ${dataFields.name || firebaseId}`);
    }

    await pool.end();

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log(`  DONE! Migrated ${pkgCount} packages + ${offerCount} offers to MySQL`);
    console.log("═══════════════════════════════════════════════════════════\n");

    // Exit cleanly (Firebase keeps connections alive)
    process.exit(0);
}

main().catch((err) => {
    console.error("\n❌ FATAL ERROR:", err);
    process.exit(1);
});
