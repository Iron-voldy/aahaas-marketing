import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";

/**
 * GET /api/export-db
 * Returns all MySQL application data as JSON (packages, offers, logs).
 * Requires authentication.
 */
export async function GET() {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const pool = getMysqlPool();

        const [pkgRows] = await pool.execute("SELECT id, data, history FROM pkg_data") as any[];
        const packages = (pkgRows as any[]).map((r: any) => ({
            id: r.id,
            ...(typeof r.data === "string" ? JSON.parse(r.data) : r.data),
            history: typeof r.history === "string" ? JSON.parse(r.history) : (r.history ?? {}),
        }));

        const [offerRows] = await pool.execute("SELECT id, data FROM offer_data") as any[];
        const offers = (offerRows as any[]).map((r: any) => ({
            id: r.id,
            ...(typeof r.data === "string" ? JSON.parse(r.data) : r.data),
        }));

        const [logRows] = await pool.execute(
            "SELECT id, email, action, timestamp FROM app_logs ORDER BY timestamp DESC LIMIT 1000"
        ) as any[];

        return NextResponse.json({ packages, offers, logs: logRows }, { status: 200 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
