import { NextResponse } from "next/server";
import { loadCsv } from "@/lib/loadCsv";
import { getMysqlPool } from "@/lib/mysql";
import { Row } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

export async function POST() {
    try {
        console.log("Starting CSV to MySQL migration...");
        const { rows } = await loadCsv();
        const pool = getMysqlPool();

        await pool.execute("DELETE FROM pkg_data");

        let count = 0;
        let errors = 0;

        for (const row of rows) {
            try {
                const { id, ...cleanRow } = row as Row & { id?: string };
                const newId = uuidv4();
                const data = JSON.stringify(cleanRow);
                await pool.execute(
                    "INSERT INTO pkg_data (id, data, history) VALUES (?, ?, ?)",
                    [newId, data, "{}"]
                );
                count++;
            } catch (err) {
                console.error("Failed to add row:", (row as Row).Package, err);
                errors++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Migration completed. Uploaded ${count} packages. Errors: ${errors}.`
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
