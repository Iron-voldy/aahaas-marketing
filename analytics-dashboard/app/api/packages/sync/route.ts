import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// A dedicated JSON file to store links securely without breaking the CSV structure
const LINKS_PATH = path.join(process.cwd(), "public", "data", "links.json");

function getLinks() {
    if (fs.existsSync(LINKS_PATH)) {
        return JSON.parse(fs.readFileSync(LINKS_PATH, "utf-8"));
    }
    return {};
}

function saveLinks(links: any) {
    fs.writeFileSync(LINKS_PATH, JSON.stringify(links, null, 2), "utf-8");
}

export async function GET() {
    try {
        const links = getLinks();
        return NextResponse.json({ links });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        // updates shape: { rowIndex: number, fb_post_id?: string, ig_post_id?: string, stats?: any }
        const { updates } = await req.json();
        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: "Invalid updates format. Expected array." }, { status: 400 });
        }

        const links = getLinks();

        for (const u of updates) {
            if (!links[u.rowIndex]) links[u.rowIndex] = {};

            if (u.fb_post_id !== undefined) links[u.rowIndex].fb_post_id = u.fb_post_id;
            if (u.ig_post_id !== undefined) links[u.rowIndex].ig_post_id = u.ig_post_id;

            // If passing explicitly newly fetched stats
            if (u.stats) {
                links[u.rowIndex].latest_stats = u.stats;
                links[u.rowIndex].last_sync = new Date().toISOString();
            }
        }

        saveLinks(links);

        return NextResponse.json({ success: true, links });
    } catch (error: any) {
        console.error("Failed to update links:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update links" },
            { status: 500 }
        );
    }
}
