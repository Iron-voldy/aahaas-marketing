#!/usr/bin/env node
/**
 * database/seed.js
 *
 * Seeds the MySQL database:
 *   1. Creates app_users, pkg_data, offer_data, app_logs tables (if not exist)
 *   2. Creates the default admin user  john@example.com / 123123@
 *   3. Imports all packages from public/data/packages.csv into pkg_data
 *
 * Usage:
 *   node database/seed.js
 */

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const fs    = require("fs");
const path  = require("path");
const Papa  = require("papaparse");

const DB_CONFIG = {
    host:     process.env.MYSQL_HOST     || "localhost",
    port:     Number(process.env.MYSQL_PORT) || 3306,
    user:     process.env.MYSQL_USER     || "root",
    password: process.env.MYSQL_PASSWORD || "20020224Ha",
    database: process.env.MYSQL_DATABASE || "aahaas_marketing",
    multipleStatements: true,
};

function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

async function run() {
    const conn = await mysql.createConnection(DB_CONFIG);
    console.log("Connected to MySQL:", DB_CONFIG.database);

    // ── 1. Tables already created via app_schema.sql ─────────────────────
    console.log("Tables already created.");

    // ── 2. Seed admin user ────────────────────────────────────────────────
    const email    = "john@example.com";
    const password = "123123@";
    const name     = "John";

    const [existing] = await conn.query("SELECT id FROM app_users WHERE email = ?", [email]);
    if (existing.length === 0) {
        const hash = await bcrypt.hash(password, 12);
        await conn.query(
            "INSERT INTO app_users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
            [email, hash, name]
        );
        console.log(`Admin user created: ${email}`);
    } else {
        // Update password hash in case it changed
        const hash = await bcrypt.hash(password, 12);
        await conn.query("UPDATE app_users SET password_hash = ? WHERE email = ?", [hash, email]);
        console.log(`Admin user already exists: ${email} (password updated)`);
    }

    // ── 3. Import packages from CSV ───────────────────────────────────────
    const csvPath = path.join(__dirname, "..", "public", "data", "packages.csv");
    if (!fs.existsSync(csvPath)) {
        console.log("No packages.csv found, skipping package import.");
        await conn.end();
        return;
    }

    const csvText = fs.readFileSync(csvPath, "utf8");
    // The CSV has 3 header rows; row 2 (0-indexed) has the actual field names.
    // Strip rows 0 and 1, then parse from row 2 as the header.
    const csvLines = csvText.split(/\r?\n/);
    const dataLines = csvLines.slice(2); // Start from the actual header row
    const csvForParse = dataLines.join("\n");
    const parsed = Papa.parse(csvForParse, { header: true, skipEmptyLines: true });
    const rows = parsed.data;

    let inserted = 0, skipped = 0;
    for (const row of rows) {
        // Skip rows with no package name
        if (!row["Package"] && !row["package_name"]) { skipped++; continue; }

        // Generate UUID for this package
        const id = uuid();
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");

        // Convert numeric fields
        const data = {};
        for (const [k, v] of Object.entries(row)) {
            if (v === "" || v === null || v === undefined) continue;
            const num = Number(String(v).replace(/,/g, ""));
            data[k] = !isNaN(num) && v !== "" && k !== "Package" && k !== "Country" &&
                      k !== "Date Published" && k !== "Destination" && k !== "Validity Period" &&
                      k !== "Ads Objective" && k !== "Start Date" && k !== "End Date"
                ? num : String(v).trim();
        }
        data["updatedAt"] = now;

        await conn.query(
            "INSERT INTO pkg_data (id, data, history, updated_at, created_at) VALUES (?, ?, NULL, NOW(), NOW())",
            [id, JSON.stringify(data)]
        );
        inserted++;
    }

    console.log(`Packages imported: ${inserted} inserted, ${skipped} skipped.`);

    await conn.end();
    console.log("Done.");
}

run().catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
});
