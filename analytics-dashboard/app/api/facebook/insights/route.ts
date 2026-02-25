import { NextResponse } from "next/server";

const FB_API_VERSION = "v21.0";
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    const platform = searchParams.get("platform");

    const accessToken = process.env.FB_ACCESS_TOKEN;

    if (!accessToken || !postId || !platform) {
        return NextResponse.json(
            { error: "Missing required parameters or access token." },
            { status: 400 }
        );
    }

    try {
        let result = {
            reach: 0,
            reactions: 0,
            comments: 0,
            shares: 0,
            saves: 0,
            clicks: 0,
        };

        if (platform === "facebook") {
            // 1. Get raw stats from the post object (comments, shares)
            const postRes = await fetch(
                `${FB_API_BASE}/${postId}?fields=shares,comments.summary(total_count)&access_token=${accessToken}`
            );
            const postData = await postRes.json();
            if (postData.error) throw new Error(postData.error.message);

            result.shares = postData.shares?.count || 0;
            result.comments = postData.comments?.summary?.total_count || 0;

            // 2. Get Insights for Reach, Reactions, Clicks
            // Note: post_impressions_unique is "Reach". post_reactions_by_type_total gives all reactions.
            const insightsRes = await fetch(
                `${FB_API_BASE}/${postId}/insights?metric=post_impressions_unique,post_reactions_by_type_total,post_clicks_by_type&access_token=${accessToken}`
            );
            const insightsData = await insightsRes.json();
            if (insightsData.error) throw new Error(insightsData.error.message);

            const insights = insightsData.data || [];

            const reachObj = insights.find((i: any) => i.name === "post_impressions_unique");
            if (reachObj?.values?.[0]?.value) {
                result.reach = reachObj.values[0].value;
            }

            const reactionsObj = insights.find((i: any) => i.name === "post_reactions_by_type_total");
            if (reactionsObj?.values?.[0]?.value) {
                // Sum up all reaction types (like, love, wow, haha, sad, angry)
                const reactMap = reactionsObj.values[0].value;
                result.reactions = Object.values(reactMap).reduce((sum: any, val: any) => sum + (Number(val) || 0), 0) as number;
            }

            const clicksObj = insights.find((i: any) => i.name === "post_clicks_by_type");
            if (clicksObj?.values?.[0]?.value) {
                // Includes link clicks, photo views, etc.
                const clickMap = clicksObj.values[0].value;
                result.clicks = Object.values(clickMap).reduce((sum: any, val: any) => sum + (Number(val) || 0), 0) as number;
            }

        } else if (platform === "instagram") {
            // 1. Get basic counts from Media object
            const mediaRes = await fetch(
                `${FB_API_BASE}/${postId}?fields=comments_count,like_count&access_token=${accessToken}`
            );
            const mediaData = await mediaRes.json();
            if (mediaData.error) throw new Error(mediaData.error.message);

            // IG Likes are treated as Reactions here
            result.reactions = mediaData.like_count || 0;
            result.comments = mediaData.comments_count || 0;

            // 2. Get Insights for Reach and Saves
            const insightsRes = await fetch(
                `${FB_API_BASE}/${postId}/insights?metric=reach,saved&access_token=${accessToken}`
            );
            const insightsData = await insightsRes.json();

            // Some API versions/media types might not support all insights, so we handle safely
            if (!insightsData.error) {
                const insights = insightsData.data || [];
                const reachObj = insights.find((i: any) => i.name === "reach");
                if (reachObj?.values?.[0]?.value) {
                    result.reach = reachObj.values[0].value;
                }

                const savesObj = insights.find((i: any) => i.name === "saved");
                if (savesObj?.values?.[0]?.value) {
                    result.saves = savesObj.values[0].value;
                }
            }
        } else {
            throw new Error(`Invalid platform: ${platform}`);
        }

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error(`Failed to fetch insights for ${postId}:`, error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch insights" },
            { status: 500 }
        );
    }
}
