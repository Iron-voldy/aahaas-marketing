import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import { randomUUID } from "crypto";
import type { Row } from "@/lib/types";

function parsePackageRows(dbRows: { id: string; data: string; history: string | null }[]): Row[] {
    return dbRows.map((r) => {
        const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
        const history = r.history
            ? (typeof r.history === "string" ? JSON.parse(r.history) : r.history)
            : undefined;
        return { ...data, id: r.id, ...(history ? { history } : {}) } as Row;
    });
}

// -- GET /api/data/packages
export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const pool = getMysqlPool();
    const [rows] = await pool.query("SELECT id, data, history FROM pkg_data");
    return NextResponse.json(parsePackageRows(rows as { id: string; data: string; history: string | null }[]));
}

// -- POST /api/data/packages
export async function POST(request: Request) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const body = await request.json();
        const { data, entryDate } = body as { data: Omit<Row, "id">; entryDate?: string };
        if (!data) return NextResponse.json({ error: "data is required" }, { status: 400 });
        const id = randomUUID();
        const now = new Date().toISOString();
        const cleanData: Record<string, unknown> = { ...data, updatedAt: now };
        delete cleanData["id"];
        delete cleanData["history"];
        let history: Record<string, Record<string, string | number>> | null = null;
        if (entryDate) {
            const dateKey = entryDate.split("T")[0];
            const metrics: Record<string, string | number> = {};
            for (const [k, v] of Object.entries(cleanData)) {
                if (typeof v === "number") metrics[k] = v;
            }
            history = { [dateKey]: metrics };
        }
        const pool = getMysqlPool();
        await pool.query(
            "INSERT INTO pkg_data (id, data, history) VALUES (?, ?, ?)",
            [id, JSON.stringify(cleanData), history ? JSON.stringify(history) : null]
        );
        return NextResponse.json({ id });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
