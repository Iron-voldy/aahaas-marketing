import { NextResponse } from "next/server";

const FB_API_VERSION = "v21.0"; // Note: v21.0 or newer
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
        // Fetch Facebook Posts
        const fbRes = await fetch(
            `${FB_API_BASE}/${pageId}/posts?fields=id,message,created_time,full_picture,permalink_url&limit=20&access_token=${accessToken}`
        );
        const fbData = await fbRes.json();

        if (fbData.error) {
            console.error("Facebook API Error:", fbData.error);
            throw new Error(`FB API Error: ${fbData.error.message}`);
        }

        const fbPosts = (fbData.data || []).map((post: any) => ({
            id: post.id,
            platform: "facebook",
            message: post.message || "",
            created_time: post.created_time,
            picture: post.full_picture || null,
            url: post.permalink_url || null,
        }));

        // Fetch Instagram Media (if IG account is linked)
        let igPosts: any[] = [];
        if (igAccountId) {
            const igRes = await fetch(
                `${FB_API_BASE}/${igAccountId}/media?fields=id,caption,timestamp,media_type,media_url,thumbnail_url,permalink&limit=20&access_token=${accessToken}`
            );
            const igData = await igRes.json();

            if (!igData.error) {
                igPosts = (igData.data || []).map((post: any) => ({
                    id: post.id,
                    platform: "instagram",
                    message: post.caption || "",
                    created_time: post.timestamp,
                    picture: post.thumbnail_url || post.media_url || null,
                    url: post.permalink || null,
                }));
            } else {
                console.warn("Instagram API Error (skipping IG posts):", igData.error);
            }
        }

        // Combine and sort by date descending
        const allPosts = [...fbPosts, ...igPosts].sort((a, b) =>
            new Date(b.created_time).getTime() - new Date(a.created_time).getTime()
        );

        return NextResponse.json({ posts: allPosts });
    } catch (error: any) {
        console.error("Failed to fetch posts:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch posts" },
            { status: 500 }
        );
    }
}
