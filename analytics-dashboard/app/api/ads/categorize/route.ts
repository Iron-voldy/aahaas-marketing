import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import { ensureAdsTable, normalizeAdCampaign } from "@/lib/ads";

type Category = "package" | "seasonal_offer";

function buildPackageData(ad: Record<string, unknown>) {
    const adId = Number(ad.id) || 0;
    const imageUrls = Array.isArray(ad.product_image_urls) ? ad.product_image_urls : [];
    const datePublished = String(ad.reporting_starts || ad.reporting_ends || ad.created_at || "").slice(0, 10);

    return {
        Package: String(ad.ad_name || "Unnamed Ad Campaign"),
        name: String(ad.ad_name || "Unnamed Ad Campaign"),
        Destination: "Ads Campaign",
        destination: "Ads Campaign",
        description: `Imported from ads campaign: ${String(ad.ad_name || "")}`,
        imageUrl: ad.product_image_url || "",
        imageUrls,
        postUrl: "",
        "Date Published": datePublished,
        datePublished,
        "FB Reach": Number(ad.reach) || 0,
        "FB Total Clicks": Number(ad.link_clicks) || 0,
        "Combined Reach": Number(ad.reach) || 0,
        "Amount Spent (USD)": Number(ad.amount_spent_usd) || 0,
        "FB + IG Messaging Conversations Started": Number(ad.results) || 0,
        source: "ads_campaign",
        sourceAdId: adId,
        sourceBatchId: String(ad.batch_id || ""),
        sourceAdName: String(ad.ad_name || ""),
        updatedAt: new Date().toISOString(),
    };
}

function buildOfferData(ad: Record<string, unknown>) {
    const adId = Number(ad.id) || 0;
    const imageUrls = Array.isArray(ad.product_image_urls) ? ad.product_image_urls : [];
    const datePublished = String(ad.reporting_starts || ad.reporting_ends || ad.created_at || "").slice(0, 10);
    const amountSpent = Number(ad.amount_spent_usd) || 0;

    return {
        name: String(ad.ad_name || "Unnamed Ad Campaign"),
        category: "Ads Campaign",
        description: `Imported from ads campaign: ${String(ad.ad_name || "")}`,
        imageUrl: ad.product_image_url || "",
        imageUrls,
        postUrl: "",
        datePublished,
        price: amountSpent > 0 ? `$${amountSpent.toFixed(2)} spend` : "",
        fbReach: Number(ad.reach) || 0,
        fbClicks: Number(ad.link_clicks) || 0,
        combinedReach: Number(ad.reach) || 0,
        adSpend: amountSpent,
        impressions: Number(ad.impressions) || 0,
        conversations: Number(ad.results) || 0,
        isBoosted: amountSpent > 0,
        source: "ads_campaign",
        sourceAdId: adId,
        sourceBatchId: String(ad.batch_id || ""),
        sourceAdName: String(ad.ad_name || ""),
        updatedAt: new Date().toISOString(),
    };
}

async function upsertTarget(category: Category, ad: Record<string, unknown>) {
    const pool = getMysqlPool();
    const table = category === "package" ? "pkg_data" : "offer_data";
    const data = category === "package" ? buildPackageData(ad) : buildOfferData(ad);
    const sourceAdId = String(Number(ad.id) || 0);

    const [rows] = await pool.query(
        `SELECT id
         FROM ${table}
         WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.source')) = 'ads_campaign'
           AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.sourceAdId')) = ?
         LIMIT 1`,
        [sourceAdId]
    );

    const existing = (rows as { id: string }[])[0];
    if (existing?.id) {
        await pool.query(
            `UPDATE ${table}
             SET data = ?, updated_at = NOW()
             WHERE id = ?`,
            [JSON.stringify(data), existing.id]
        );
        return { id: existing.id, mode: "updated" as const };
    }

    const id = randomUUID();
    await pool.query(`INSERT INTO ${table} (id, data) VALUES (?, ?)`, [id, JSON.stringify(data)]);
    return { id, mode: "created" as const };
}

export async function POST(request: Request) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null) as { adId?: unknown; category?: unknown } | null;
    if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

    const adId = Number(body.adId);
    const category = body.category;

    if (!Number.isFinite(adId) || adId <= 0) {
        return NextResponse.json({ error: "Invalid adId" }, { status: 400 });
    }

    if (category !== "package" && category !== "seasonal_offer") {
        return NextResponse.json({ error: "category must be package or seasonal_offer" }, { status: 400 });
    }

    try {
        const pool = getMysqlPool();
        await ensureAdsTable(pool);
        const [rows] = await pool.query("SELECT * FROM ad_campaigns WHERE id = ? LIMIT 1", [adId]);
        const adRow = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;

        if (!adRow) {
            return NextResponse.json({ error: "Ad campaign not found" }, { status: 404 });
        }

        const ad = normalizeAdCampaign(adRow);
        const result = await upsertTarget(category, ad);

        return NextResponse.json({
            ok: true,
            id: result.id,
            mode: result.mode,
            category,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
