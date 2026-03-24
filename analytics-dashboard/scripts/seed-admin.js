// Run with: node scripts/seed-admin.js
require("dotenv").config({ path: ".env.local" });

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST || "localhost",
        port: parseInt(process.env.MYSQL_PORT || "3306"),
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
    });

    const email = "admin@aahaas.com";
    const plainPassword = "123123@";
    const name = "Admin";

    // Check if already exists
    const [rows] = await conn.query("SELECT id FROM app_users WHERE email = ?", [email]);
    if (rows.length > 0) {
        console.log(`⚠️  User "${email}" already exists (id: ${rows[0].id}). Updating password...`);
        const hash = await bcrypt.hash(plainPassword, 12);
        await conn.query("UPDATE app_users SET password_hash = ?, name = ? WHERE email = ?", [hash, name, email]);
        console.log(`✅  Password updated for "${email}".`);
    } else {
        const hash = await bcrypt.hash(plainPassword, 12);
        const [result] = await conn.query(
            "INSERT INTO app_users (name, email, password_hash) VALUES (?, ?, ?)",
            [name, email, hash]
        );
        console.log(`✅  Admin user created: "${email}" (id: ${result.insertId})`);
    }

    await conn.end();
}

main().catch((err) => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
