import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import { randomUUID } from "crypto";

/**
 * POST /api/reports/categorize
 * Body: {
 *   postIds: number[],
 *   category: "package" | "seasonal_offer" | "general",
 *   postData?: {
 *     title?: string; description?: string; country?: string;
 *     imageUrl?: string; permalink?: string; fbReach?: number;
 *     fbReactions?: number; fbComments?: number; fbShares?: number;
 *     igReach?: number; igReactions?: number; igComments?: number;
 *     igShares?: number; publishTime?: string;
 *   }
 * }
 *
 * 1. Updates detected_category for the given post IDs.
 * 2. If category is "package" → inserts into pkg_data.
 * 3. If category is "seasonal_offer" → inserts into offer_data.
 */
export async function POST(request: Request) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

    const { postIds, category, postData } = body as {
        postIds?: unknown;
        category?: unknown;
        postData?: {
            title?: string; description?: string; country?: string;
            imageUrl?: string; permalink?: string;
            fbReach?: number; fbReactions?: number; fbComments?: number; fbShares?: number;
            igReach?: number; igReactions?: number; igComments?: number; igShares?: number;
            igSaves?: number; publishTime?: string;
        };
    };

    if (!Array.isArray(postIds) || postIds.length === 0)
        return NextResponse.json({ error: "postIds must be a non-empty array" }, { status: 400 });

    const validCategories = ["package", "seasonal_offer", "general"];
    if (typeof category !== "string" || !validCategories.includes(category))
        return NextResponse.json({ error: `category must be one of: ${validCategories.join(", ")}` }, { status: 400 });

    const ids = (postIds as unknown[]).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0)
        return NextResponse.json({ error: "No valid post IDs provided" }, { status: 400 });

    const pool = getMysqlPool();
    const placeholders = ids.map(() => "?").join(",");

    // 1. Update detected_category on the post rows
    await pool.query(
        `UPDATE social_media_posts SET detected_category = ? WHERE id IN (${placeholders})`,
        [category, ...ids]
    );

    let insertedId: string | null = null;

    // 2. Insert into packages or offers table
    if (category === "package" && postData) {
        const id = randomUUID();
        const name = postData.title || postData.description?.slice(0, 80) || "Unnamed Package";
        const data = {
            name,
            description: postData.description || "",
            destination: postData.country || "",
            imageUrl: postData.imageUrl || "",
            postUrl: postData.permalink || "",
            "FB Reach": postData.fbReach || 0,
            "FB Reactions": postData.fbReactions || 0,
            "FB Comments": postData.fbComments || 0,
            "FB Shares": postData.fbShares || 0,
            "IG Reach": postData.igReach || 0,
            "IG Reactions": postData.igReactions || 0,
            "IG Comments": postData.igComments || 0,
            "IG Shares": postData.igShares || 0,
            "IG Saves": postData.igSaves || 0,
            "Combined Reach": (postData.fbReach || 0) + (postData.igReach || 0),
            datePublished: postData.publishTime ? postData.publishTime.slice(0, 10) : "",
            source: "reports",
            updatedAt: new Date().toISOString(),
        };
        await pool.query(
            "INSERT INTO pkg_data (id, data) VALUES (?, ?)",
            [id, JSON.stringify(data)]
        );
        insertedId = id;
    }

    if (category === "seasonal_offer" && postData) {
        const id = randomUUID();
        const name = postData.title || postData.description?.slice(0, 80) || "Unnamed Offer";
        const data = {
            name,
            category: "Seasonal Promotion",
            description: postData.description || "",
            imageUrl: postData.imageUrl || "",
            postUrl: postData.permalink || "",
            fbReach: postData.fbReach || 0,
            fbReactions: postData.fbReactions || 0,
            fbComments: postData.fbComments || 0,
            fbShares: postData.fbShares || 0,
            igReach: postData.igReach || 0,
            igReactions: postData.igReactions || 0,
            igComments: postData.igComments || 0,
            igShares: postData.igShares || 0,
            igSaves: postData.igSaves || 0,
            combinedReach: (postData.fbReach || 0) + (postData.igReach || 0),
            datePublished: postData.publishTime ? postData.publishTime.slice(0, 10) : "",
            source: "reports",
            updatedAt: new Date().toISOString(),
        };
        await pool.query(
            "INSERT INTO offer_data (id, data) VALUES (?, ?)",
            [id, JSON.stringify(data)]
        );
        insertedId = id;
    }

    return NextResponse.json({ success: true, updated: ids.length, category, insertedId });
}
