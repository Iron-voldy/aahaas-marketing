import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/loadCsv";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // Auto-transform sharepoint/onedrive links if possible to force download
        let downloadUrl = url;
        try {
            const urlObj = new URL(url);

            // Handle standard SharePoint/OneDrive viewer links
            if (urlObj.hostname.includes("sharepoint.com") || urlObj.hostname.includes("onedrive.live.com")) {
                // If it's a Doc.aspx link, try to convert it to a download link
                if (urlObj.pathname.endsWith("Doc.aspx")) {
                    const sourcedoc = urlObj.searchParams.get("sourcedoc");
                    if (sourcedoc) {
                        // Rewrite the path from Doc.aspx to download.aspx and pass the ID
                        urlObj.pathname = urlObj.pathname.replace("Doc.aspx", "download.aspx");
                        // Clear existing params and set UniqueId
                        urlObj.search = "";
                        urlObj.searchParams.set("UniqueId", sourcedoc);
                    }
                } else {
                    // Fallback for other SharePoint links (like /:x:/g/...)
                    urlObj.searchParams.set("download", "1");
                }
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

        // Fetch as ArrayBuffer to handle both text (CSV) and binary (XLSX)
        const arrayBuffer = await res.arrayBuffer();
        let text = "";

        // Try parsing as Excel first
        try {
            const tempBuffer = Buffer.from(arrayBuffer);
            const workbook = XLSX.read(tempBuffer, { type: "buffer" });

            if (workbook.SheetNames.length > 0) {
                // Convert the first sheet to CSV
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                text = XLSX.utils.sheet_to_csv(worksheet);
                console.log("[Sync API] Successfully parsed Excel to CSV internally");
            }
        } catch (excelError) {
            // If it's not a valid Excel file, fallback to treating it as raw text (CSV)
            text = new TextDecoder("utf-8").decode(arrayBuffer);
        }

        // Basic validation: Check if it looks like a CSV (contains our expected headers)
        if (!text.toLowerCase().includes("package") && !text.toLowerCase().includes("facebook")) {
            return NextResponse.json({
                error: "The returned file does not appear to be a valid Aahaas Statistics CSV or Excel table. Please ensure the link points directly to the data file."
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
