import fs from "fs";
import path from "path";
import type { Row } from "./types";

// Split a single CSV line respecting double-quoted fields
function splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (ch === "," && !inQuotes) {
            result.push(cur);
            cur = "";
        } else {
            cur += ch;
        }
    }
    result.push(cur);
    return result;
}

// Parse a raw cell value → number | string | null
function parseCell(raw: string): string | number | null {
    const v = raw.trim();
    if (v === "" || v === "-" || v === "N/A") return null;
    const n = Number(v.replace(/,/g, ""));
    return isFinite(n) && v !== "" ? n : v;
}

// Propagate non-empty values leftward in an array (for sparse section headers)
function propagate(cells: string[]): string[] {
    const out: string[] = [];
    let last = "";
    for (const c of cells) {
        if (c.trim()) last = c.trim();
        out.push(last);
    }
    return out;
}

// Merge section header + sub-header + column name into a clean snake_case key
function buildColumnName(section: string, sub: string, col: string): string {
    const sectionMap: Record<string, string> = {
        facebook: "fb",
        instagram: "ig",
        "total social media stats": "total",
        "paid ads": "ads",
        "package information": "",
    };
    const secKey = sectionMap[section.toLowerCase().trim()] ?? "";
    const colPart = col.trim() || sub.trim() || section.trim();
    const full = [secKey, colPart]
        .filter(Boolean)
        .join("_")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
    return full || "col";
}

function parseCsv(text: string): Row[] {
    // Split all lines, keeping quoted multi-line fields intact
    // Strategy: scan character by character to split logical lines
    const logicalLines: string[] = [];
    let curLine = "";
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            if (inQ && text[i + 1] === '"') { curLine += '"'; i++; }
            else { inQ = !inQ; curLine += ch; }
        } else if ((ch === "\n" || ch === "\r") && !inQ) {
            if (ch === "\r" && text[i + 1] === "\n") i++; // CRLF
            logicalLines.push(curLine);
            curLine = "";
        } else {
            curLine += ch;
        }
    }
    if (curLine) logicalLines.push(curLine);

    // The CSV has exactly 3 header rows, then data rows
    if (logicalLines.length < 4) return [];

    // Row 0: section headers (Package Information, Facebook, Instagram, TOTAL…, PAID ADS)
    // Row 1: sub-headers (Interactions, Statistics, …)
    // Row 2: column names (Package, Country, Date Published, …)
    const row0 = splitCsvLine(logicalLines[0]).map(c => c.trim());
    const row1 = splitCsvLine(logicalLines[1]).map(c => c.trim());
    const row2 = splitCsvLine(logicalLines[2]).map(c => c.trim());

    // Propagate section headers across their spanned columns
    const sectionRow = propagate(row0);

    // Build final column keys
    const maxCols = Math.max(sectionRow.length, row1.length, row2.length);
    const rawKeys: string[] = [];
    for (let i = 0; i < maxCols; i++) {
        rawKeys.push(buildColumnName(sectionRow[i] ?? "", row1[i] ?? "", row2[i] ?? ""));
    }

    // De-duplicate keys
    const seen: Record<string, number> = {};
    const keys = rawKeys.map(k => {
        if (seen[k] !== undefined) { seen[k]++; return `${k}_${seen[k]}`; }
        seen[k] = 0; return k;
    });

    // Parse data rows (from index 3 onward)
    const rows: Row[] = [];
    for (let li = 3; li < logicalLines.length; li++) {
        const line = logicalLines[li].trim();
        if (!line) continue; // skip blank lines

        const cells = splitCsvLine(logicalLines[li]);
        // Skip completely empty or separator rows
        if (cells.every(c => !c.trim())) continue;

        const row: Row = {};
        keys.forEach((key, idx) => {
            row[key] = parseCell(cells[idx] ?? "");
        });

        // Skip if the very first key (package type) is empty — it's not a real data row
        const firstVal = Object.values(row)[0];
        if (firstVal === null || firstVal === undefined) continue;

        rows.push(row);
    }

    return rows;
}

// Minimal fallback dataset used only when the CSV file cannot be read
function getSampleData(): Row[] {
    return [
        {
            package: "Picture", country: "Singapore",
            date_published: "16 December 2025, 14:30",
            validity_period: "22nd December 2025",
            fb_reactions: 4, fb_comments: 0, fb_shares: 0, fb_saves: 1,
            fb_reach: 1256, fb_total_clicks: 0, fb_link_clicks: 0,
            ig_reactions: 5, ig_comments: 0, ig_shares: 0, ig_saves: 0,
            ig_reach: 360, total_reach: 1616, total_reactions: 9, total_shares: 0, total_comments: 0,
        },
    ];
}

export async function loadCsv(): Promise<Row[]> {
    const csvPath = path.join(process.cwd(), "public", "data", "packages.csv");
    try {
        const text = fs.readFileSync(csvPath, "utf-8");
        const rows = parseCsv(text);
        if (rows.length > 0) return rows;
        console.warn("[loadCsv] CSV parsed 0 rows — using sample data.");
        return getSampleData();
    } catch (err) {
        console.warn(`[loadCsv] Cannot read ${csvPath}:`, err);
        return getSampleData();
    }
}
