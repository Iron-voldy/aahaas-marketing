import { NextResponse } from "next/server";

const FB_API_VERSION = "v21.0";
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

export async function GET() {
    const accessToken = process.env.FB_ACCESS_TOKEN;
    const pageId = process.env.FB_PAGE_ID;
    const igAccountId = process.env.IG_ACCOUNT_ID;

    if (!accessToken || !pageId) {
        return NextResponse.json(
            { error: "Missing Facebook API credentials in .env.local" },
            { status: 401 }
        );
    }

    try {
        const result = {
            facebook: { followers: 0, reach28d: 0, engagement28d: 0 },
            instagram: { followers: 0, reach28d: 0, profileViews28d: 0 },
        };

        // 1. Fetch Facebook Page Basics
        const fbPageRes = await fetch(`${FB_API_BASE}/${pageId}?fields=followers_count&access_token=${accessToken}`);
        const fbPage = await fbPageRes.json();
        if (!fbPage.error) {
            result.facebook.followers = fbPage.followers_count || 0;
        }

        // 2. Fetch Facebook Page Insights (28 days)
        // page_impressions_unique = Reach
        // page_engaged_users = Engagement
        const fbInsightsRes = await fetch(
            `${FB_API_BASE}/${pageId}/insights?metric=page_impressions_unique,page_engaged_users&period=days_28&access_token=${accessToken}`
        );
        const fbInsights = await fbInsightsRes.json();
        if (!fbInsights.error && fbInsights.data) {
            const reachObj = fbInsights.data.find((m: any) => m.name === "page_impressions_unique");
            if (reachObj?.values?.length > 0) {
                // Values array contains daily datapoints ending yesterday. We take the latest 28-day aggregate.
                result.facebook.reach28d = reachObj.values[reachObj.values.length - 1]?.value || 0;
            }

            const engObj = fbInsights.data.find((m: any) => m.name === "page_engaged_users");
            if (engObj?.values?.length > 0) {
                result.facebook.engagement28d = engObj.values[engObj.values.length - 1]?.value || 0;
            }
        }

        // 3. Fetch Instagram Basics
        if (igAccountId) {
            const igPageRes = await fetch(`${FB_API_BASE}/${igAccountId}?fields=followers_count&access_token=${accessToken}`);
            const igPage = await igPageRes.json();
            if (!igPage.error) {
                result.instagram.followers = igPage.followers_count || 0;
            }

            // 4. Fetch Instagram Insights (Last 28 Days)
            // IG insights are daily, so we fetch limit=28 and sum them up
            const since = Math.floor(Date.now() / 1000) - 28 * 24 * 60 * 60;
            const until = Math.floor(Date.now() / 1000);
            const igInsightsRes = await fetch(
                `${FB_API_BASE}/${igAccountId}/insights?metric=reach,profile_views&period=day&since=${since}&until=${until}&access_token=${accessToken}`
            );
            const igInsights = await igInsightsRes.json();

            if (!igInsights.error && igInsights.data) {
                const reachObj = igInsights.data.find((m: any) => m.name === "reach");
                if (reachObj?.values) {
                    result.instagram.reach28d = reachObj.values.reduce((sum: number, v: any) => sum + (v.value || 0), 0);
                }

                const viewsObj = igInsights.data.find((m: any) => m.name === "profile_views");
                if (viewsObj?.values) {
                    result.instagram.profileViews28d = viewsObj.values.reduce((sum: number, v: any) => sum + (v.value || 0), 0);
                }
            }
        }

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error("Account Insights API Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch account insights" },
            { status: 500 }
        );
    }
}
