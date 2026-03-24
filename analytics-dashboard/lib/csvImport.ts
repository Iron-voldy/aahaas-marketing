/**
 * csvImport.ts
 *
 * Parses Facebook & Instagram Insights CSV exports and maps them to
 * Firestore packages by matching "Publish time" ↔ "Date Published".
 *
 * Supported CSV types:
 *  - fb_posts   : Facebook Posts export (has "Total clicks")
 *  - fb_videos  : Facebook Videos export (has "3-second video views")
 *  - ig_posts   : Instagram Posts / Reels export (has "Saves")
 *  - ig_stories : Instagram Stories export (has "Navigation" or "Replies")
 */

import Papa from "papaparse";
import type { Row } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CsvFileType =
  | "fb_posts"
  | "fb_videos"
  | "ig_posts"
  | "ig_stories"
  | "unknown";

export const FILE_TYPE_LABELS: Record<CsvFileType, string> = {
  fb_posts: "FB Posts",
  fb_videos: "FB Videos",
  ig_posts: "IG Posts / Reels",
  ig_stories: "IG Stories",
  unknown: "Unknown",
};

export const FILE_TYPE_COLORS: Record<CsvFileType, string> = {
  fb_posts: "bg-[#1877F2]/15 text-[#1877F2]",
  fb_videos: "bg-[#1877F2]/10 text-[#1877F2]",
  ig_posts: "bg-pink-500/15 text-pink-500",
  ig_stories: "bg-rose-500/15 text-rose-500",
  unknown: "bg-slate-500/15 text-slate-500",
};

/** Metrics extracted from a single CSV row */
export interface ParsedMetrics {
  fbReach: number;
  fbReactions: number;
  fbTotalClicks: number;
  igReach: number;
  igReactions: number;
  igSaves: number;
}

/** One row parsed from an Insights CSV */
export interface ParsedRow {
  uid: string;           // unique id within this upload session
  fileType: CsvFileType;
  fileName: string;
  postTitle: string;     // Title / Description / Caption from the CSV
  permalink: string;
  publishTime: string;   // raw "Publish time" string from the CSV
  publishDate: Date | null; // parsed Date object for matching
  metrics: ParsedMetrics;
  /** Matched Firestore package id (null = couldn't match) */
  assignedPackageId: string | null;
  /** 0‒1: how confident we are about the match by date */
  matchScore: number;
}

/** Aggregated stats that will be written to a Firestore doc */
export type PackageStats = {
  "FB Reach": number;
  "FB Interactions (Reactions)": number;
  "FB Total Clicks": number;
  "IG Reach": number;
  "IG Interactions (Reactions)": number;
  "IG Interactions (Saves)": number;
  "Combined Reach": number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeNum(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

// ─── File type detection ──────────────────────────────────────────────────────

export function detectFileType(headers: string[]): CsvFileType {
  const h = new Set(headers.map((s) => s.trim().toLowerCase()));
  if (h.has("video asset id") || h.has("3-second video views")) return "fb_videos";
  if (h.has("page id") && h.has("total clicks")) return "fb_posts";
  if (h.has("account id") && h.has("saves")) return "ig_posts";
  if (h.has("account id") && (h.has("navigation") || h.has("replies"))) return "ig_stories";
  return "unknown";
}

// ─── Metric extraction per file type ─────────────────────────────────────────

function extractMetrics(
  row: Record<string, string>,
  fileType: CsvFileType
): ParsedMetrics {
  const empty: ParsedMetrics = {
    fbReach: 0, fbReactions: 0, fbTotalClicks: 0,
    igReach: 0, igReactions: 0, igSaves: 0,
  };
  switch (fileType) {
    case "fb_posts":
      return {
        ...empty,
        fbReach: safeNum(row["Reach"]),
        fbReactions: safeNum(row["Reactions"]),
        fbTotalClicks: safeNum(row["Total clicks"]),
      };
    case "fb_videos":
      return {
        ...empty,
        fbReach: safeNum(row["Reach"]),
        fbReactions: safeNum(row["Reactions"]),
      };
    case "ig_posts":
      return {
        ...empty,
        igReach: safeNum(row["Reach"]),
        igReactions: safeNum(row["Likes"]),
        igSaves: safeNum(row["Saves"]),
      };
    case "ig_stories":
      return {
        ...empty,
        igReach: safeNum(row["Reach"]),
        igReactions: safeNum(row["Likes"]),
      };
    default:
      return empty;
  }
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/**
 * Parse "Publish time" from Facebook/Instagram Insights CSVs.
 * Format: "MM/DD/YYYY HH:MM"  e.g. "12/16/2025 14:30"
 */
export function parseCsvPublishTime(raw: string): Date | null {
  if (!raw) return null;
  // "MM/DD/YYYY HH:MM"
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    return new Date(
      parseInt(m[3]),      // year
      parseInt(m[1]) - 1,  // month (0-indexed)
      parseInt(m[2]),      // day
      parseInt(m[4]),      // hour
      parseInt(m[5])       // minute
    );
  }
  // Fallback to JS native parser
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse "Date Published" stored in Firestore (from packages.csv).
 * Format: "16 December 2025, 14:30"  or "16 December 2025, 14:30"
 */
export function parseFirestoreDate(raw: string | number | null | undefined): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();

  // "DD Month YYYY, HH:MM" or "DD Month YYYY HH:MM"
  const m = s.match(
    /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})[,\s]+(\d{1,2}):(\d{2})/
  );
  if (m) {
    const monthIdx = MONTH_NAMES[m[2].toLowerCase()];
    if (monthIdx !== undefined) {
      return new Date(
        parseInt(m[3]),
        monthIdx,
        parseInt(m[1]),
        parseInt(m[4]),
        parseInt(m[5])
      );
    }
  }
  // Fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Compare two dates at minute precision */
function sameMinute(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

/** Compare two dates at day precision */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─── Package matching ─────────────────────────────────────────────────────────

/**
 * Try to match a CSV row's publish time against known Firestore packages.
 *
 * Strategy (in order):
 *  1. Exact minute match → score 1.0
 *  2. Same day match    → score 0.6
 *  3. Keyword match on title/description → score 0.3–0.5
 */
export function matchToPackage(
  publishDate: Date | null,
  postTitle: string,
  packages: Row[]
): { id: string | null; score: number } {
  let best = { id: null as string | null, score: 0 };

  for (const pkg of packages) {
    if (!pkg.id) continue;

    // ── 1. Match by exact publish datetime ──────────────────────────────────
    const pkgRawDate =
      (pkg["Date Published"] as string) ||
      (pkg["date_published"] as string) ||
      null;
    const pkgDate = parseFirestoreDate(pkgRawDate);

    if (publishDate && pkgDate) {
      if (sameMinute(publishDate, pkgDate)) {
        return { id: pkg.id, score: 1 }; // perfect match – short-circuit
      }
      if (sameDay(publishDate, pkgDate) && best.score < 0.6) {
        best = { id: pkg.id, score: 0.6 };
      }
    }

    // ── 2. Keyword match on post title vs package country / name ───────────
    if (postTitle && best.score < 0.5) {
      const nameTokens = [
        String(pkg["Country"] || pkg["country"] || ""),
        String(pkg["Package"] || pkg["package"] || ""),
        String(pkg["Destination"] || pkg["destination"] || ""),
      ]
        .join(" ")
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2);

      const postLower = postTitle.toLowerCase();
      const matched = nameTokens.filter((w) => postLower.includes(w)).length;
      const score = nameTokens.length > 0 ? (matched / nameTokens.length) * 0.5 : 0;

      if (score > best.score) best = { id: pkg.id, score };
    }
  }

  return best;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Group ParsedRows by assigned package and sum their metrics.
 * Only rows with an assignedPackageId are included.
 */
export function aggregateByPackage(
  rows: ParsedRow[]
): Map<string, PackageStats> {
  const map = new Map<string, PackageStats>();

  for (const row of rows) {
    if (!row.assignedPackageId) continue;
    const cur = map.get(row.assignedPackageId) ?? {
      "FB Reach": 0,
      "FB Interactions (Reactions)": 0,
      "FB Total Clicks": 0,
      "IG Reach": 0,
      "IG Interactions (Reactions)": 0,
      "IG Interactions (Saves)": 0,
      "Combined Reach": 0,
    };

    cur["FB Reach"] += row.metrics.fbReach;
    cur["FB Interactions (Reactions)"] += row.metrics.fbReactions;
    cur["FB Total Clicks"] += row.metrics.fbTotalClicks;
    cur["IG Reach"] += row.metrics.igReach;
    cur["IG Interactions (Reactions)"] += row.metrics.igReactions;
    cur["IG Interactions (Saves)"] += row.metrics.igSaves;

    map.set(row.assignedPackageId, cur);
  }

  // Recalculate Combined Reach
  for (const [id, stats] of map) {
    stats["Combined Reach"] = stats["FB Reach"] + stats["IG Reach"];
    map.set(id, stats);
  }

  return map;
}

// ─── File parser ──────────────────────────────────────────────────────────────

/** Parse a single CSV file object in the browser and return ParsedRows. */
export async function parseCsvFile(
  file: File,
  packages: Row[]
): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers: string[] = results.meta.fields ?? [];
        const fileType = detectFileType(headers);
        const rows: ParsedRow[] = [];

        (results.data as Record<string, string>[]).forEach((raw, i) => {
          // Must have a numeric post ID
          const postId =
            raw["Post ID"] || raw["Video asset ID"] || "";
          if (!postId || !/^\d{5,}/.test(postId.trim())) return;

          const postTitle =
            raw["Title"] || raw["Description"] || raw["Caption"] || "";
          const publishTimeRaw = raw["Publish time"] || "";
          const publishDate = parseCsvPublishTime(publishTimeRaw);
          const metrics = extractMetrics(raw, fileType);

          // Skip rows with all-zero metrics (incomplete / header rows)
          const hasData = Object.values(metrics).some((v) => v > 0);
          if (!hasData) return;

          const { id, score } = matchToPackage(publishDate, postTitle, packages);

          rows.push({
            uid: `${file.name}::${i}`,
            fileType,
            fileName: file.name,
            postTitle: postTitle.replace(/\n+/g, " ").slice(0, 120),
            permalink: raw["Permalink"] || "",
            publishTime: publishTimeRaw,
            publishDate,
            metrics,
            assignedPackageId: score >= 0.6 ? id : null,
            matchScore: score,
          });
        });

        resolve(rows);
      },
      error: reject,
    });
  });
}

/** Parse multiple files in parallel and merge the results. */
export async function parseAllFiles(
  files: File[],
  packages: Row[]
): Promise<ParsedRow[]> {
  const results = await Promise.all(files.map((f) => parseCsvFile(f, packages)));
  return results.flat();
}
