import fs from "fs";
import path from "path";
import type { Row } from "./types";

export interface LoadCsvResult {
    rows: Row[];
    lastUpdated: string | null;
}

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

export function parseCsv(text: string): LoadCsvResult {
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

    if (logicalLines.length < 4) return { rows: [], lastUpdated: null };

    const row0 = splitCsvLine(logicalLines[0]).map(c => c.trim());
    const row1 = splitCsvLine(logicalLines[1]).map(c => c.trim());
    const row2 = splitCsvLine(logicalLines[2]).map(c => c.trim());

    // Extract Last Updated from Row 1, Column 1 (index 1) which is "21/02/2026"
    // In row0, index 1 is "Last Updated Date and Time"
    let lastUpdated = null;
    if (row1.length > 1 && row1[1]) {
        lastUpdated = row1[1];
    } else if (row0.length > 1 && row0[1] && row0[1].includes("Updated")) {
        // sometimes data shifts, check if it's in row 1
    }

    const sectionRow = propagate(row0);
    const maxCols = Math.max(sectionRow.length, row1.length, row2.length);
    const rawKeys: string[] = [];
    for (let i = 0; i < maxCols; i++) {
        rawKeys.push(buildColumnName(sectionRow[i] ?? "", row1[i] ?? "", row2[i] ?? ""));
    }

    const seen: Record<string, number> = {};
    const keys = rawKeys.map(k => {
        if (seen[k] !== undefined) { seen[k]++; return `${k}_${seen[k]}`; }
        seen[k] = 0; return k;
    });

    const rows: Row[] = [];
    for (let li = 3; li < logicalLines.length; li++) {
        const line = logicalLines[li].trim();
        if (!line) continue;

        const cells = splitCsvLine(logicalLines[li]);
        if (cells.every(c => !c.trim())) continue;

        const row: Row = {};
        keys.forEach((key, idx) => {
            row[key] = parseCell(cells[idx] ?? "");
        });

        const firstVal = row[keys[0]];
        if (firstVal === null || firstVal === undefined) continue;

        rows.push(row);
    }

    return { rows, lastUpdated };
}

function getSampleData(): LoadCsvResult {
    return {
        rows: [{
            package: "Picture", country: "Singapore",
            date_published: "16 December 2025, 14:30",
            validity_period: "22nd December 2025",
            fb_reactions: 4, fb_comments: 0, fb_shares: 0, fb_saves: 1,
            fb_reach: 1256, fb_total_clicks: 0, fb_link_clicks: 0,
            ig_reactions: 5, ig_comments: 0, ig_shares: 0, ig_saves: 0,
            ig_reach: 360, total_reach: 1616, total_reactions: 9, total_shares: 0, total_comments: 0,
        }],
        lastUpdated: "Sample Data Mode"
    };
}

export async function loadCsv(): Promise<LoadCsvResult> {
    const csvPath = path.join(process.cwd(), "public", "data", "packages.csv");
    try {
        const text = fs.readFileSync(csvPath, "utf-8");
        const res = parseCsv(text);
        if (res.rows.length > 0) return res;
        console.warn("[loadCsv] CSV parsed 0 rows — using sample data.");
        return getSampleData();
    } catch (err) {
        console.warn(`[loadCsv] Cannot read ${csvPath}:`, err);
        return getSampleData();
    }
}
