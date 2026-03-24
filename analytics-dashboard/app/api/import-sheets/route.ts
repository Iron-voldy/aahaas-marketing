import { NextResponse } from "next/server";
import { getMysqlPool } from "@/lib/mysql";
import {
    processImport,
    parsePackageDate,
    type CsvPost,
    type PackageRef,
    type OfferRef,
    type ProcessedPost,
} from "@/lib/postIdentifier";
import { matchPostsWithAI, type PostForAI } from "@/lib/openai";

interface RequestBody {
    files: {
        fb_posts?: CsvPost[];
        fb_videos?: CsvPost[];
        ig_posts?: CsvPost[];
        ig_stories?: CsvPost[];
    };
    packages: PackageRef[];
    offers: OfferRef[];
}

function toMysqlDatetime(d: Date | null): string | null {
    if (!d) return null;
    return d.toISOString().slice(0, 19).replace("T", " ");
}

function toInt(v: unknown): number {
    const n = Number(v);
    return isNaN(n) ? 0 : Math.round(n);
}

function toDec(v: unknown): number {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
}

/**
 * POST /api/import-sheets
 *
 * Body: { files: {...}, packages: [...], offers: [...] }
 *
 * 1. Runs the matching algorithm
 * 2. Stores everything in MySQL (import_sessions, social_media_posts, post_package_mapping)
 * 3. Returns match results + aggregated metrics
 */
export async function POST(request: Request) {
    try {
        const body: RequestBody = await request.json();
        const { files, packages, offers } = body;

        // Merge all posts into a single array
        const allPosts: CsvPost[] = [
            ...(files.fb_posts ?? []),
            ...(files.fb_videos ?? []),
            ...(files.ig_posts ?? []),
            ...(files.ig_stories ?? []),
        ];

        if (allPosts.length === 0) {
            return NextResponse.json({ error: "No posts to import" }, { status: 400 });
        }

        // ── 1. Run keyword-based matching algorithm (pure logic, no I/O) ──
        const result = processImport(allPosts, packages, offers);

        // ── 1b. AI-enhanced matching for unmatched non-general posts ──
        const unmatchedForAI = result.processedPosts
            .map((p, i) => ({ post: p, index: i }))
            .filter(({ post }) => !post.match && post.detectedCategory !== "general");

        if (unmatchedForAI.length > 0 && (packages.length > 0 || offers.length > 0)) {
            try {
                const aiPosts: PostForAI[] = unmatchedForAI.map(({ post, index }) => ({
                    index,
                    sourceType: post.sourceType,
                    postId: post.postId,
                    title: post.title,
                    description: post.description,
                    publishTime: post.publishTime,
                    permalink: post.permalink,
                }));

                const aiResults = await matchPostsWithAI(aiPosts, packages, offers);

                // Apply AI matches to unmatched posts (with date enforcement)
                for (const aiMatch of aiResults) {
                    if (!aiMatch.matchedId || aiMatch.confidence < 40) continue;
                    const post = result.processedPosts[aiMatch.index];
                    if (!post || post.match) continue; // Already matched by keywords

                    // Enforce date proximity AND country match: AI can hallucinate
                    if (aiMatch.category === "package" && aiMatch.matchedId) {
                        const matchedPkg = packages.find(p => p.id === aiMatch.matchedId);
                        if (matchedPkg) {
                            // Date guard: reject if more than ±3 days apart
                            if (post.parsedPublishTime) {
                                const pkgDate = parsePackageDate(matchedPkg.datePublished);
                                if (pkgDate) {
                                    const diffDays = Math.abs(pkgDate.getTime() - post.parsedPublishTime.getTime()) / (24 * 60 * 60 * 1000);
                                    if (diffDays > 3) {
                                        console.log(`[import-sheets] AI match rejected: post ${post.postId} (${post.parsedPublishTime.toDateString()}) -> pkg "${matchedPkg.name}" (${matchedPkg.datePublished}) — ${diffDays.toFixed(0)} days apart`);
                                        continue;
                                    }
                                }
                            }
                            // Country guard: reject if keyword-detected country clearly differs from package country.
                            // e.g. Japan visa post must never match a Singapore package.
                            if (post.detectedCountry) {
                                const pkgBase = matchedPkg.country.split(" - ")[0].toLowerCase().trim();
                                const postBase = post.detectedCountry.split(" - ")[0].toLowerCase().trim();
                                const countryOk = pkgBase === postBase
                                    || pkgBase.includes(postBase)
                                    || postBase.includes(pkgBase);
                                if (!countryOk) {
                                    console.log(`[import-sheets] AI match rejected: country mismatch — post country "${post.detectedCountry}" vs pkg "${matchedPkg.name}" (${matchedPkg.country})`);
                                    continue;
                                }
                            }
                        }
                    }

                    post.match = {
                        targetType: aiMatch.category === "package" ? "package" : "seasonal_offer",
                        targetId: aiMatch.matchedId,
                        matchMethod: "ai_match",
                        confidence: aiMatch.confidence,
                    };
                    if (aiMatch.category !== "general") {
                        post.detectedCategory = aiMatch.category;
                    }
                    // Only supplement detectedCountry if keyword detection found nothing.
                    // Do NOT overwrite an already-confirmed country with AI's guess.
                    if (aiMatch.detectedCountry && !post.detectedCountry) {
                        post.detectedCountry = aiMatch.detectedCountry;
                    }
                }

                // Re-aggregate after AI matches
                result.packageUpdates = reAggregate(result.processedPosts, packages, "package");
                result.offerUpdates = reAggregateOffers(result.processedPosts, offers);
                result.stats.matched = result.processedPosts.filter((p) => p.match !== null).length;
                result.stats.unmatched = result.processedPosts.filter((p) => p.detectedCategory !== "general" && p.match === null).length;

                console.log(`[import-sheets] AI matching: ${aiResults.filter(r => r.matchedId && r.confidence >= 40).length} additional matches`);
            } catch (aiErr) {
                console.error("[import-sheets] AI matching failed (continuing with keyword matches):", aiErr);
            }
        }

        // ── 2. Store in MySQL ──
        const pool = getMysqlPool();
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            // Create session
            const [sessionResult] = await conn.query(
                `INSERT INTO import_sessions
                 (fb_posts_count, fb_videos_count, ig_posts_count, ig_stories_count,
                  total_matched, total_unmatched, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'review')`,
                [
                    result.stats.fbPosts,
                    result.stats.fbVideos,
                    result.stats.igPosts,
                    result.stats.igStories,
                    result.stats.matched,
                    result.stats.unmatched,
                ],
            );
            const sessionId = (sessionResult as { insertId: number }).insertId;

            // Insert posts and mappings (with deduplication)
            for (const post of result.processedPosts) {
                const publishDt = toMysqlDatetime(post.parsedPublishTime);

                // Check if this post already exists (by source_type + post_id)
                let mysqlPostId: number;
                if (post.postId) {
                    const [existing] = await conn.query(
                        `SELECT id FROM social_media_posts WHERE source_type = ? AND post_id = ? LIMIT 1`,
                        [post.sourceType, post.postId],
                    );
                    const existingRows = existing as { id: number }[];
                    if (existingRows.length > 0) {
                        // Update existing post with latest metrics
                        mysqlPostId = existingRows[0].id;
                        await conn.query(
                            `UPDATE social_media_posts SET
                                import_session_id = ?, reach = ?, views = ?, reactions = ?, comments = ?,
                                shares = ?, saves = ?, total_clicks = ?, link_clicks = ?, other_clicks = ?,
                                three_sec_views = ?, one_min_views = ?, seconds_viewed = ?, avg_seconds_viewed = ?,
                                profile_visits = ?, replies = ?, navigation = ?, follows = ?,
                                ad_impressions = ?, ad_cpm = ?, estimated_earnings = ?,
                                has_package_hashtag = ?, detected_category = ?, detected_country = ?, hashtags = ?
                             WHERE id = ?`,
                            [
                                sessionId,
                                toInt(post.reach), toInt(post.views), toInt(post.reactions),
                                toInt(post.comments), toInt(post.shares), toInt(post.saves),
                                toInt(post.totalClicks), toInt(post.linkClicks), toInt(post.otherClicks),
                                toInt(post.threeSecViews), toInt(post.oneMinViews),
                                toInt(post.secondsViewed), toDec(post.avgSecondsViewed),
                                toInt(post.profileVisits), toInt(post.replies),
                                toInt(post.navigation), toInt(post.follows),
                                toInt(post.adImpressions), toDec(post.adCpm),
                                toDec(post.estimatedEarnings),
                                post.hasPackageHashtag ? 1 : 0,
                                post.detectedCategory,
                                post.detectedCountry,
                                post.hashtags.join(", "),
                                mysqlPostId,
                            ],
                        );
                    } else {
                        // Insert new post
                        const [postResult] = await conn.query(
                            `INSERT INTO social_media_posts
                             (import_session_id, source_type, post_id, page_or_account_id,
                              title, description, publish_time, permalink, post_type,
                              reach, views, reactions, comments, shares, saves,
                              total_clicks, link_clicks, other_clicks,
                              three_sec_views, one_min_views, seconds_viewed, avg_seconds_viewed,
                              profile_visits, replies, navigation, follows,
                              ad_impressions, ad_cpm, estimated_earnings,
                              has_package_hashtag, detected_category, detected_country,
                              hashtags)
                             VALUES (?,?,?,?, ?,?,?,?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?)`,
                            [
                                sessionId, post.sourceType, post.postId, post.pageOrAccountId,
                                (post.title || "").slice(0, 65535), (post.description || "").slice(0, 65535),
                                publishDt, post.permalink, post.postType,
                                toInt(post.reach), toInt(post.views), toInt(post.reactions),
                                toInt(post.comments), toInt(post.shares), toInt(post.saves),
                                toInt(post.totalClicks), toInt(post.linkClicks), toInt(post.otherClicks),
                                toInt(post.threeSecViews), toInt(post.oneMinViews),
                                toInt(post.secondsViewed), toDec(post.avgSecondsViewed),
                                toInt(post.profileVisits), toInt(post.replies),
                                toInt(post.navigation), toInt(post.follows),
                                toInt(post.adImpressions), toDec(post.adCpm),
                                toDec(post.estimatedEarnings),
                                post.hasPackageHashtag ? 1 : 0,
                                post.detectedCategory,
                                post.detectedCountry,
                                post.hashtags.join(", "),
                            ],
                        );
                        mysqlPostId = (postResult as { insertId: number }).insertId;
                    }
                } else {
                    // No post_id — insert new (rare edge case)
                    const [postResult] = await conn.query(
                        `INSERT INTO social_media_posts
                         (import_session_id, source_type, post_id, page_or_account_id,
                          title, description, publish_time, permalink, post_type,
                          reach, views, reactions, comments, shares, saves,
                          total_clicks, link_clicks, other_clicks,
                          three_sec_views, one_min_views, seconds_viewed, avg_seconds_viewed,
                          profile_visits, replies, navigation, follows,
                          ad_impressions, ad_cpm, estimated_earnings,
                          has_package_hashtag, detected_category, detected_country,
                          hashtags)
                         VALUES (?,?,?,?, ?,?,?,?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?)`,
                        [
                            sessionId, post.sourceType, post.postId, post.pageOrAccountId,
                            (post.title || "").slice(0, 65535), (post.description || "").slice(0, 65535),
                            publishDt, post.permalink, post.postType,
                            toInt(post.reach), toInt(post.views), toInt(post.reactions),
                            toInt(post.comments), toInt(post.shares), toInt(post.saves),
                            toInt(post.totalClicks), toInt(post.linkClicks), toInt(post.otherClicks),
                            toInt(post.threeSecViews), toInt(post.oneMinViews),
                            toInt(post.secondsViewed), toDec(post.avgSecondsViewed),
                            toInt(post.profileVisits), toInt(post.replies),
                            toInt(post.navigation), toInt(post.follows),
                            toInt(post.adImpressions), toDec(post.adCpm),
                            toDec(post.estimatedEarnings),
                            post.hasPackageHashtag ? 1 : 0,
                            post.detectedCategory,
                            post.detectedCountry,
                            post.hashtags.join(", "),
                        ],
                    );
                    mysqlPostId = (postResult as { insertId: number }).insertId;
                }

                // Upsert mapping if matched
                if (post.match) {
                    // Remove old mappings for this post then insert fresh
                    await conn.query(`DELETE FROM post_package_mapping WHERE post_id = ?`, [mysqlPostId]);
                    await conn.query(
                        `INSERT INTO post_package_mapping
                         (post_id, target_type, target_firebase_id, match_method, confidence)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            mysqlPostId,
                            post.match.targetType,
                            post.match.targetId,
                            post.match.matchMethod,
                            post.match.confidence,
                        ],
                    );
                }
            }

            await conn.commit();

            // Return results
            return NextResponse.json({
                sessionId,
                packageUpdates: result.packageUpdates,
                offerUpdates: result.offerUpdates,
                unmatchedPosts: result.processedPosts
                    .filter((p) => p.detectedCategory !== "general" && !p.match)
                    .map(summarizePost),
                stats: result.stats,
            });
        } catch (dbErr) {
            await conn.rollback();
            throw dbErr;
        } finally {
            conn.release();
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[import-sheets] Error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function summarizePost(p: ProcessedPost) {
    return {
        sourceType: p.sourceType,
        postId: p.postId,
        title: (p.title || p.description || "").slice(0, 120),
        publishTime: p.publishTime,
        detectedCategory: p.detectedCategory,
        detectedCountry: p.detectedCountry,
        reach: p.reach,
        reactions: p.reactions,
    };
}

// ── Re-aggregation helpers (after AI matching) ──

import type { PackageUpdate, OfferUpdate } from "@/lib/postIdentifier";

function reAggregate(posts: ProcessedPost[], packages: PackageRef[], _type: "package"): PackageUpdate[] {
    const groups = new Map<string, ProcessedPost[]>();
    for (const post of posts) {
        if (post.match?.targetType !== "package") continue;
        const id = post.match.targetId;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id)!.push(post);
    }
    const updates: PackageUpdate[] = [];
    for (const [pkgId, matched] of groups) {
        const pkg = packages.find((p) => p.id === pkgId);
        if (!pkg) continue;
        // Only use posts whose publish date is within ±3 days of package date
        const pkgDate = parsePackageDate(pkg.datePublished);
        const dateFiltered = pkgDate
            ? matched.filter(p => p.parsedPublishTime && Math.abs(pkgDate.getTime() - p.parsedPublishTime.getTime()) <= 3 * 24 * 60 * 60 * 1000)
            : matched;
        const postsToUse = dateFiltered.length > 0 ? dateFiltered : matched;
        const fbPost = postsToUse.find((p) => p.sourceType === "fb_post") || postsToUse.find((p) => p.sourceType === "fb_video");
        const igPost = postsToUse.find((p) => p.sourceType === "ig_post") || postsToUse.find((p) => p.sourceType === "ig_story");
        const metrics: Record<string, number> = {};
        if (fbPost) {
            metrics["FB Reach"] = fbPost.reach;
            metrics["FB Interactions (Reactions)"] = fbPost.reactions;
            metrics["FB Interactions (Comments)"] = fbPost.comments;
            metrics["FB Interactions (Shares)"] = fbPost.shares;
            metrics["FB Interactions (Saves)"] = fbPost.saves;
            metrics["FB Total Clicks"] = fbPost.totalClicks;
            metrics["FB Link Clicks"] = fbPost.linkClicks;
        }
        if (igPost) {
            metrics["IG Reach"] = igPost.reach;
            metrics["IG Interactions (Reactions)"] = igPost.reactions;
            metrics["IG Interactions (Comments)"] = igPost.comments;
            metrics["IG Interactions (Shares)"] = igPost.shares;
            metrics["IG Interactions (Saves)"] = igPost.saves;
        }
        metrics["Combined Reach"] = (metrics["FB Reach"] ?? 0) + (metrics["IG Reach"] ?? 0);
        updates.push({
            packageId: pkgId, packageCountry: pkg.country, packageDate: pkg.datePublished, metrics,
            postUrls: { fb: fbPost?.permalink || undefined, ig: igPost?.permalink || undefined },
            matchedPosts: matched.map((p) => ({
                sourceType: p.sourceType, postId: p.postId, title: (p.title || p.description || "").slice(0, 100),
                publishTime: p.publishTime, matchMethod: p.match!.matchMethod, confidence: p.match!.confidence, reach: p.reach,
            })),
        });
    }
    return updates;
}

function reAggregateOffers(posts: ProcessedPost[], offers: OfferRef[]): OfferUpdate[] {
    const groups = new Map<string, ProcessedPost[]>();
    for (const post of posts) {
        if (post.match?.targetType !== "seasonal_offer") continue;
        const id = post.match.targetId;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id)!.push(post);
    }
    const updates: OfferUpdate[] = [];
    for (const [offerId, matched] of groups) {
        const offer = offers.find((o) => o.id === offerId);
        if (!offer) continue;
        const fbPost = matched.find((p) => p.sourceType === "fb_post") || matched.find((p) => p.sourceType === "fb_video");
        const igPost = matched.find((p) => p.sourceType === "ig_post") || matched.find((p) => p.sourceType === "ig_story");
        const metrics: Record<string, number> = {};
        if (fbPost) { metrics.fbReach = fbPost.reach; metrics.fbReactions = fbPost.reactions; metrics.fbComments = fbPost.comments; metrics.fbShares = fbPost.shares; metrics.fbClicks = fbPost.totalClicks; }
        if (igPost) { metrics.igReach = igPost.reach; metrics.igReactions = igPost.reactions; metrics.igComments = igPost.comments; metrics.igShares = igPost.shares; metrics.igSaves = igPost.saves; }
        metrics.combinedReach = (metrics.fbReach ?? 0) + (metrics.igReach ?? 0);
        updates.push({
            offerId, offerName: offer.name, offerCategory: offer.category, metrics,
            postUrls: { fb: fbPost?.permalink || undefined, ig: igPost?.permalink || undefined },
            matchedPosts: matched.map((p) => ({
                sourceType: p.sourceType, postId: p.postId, title: (p.title || p.description || "").slice(0, 100),
                publishTime: p.publishTime, matchMethod: p.match!.matchMethod, confidence: p.match!.confidence, reach: p.reach,
            })),
        });
    }
    return updates;
}
