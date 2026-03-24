import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

let pool: Pool | null = null;

export function getMysqlPool(): Pool {
    if (!pool) {
        // Support both naming conventions (DB_* used in some setups, MYSQL_* used here)
        const host     = process.env.MYSQL_HOST     || process.env.DB_HOST     || "35.197.143.222";
        const port     = Number(process.env.MYSQL_PORT     || process.env.DB_PORT     || 3306);
        const user     = process.env.MYSQL_USER     || process.env.DB_USERNAME || "root";
        const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "&l+>XV7=Q@iF&B9s";
        const database = process.env.MYSQL_DATABASE || process.env.DB_DATABASE || "aahaas_marketing";

        pool = mysql.createPool({
            host,
            port,
            user,
            password,
            database,
            waitForConnections: true,
            connectionLimit: 10,
            // Disable strict SSL for Cloud SQL public IP connections
            ssl: { rejectUnauthorized: false },
            // Shorter connect timeout for serverless environments
            connectTimeout: 10000,
        });
    }
    return pool;
}
