import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import { randomUUID } from "crypto";
import {
    createManualMappings,
    removeMappingsForPosts,
    updatePostsCategory,
} from "@/lib/reportMappings";

/**
 * POST /api/reports/categorize
 * Body: {
 *   postIds: number[],
 *   category: "package" | "seasonal_offer" | "ignore",
 *   postData?: {
 *     title?: string; description?: string; country?: string;
 *     imageUrl?: string; permalink?: string; fbReach?: number;
 *     fbReactions?: number; fbComments?: number; fbShares?: number;
 *     igReach?: number; igReactions?: number; igComments?: number;
 *     igShares?: number; publishTime?: string;
 *   }
 * }
 *
 * 1. Removes any existing report mapping for the given posts.
 * 2. Updates detected_category / ignore state.
 * 3. If category is "package" → inserts into pkg_data + creates manual mappings.
 * 4. If category is "seasonal_offer" → inserts into offer_data + creates manual mappings.
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

    const validCategories = ["package", "seasonal_offer", "ignore"];
    if (typeof category !== "string" || !validCategories.includes(category))
        return NextResponse.json({ error: `category must be one of: ${validCategories.join(", ")}` }, { status: 400 });

    const ids = (postIds as unknown[]).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0)
        return NextResponse.json({ error: "No valid post IDs provided" }, { status: 400 });

    if (category !== "ignore" && !postData) {
        return NextResponse.json({ error: "postData is required for package and offer categorization" }, { status: 400 });
    }

    const pool = getMysqlPool();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        await removeMappingsForPosts(conn, ids);

        let insertedId: string | null = null;

        if (category === "ignore") {
            await updatePostsCategory(conn, ids, "general", true);
        }

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
            await conn.query(
                "INSERT INTO pkg_data (id, data) VALUES (?, ?)",
                [id, JSON.stringify(data)]
            );
            await updatePostsCategory(conn, ids, "package", false);
            await createManualMappings(conn, ids, "package", id);
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
            await conn.query(
                "INSERT INTO offer_data (id, data) VALUES (?, ?)",
                [id, JSON.stringify(data)]
            );
            await updatePostsCategory(conn, ids, "seasonal_offer", false);
            await createManualMappings(conn, ids, "seasonal_offer", id);
            insertedId = id;
        }

        await conn.commit();
        return NextResponse.json({ success: true, updated: ids.length, category, insertedId });
    } catch (err: unknown) {
        await conn.rollback();
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
    } finally {
        conn.release();
    }
}
