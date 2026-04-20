import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import { getSessionUser } from "@/lib/session";
import type { RowDataPacket } from "mysql2/promise";

/**
 * POST /api/reports/debug
 * One-time fix: resets all is_ignored=1 rows back to 0.
 */
export async function POST() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pool = getMysqlPool();
    try {
        const [result] = await pool.query(
            "UPDATE social_media_posts SET is_ignored = 0 WHERE COALESCE(is_ignored, 0) = 1"
        );
        const affected = (result as { affectedRows: number }).affectedRows;
        console.log(`[reports/debug] reset is_ignored for ${affected} rows`);
        return NextResponse.json({ success: true, resetCount: affected });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * GET /api/reports/debug        → social_media_posts stats
 * GET /api/reports/debug?pkg=1  → raw pkg_data rows (keys + data)
 */
export async function GET(request: Request) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pool = getMysqlPool();
    const { searchParams } = new URL(request.url);

    // ── pkg_data inspector ─────────────────────────────────────────────────
    if (searchParams.has("pkg")) {
        try {
            const [rows] = await pool.query<RowDataPacket[]>("SELECT id, data FROM pkg_data LIMIT 20");
            return NextResponse.json(rows.map(r => {
                const parsed = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
                return { id: r.id, keys: Object.keys(parsed), data: parsed };
            }));
        } catch (err) {
            return NextResponse.json({ error: String(err) }, { status: 500 });
        }
    }

    // ── social_media_posts stats ───────────────────────────────────────────
    try {
        const [[countRow]] = await pool.query<RowDataPacket[]>(
            "SELECT COUNT(*) AS total FROM social_media_posts"
        );
        const [[ignoredRow]] = await pool.query<RowDataPacket[]>(
            "SELECT COUNT(*) AS total FROM social_media_posts WHERE COALESCE(is_ignored, 0) = 1"
        );
        const [sessionRows] = await pool.query<RowDataPacket[]>(
            "SELECT id, uploaded_at, fb_posts_count, fb_videos_count, ig_posts_count, ig_stories_count FROM import_sessions ORDER BY id DESC LIMIT 5"
        );
        const [sampleRows] = await pool.query<RowDataPacket[]>(
            "SELECT id, source_type, post_id, is_ignored, imported_at, LEFT(title,60) AS title_preview FROM social_media_posts ORDER BY id DESC LIMIT 5"
        );
        const [columnRows] = await pool.query<RowDataPacket[]>(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'social_media_posts' ORDER BY ORDINAL_POSITION"
        );

        return NextResponse.json({
            totalPosts: Number(countRow?.total ?? 0),
            ignoredPosts: Number(ignoredRow?.total ?? 0),
            recentSessions: sessionRows,
            recentPosts: sampleRows,
            columns: columnRows,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[reports/debug]", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
