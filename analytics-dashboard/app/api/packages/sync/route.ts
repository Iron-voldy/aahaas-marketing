import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/loadCsv";

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // Auto-transform sharepoint/onedrive links if possible to force download
        // E.g., change ?e=xxxxx to ?download=1
        let downloadUrl = url;
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes("sharepoint.com") || urlObj.hostname.includes("onedrive.live.com")) {
                urlObj.searchParams.set("download", "1");
                downloadUrl = urlObj.toString();
            }
        } catch (e) { /* ignore invalid URL parse */ }

        const res = await fetch(downloadUrl, {
            cache: "no-store",
            // Some cloud providers require a user-agent
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; Aahaas-Analytics/1.0)",
            }
        });

        if (!res.ok) {
            return NextResponse.json({
                error: `Failed to fetch from URL (Status: ${res.status} ${res.statusText})`
            }, { status: 400 });
        }

        const text = await res.text();

        // Basic validation: Check if it looks like a CSV (contains our expected headers)
        if (!text.toLowerCase().includes("package") && !text.toLowerCase().includes("facebook")) {
            return NextResponse.json({
                error: "The returned file does not appear to be a valid Aahaas Statistics CSV format. Please ensure the link is a public, direct download link to the CSV file."
            }, { status: 400 });
        }

        // Try writing to local FS if in development (Will fail on Vercel, which is fine)
        try {
            const csvPath = path.join(process.cwd(), "public", "data", "packages.csv");
            fs.writeFileSync(csvPath, text, "utf-8");
            console.log("[Sync API] Successfully updated local packages.csv");
        } catch (fsError) {
            console.log("[Sync API] Running in read-only mode (e.g. Vercel). Local file not updated, relying on browser cache.");
        }

        // Parse and return to client so it can cache it in localStorage
        const result = parseCsv(text);

        return NextResponse.json({
            success: true,
            rowCount: result.rows.length,
            rows: result.rows,
            lastUpdated: result.lastUpdated
        });

    } catch (error: any) {
        console.error("[Sync API Error]", error);
        return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
    }
}
