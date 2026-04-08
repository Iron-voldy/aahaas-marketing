import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import { ensureAdsTable } from "@/lib/ads";

export async function POST() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pool = getMysqlPool();
    await ensureAdsTable(pool);

    return NextResponse.json({ ok: true });
}
