import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import type { SeasonalOffer } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// ── PUT /api/data/offers/[id] ────────────────────────────────────────────────

export async function PUT(request: Request, { params }: Params) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    try {
        const body = await request.json();
        const { data } = body as { data: Partial<SeasonalOffer> };

        const pool = getMysqlPool();

        const [rows] = await pool.query("SELECT data FROM offer_data WHERE id = ?", [id]);
        const arr = rows as { data: string }[];
        if (arr.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const existing = typeof arr[0].data === "string" ? JSON.parse(arr[0].data) : arr[0].data;

        const cleanData = { ...data };
        delete (cleanData as Record<string, unknown>)["id"];
        for (const k of Object.keys(cleanData)) {
            const v = (cleanData as Record<string, unknown>)[k];
            if (v === undefined || v === "" || (typeof v === "number" && isNaN(v))) {
                delete (cleanData as Record<string, unknown>)[k];
            }
        }

        const merged = { ...existing, ...cleanData, updatedAt: new Date().toISOString() };

        await pool.query(
            "UPDATE offer_data SET data = ?, updated_at = NOW() WHERE id = ?",
            [JSON.stringify(merged), id]
        );

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ── DELETE /api/data/offers/[id] ─────────────────────────────────────────────

export async function DELETE(_req: Request, { params }: Params) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const pool = getMysqlPool();
    await pool.query("DELETE FROM offer_data WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
}
