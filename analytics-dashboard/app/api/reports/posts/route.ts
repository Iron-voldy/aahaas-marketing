import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";

/**
 * GET /api/reports/posts?from=YYYY-MM-DD&to=YYYY-MM-DD&source=fb_post&category=package
 *
 * Returns all social_media_posts with optional filters.
 * Joins with post_package_mapping to include match info.
 */
export async function GET(request: Request) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const source = url.searchParams.get("source"); // fb_post, fb_video, ig_post, ig_story
    const category = url.searchParams.get("category"); // package, seasonal_offer, general

    const pool = getMysqlPool();

    let query = `
        SELECT
            p.id, p.import_session_id, p.source_type, p.post_id,
            p.page_or_account_id, p.title, p.description,
            p.publish_time, p.permalink, p.post_type,
            p.reach, p.views, p.reactions, p.comments, p.shares, p.saves,
            p.total_clicks, p.link_clicks, p.other_clicks,
            p.three_sec_views, p.one_min_views, p.seconds_viewed, p.avg_seconds_viewed,
            p.profile_visits, p.replies, p.navigation, p.follows,
            p.ad_impressions, p.ad_cpm, p.estimated_earnings,
            p.detected_category, p.detected_country, p.imported_at,
            m.target_type, m.target_firebase_id, m.match_method, m.confidence,
            COALESCE(
                JSON_UNQUOTE(JSON_EXTRACT(pd.data, '$.imageUrl')),
                JSON_UNQUOTE(JSON_EXTRACT(pd.data, '$.imageUrls[0]'))
            ) AS package_image_url
        FROM (
            SELECT p2.*, ROW_NUMBER() OVER (
                PARTITION BY p2.source_type, p2.post_id
                ORDER BY p2.imported_at DESC
            ) AS rn
            FROM social_media_posts p2
        ) p
        LEFT JOIN post_package_mapping m ON p.id = m.post_id
        LEFT JOIN pkg_data pd ON m.target_firebase_id = pd.id
        WHERE p.rn = 1
    `;
    const params: (string | number)[] = [];

    if (from) {
        query += " AND p.publish_time >= ?";
        params.push(from + " 00:00:00");
    }
    if (to) {
        query += " AND p.publish_time <= ?";
        params.push(to + " 23:59:59");
    }
    if (source) {
        query += " AND p.source_type = ?";
        params.push(source);
    }
    if (category) {
        query += " AND p.detected_category = ?";
        params.push(category);
    }

    query += " ORDER BY p.publish_time DESC";

    const [rows] = await pool.query(query, params);

    // Also get summary aggregates (deduplicated)
    let summaryQuery = `
        SELECT
            COUNT(*) as totalPosts,
            SUM(p.reach) as totalReach,
            SUM(p.reactions) as totalReactions,
            SUM(p.comments) as totalComments,
            SUM(p.shares) as totalShares,
            SUM(p.saves) as totalSaves,
            SUM(p.total_clicks) as totalClicks,
            SUM(p.link_clicks) as totalLinkClicks,
            SUM(p.views) as totalViews,
            SUM(p.follows) as totalFollows,
            COUNT(CASE WHEN p.source_type = 'fb_post' THEN 1 END) as fbPosts,
            COUNT(CASE WHEN p.source_type = 'fb_video' THEN 1 END) as fbVideos,
            COUNT(CASE WHEN p.source_type = 'ig_post' THEN 1 END) as igPosts,
            COUNT(CASE WHEN p.source_type = 'ig_story' THEN 1 END) as igStories,
            COUNT(CASE WHEN p.detected_category = 'package' THEN 1 END) as packagePosts,
            COUNT(CASE WHEN p.detected_category = 'seasonal_offer' THEN 1 END) as offerPosts,
            COUNT(CASE WHEN p.detected_category = 'general' THEN 1 END) as generalPosts
        FROM (
            SELECT p2.*, ROW_NUMBER() OVER (
                PARTITION BY p2.source_type, p2.post_id
                ORDER BY p2.imported_at DESC
            ) AS rn
            FROM social_media_posts p2
        ) p
        WHERE p.rn = 1
    `;
    const summaryParams: (string | number)[] = [];
    if (from) { summaryQuery += " AND p.publish_time >= ?"; summaryParams.push(from + " 00:00:00"); }
    if (to) { summaryQuery += " AND p.publish_time <= ?"; summaryParams.push(to + " 23:59:59"); }
    if (source) { summaryQuery += " AND p.source_type = ?"; summaryParams.push(source); }
    if (category) { summaryQuery += " AND p.detected_category = ?"; summaryParams.push(category); }

    const [summaryRows] = await pool.query(summaryQuery, summaryParams);
    const summary = (summaryRows as Record<string, unknown>[])[0] || {};

    return NextResponse.json({
        posts: rows,
        summary: {
            totalPosts: Number(summary.totalPosts || 0),
            totalReach: Number(summary.totalReach || 0),
            totalReactions: Number(summary.totalReactions || 0),
            totalComments: Number(summary.totalComments || 0),
            totalShares: Number(summary.totalShares || 0),
            totalSaves: Number(summary.totalSaves || 0),
            totalClicks: Number(summary.totalClicks || 0),
            totalLinkClicks: Number(summary.totalLinkClicks || 0),
            totalViews: Number(summary.totalViews || 0),
            totalFollows: Number(summary.totalFollows || 0),
            fbPosts: Number(summary.fbPosts || 0),
            fbVideos: Number(summary.fbVideos || 0),
            igPosts: Number(summary.igPosts || 0),
            igStories: Number(summary.igStories || 0),
            packagePosts: Number(summary.packagePosts || 0),
            offerPosts: Number(summary.offerPosts || 0),
            generalPosts: Number(summary.generalPosts || 0),
        },
    });
}
