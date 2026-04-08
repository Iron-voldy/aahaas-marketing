import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import { ensureAdsTable, normalizeAdCampaign } from "@/lib/ads";

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
    await ensureAdsTable(pool);
    await pool.query("DELETE FROM ad_campaigns WHERE id = ?", [numId]);
    return NextResponse.json({ ok: true });
}

// PUT /api/ads/[id]
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const numId = Number(id);
    if (!numId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => null) as {
        booking_count?: number;
        product_image_url?: string | null;
        product_image_urls?: string[];
    } | null;

    if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

    const bookingCount = Math.max(0, Number(body.booking_count) || 0);
    const productImageUrls = Array.isArray(body.product_image_urls)
        ? body.product_image_urls.map((url) => String(url).trim()).filter(Boolean)
        : [];
    const productImageUrl =
        typeof body.product_image_url === "string" && body.product_image_url.trim()
            ? body.product_image_url.trim()
            : productImageUrls[0] ?? null;

    const pool = getMysqlPool();
    await ensureAdsTable(pool);
    await pool.query(
        `UPDATE ad_campaigns
         SET booking_count = ?, product_image_url = ?, product_image_urls = ?
         WHERE id = ?`,
        [
            bookingCount,
            productImageUrl,
            productImageUrls.length > 0 ? JSON.stringify(productImageUrls) : null,
            numId,
        ]
    );

    const [rows] = await pool.query("SELECT * FROM ad_campaigns WHERE id = ? LIMIT 1", [numId]);
    const updatedRow = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;

    if (!updatedRow) {
        return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    }

    return NextResponse.json(normalizeAdCampaign(updatedRow));
}
