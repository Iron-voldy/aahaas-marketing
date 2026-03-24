import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import type { AuditLog } from "@/lib/db";

// ── GET /api/data/logs ───────────────────────────────────────────────────────

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pool = getMysqlPool();
    const [rows] = await pool.query(
        "SELECT id, email, action, timestamp FROM app_logs ORDER BY timestamp DESC LIMIT 500"
    );

    const logs: AuditLog[] = (rows as { id: number; email: string; action: string; timestamp: Date }[]).map((r) => ({
        id: String(r.id),
        email: r.email,
        action: r.action,
        timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
    }));

    return NextResponse.json(logs);
}

// ── POST /api/data/logs ──────────────────────────────────────────────────────

export async function POST(request: Request) {
    try {
        const { email, action } = await request.json();
        const pool = getMysqlPool();
        await pool.query("INSERT INTO app_logs (email, action) VALUES (?, ?)", [email, action]);
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
