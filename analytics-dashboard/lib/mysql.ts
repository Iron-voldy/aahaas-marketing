import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

let pool: Pool | null = null;

export function getMysqlPool(): Pool {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST ?? "35.197.143.222",
            port: Number(process.env.MYSQL_PORT ?? 3306),
            user: process.env.MYSQL_USER ?? "root",
            password: process.env.MYSQL_PASSWORD ?? "&l+>XV7=Q@iF&B9s",
            database: process.env.MYSQL_DATABASE ?? "aahaas_marketing",
            waitForConnections: true,
            connectionLimit: 10,
        });
    }
    return pool;
}
