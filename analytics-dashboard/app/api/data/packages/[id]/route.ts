import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import type { Row } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

// ── GET /api/data/packages/[id] ──────────────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const pool = getMysqlPool();
    const [rows] = await pool.query("SELECT id, data, history FROM pkg_data WHERE id = ?", [id]);
    const arr = rows as { id: string; data: string; history: string | null }[];
    if (arr.length === 0) return NextResponse.json(null);

    const r = arr[0];
    const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
    const history = r.history ? (typeof r.history === "string" ? JSON.parse(r.history) : r.history) : undefined;
    return NextResponse.json({ ...data, id: r.id, ...(history ? { history } : {}) } as Row);
}

// ── PUT /api/data/packages/[id] ──────────────────────────────────────────────

export async function PUT(request: Request, { params }: Params) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    try {
        const body = await request.json();
        const { data, entryDate } = body as { data: Partial<Row>; entryDate?: string };

        const pool = getMysqlPool();

        // Fetch existing row
        const [rows] = await pool.query("SELECT data, history FROM pkg_data WHERE id = ?", [id]);
        const arr = rows as { data: string; history: string | null }[];
        if (arr.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const existing = typeof arr[0].data === "string" ? JSON.parse(arr[0].data) : arr[0].data;
        const existingHistory = arr[0].history
            ? (typeof arr[0].history === "string" ? JSON.parse(arr[0].history) : arr[0].history)
            : {};

        // Merge
        const cleanData = { ...data };
        delete cleanData["id"];
        delete cleanData["history"];
        // Remove undefined
        for (const k of Object.keys(cleanData)) {
            if ((cleanData as Record<string, unknown>)[k] === undefined) delete (cleanData as Record<string, unknown>)[k];
        }

        const merged = { ...existing, ...cleanData, updatedAt: new Date().toISOString() };

        // Update history
        let newHistory = existingHistory;
        if (entryDate) {
            const dateKey = entryDate.split("T")[0];
            const metrics: Record<string, string | number> = {};
            for (const [k, v] of Object.entries(cleanData as Record<string, unknown>)) {
                if (typeof v === "number") metrics[k] = v;
            }
            newHistory = {
                ...existingHistory,
                [dateKey]: { ...(existingHistory[dateKey] || {}), ...metrics },
            };
        }

        await pool.query(
            "UPDATE pkg_data SET data = ?, history = ?, updated_at = NOW() WHERE id = ?",
            [JSON.stringify(merged), JSON.stringify(newHistory), id]
        );

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ── DELETE /api/data/packages/[id] ───────────────────────────────────────────

export async function DELETE(_req: Request, { params }: Params) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const pool = getMysqlPool();
    await pool.query("DELETE FROM pkg_data WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
}
