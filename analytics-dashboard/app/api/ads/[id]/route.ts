import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";

// DELETE /api/ads/[id]
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const numId = Number(id);
    if (!numId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const pool = getMysqlPool();
    await pool.query("DELETE FROM ad_campaigns WHERE id = ?", [numId]);
    return NextResponse.json({ ok: true });
}
