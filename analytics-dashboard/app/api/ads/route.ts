import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";

// GET /api/ads — return all ad campaign rows
export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const pool = getMysqlPool();
        const [rows] = await pool.query(
            "SELECT * FROM ad_campaigns ORDER BY amount_spent_usd DESC"
        );
        return NextResponse.json(rows);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // If table doesn't exist yet, return empty list gracefully
        if (msg.includes("doesn't exist") || msg.includes("Table")) {
            return NextResponse.json([]);
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// DELETE /api/ads — delete all records (clear all)
export async function DELETE() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const pool = getMysqlPool();
        await pool.query("DELETE FROM ad_campaigns");
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
