import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

type Queryable = Pool | PoolConnection;
type TargetType = "package" | "seasonal_offer";

async function hasIgnoredColumn(db: Queryable): Promise<boolean> {
    const [rows] = await db.query<RowDataPacket[]>(
        `SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'social_media_posts'
           AND COLUMN_NAME = 'is_ignored'
         LIMIT 1`
    );

    return rows.length > 0;
}

export async function ensureIgnoredColumn(db: Queryable): Promise<void> {
    if (await hasIgnoredColumn(db)) return;

    await db.query(
        "ALTER TABLE social_media_posts ADD COLUMN is_ignored TINYINT(1) NOT NULL DEFAULT 0"
    );
}

export async function removeMappingsForPosts(
    conn: PoolConnection,
    postIds: number[]
): Promise<void> {
    if (postIds.length === 0) return;

    const placeholders = postIds.map(() => "?").join(",");
    const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT DISTINCT target_type, target_firebase_id
         FROM post_package_mapping
         WHERE post_id IN (${placeholders})`,
        postIds
    );

    await conn.query(
        `DELETE FROM post_package_mapping WHERE post_id IN (${placeholders})`,
        postIds
    );

    for (const row of rows) {
        const targetType = row.target_type as TargetType;
        const targetId = String(row.target_firebase_id);

        const [remainingRows] = await conn.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS total
             FROM post_package_mapping
             WHERE target_type = ? AND target_firebase_id = ?`,
            [targetType, targetId]
        );

        if (Number(remainingRows[0]?.total ?? 0) > 0) continue;

        const table = targetType === "package" ? "pkg_data" : "offer_data";
        const [targetRows] = await conn.query<RowDataPacket[]>(
            `SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.source')) AS source
             FROM ${table}
             WHERE id = ?`,
            [targetId]
        );

        if (targetRows[0]?.source === "reports") {
            await conn.query(`DELETE FROM ${table} WHERE id = ?`, [targetId]);
        }
    }
}

export async function updatePostsCategory(
    conn: PoolConnection,
    postIds: number[],
    category: "package" | "seasonal_offer" | "general",
    isIgnored: boolean
): Promise<void> {
    if (postIds.length === 0) return;

    await ensureIgnoredColumn(conn);

    const placeholders = postIds.map(() => "?").join(",");
    await conn.query(
        `UPDATE social_media_posts
         SET detected_category = ?, is_ignored = ?
         WHERE id IN (${placeholders})`,
        [category, isIgnored ? 1 : 0, ...postIds]
    );
}

export async function createManualMappings(
    conn: PoolConnection,
    postIds: number[],
    targetType: TargetType,
    targetId: string
): Promise<void> {
    if (postIds.length === 0) return;

    const valuesSql = postIds.map(() => "(?, ?, ?, 'manual', 100)").join(", ");
    const params = postIds.flatMap((postId) => [postId, targetType, targetId]);

    await conn.query(
        `INSERT INTO post_package_mapping
            (post_id, target_type, target_firebase_id, match_method, confidence)
         VALUES ${valuesSql}`,
        params
    );
}

export async function detachTargetMappings(
    conn: PoolConnection,
    targetType: TargetType,
    targetId: string
): Promise<number[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT post_id
         FROM post_package_mapping
         WHERE target_type = ? AND target_firebase_id = ?`,
        [targetType, targetId]
    );

    await conn.query(
        `DELETE FROM post_package_mapping
         WHERE target_type = ? AND target_firebase_id = ?`,
        [targetType, targetId]
    );

    return rows
        .map((row) => Number(row.post_id))
        .filter((postId) => Number.isFinite(postId) && postId > 0);
}
