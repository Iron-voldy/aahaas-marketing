import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import { randomUUID } from "crypto";
import type { SeasonalOffer } from "@/lib/db";

function parseOfferRows(dbRows: { id: string; data: string }[]): SeasonalOffer[] {
    return dbRows.map((r) => {
        const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
        return { ...data, id: r.id } as SeasonalOffer;
    });
}

// -- GET /api/data/offers
export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const pool = getMysqlPool();
    const [rows] = await pool.query(
        "SELECT id, data FROM offer_data ORDER BY JSON_UNQUOTE(JSON_EXTRACT(data, '$.datePublished')) DESC"
    );
    return NextResponse.json(parseOfferRows(rows as { id: string; data: string }[]));
}

// -- POST /api/data/offers
export async function POST(request: Request) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const body = await request.json();
        const { data } = body as { data: Omit<SeasonalOffer, "id"> };
        const id = randomUUID();
        const cleanData = { ...data, updatedAt: new Date().toISOString() };
        delete (cleanData as Record<string, unknown>)["id"];
        const pool = getMysqlPool();
        await pool.query("INSERT INTO offer_data (id, data) VALUES (?, ?)", [id, JSON.stringify(cleanData)]);
        return NextResponse.json({ id });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
