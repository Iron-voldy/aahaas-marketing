import type {
    Row,
    InferredSchema,
    KpiCard,
    TimeSeriesPoint,
    BarDataPoint,
    PieDataPoint,
    OutlierResult,
    InsightResult,
} from "./types";
import { parseFlexibleDate } from "./inferSchema";

// ─── Group By ───────────────────────────────────────────────────────────────
export function groupBy(rows: Row[], column: string): Map<string, Row[]> {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
        const key = String(row[column] ?? "Unknown");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(row);
    }
    return map;
}

// ─── Get delta for a numeric column over a date range ──────────────────────
export function getDeltaForRange(row: Row, col: string, from?: string, to?: string): number {
    const history = row.history as Record<string, Record<string, string | number>> | undefined;
    
    // If no history, return the current value only if 'to' is undefined or current date 
    // or if the row matches the publication date range (handled by caller).
    // In aggregate context, if we have no history, the "delta" over time is just the final value
    // because we don't know when the growth happened.
    if (!history) {
        return Number(row[col]) || 0;
    }

    const dates = Object.keys(history).sort();
    if (dates.length === 0) return Number(row[col]) || 0;

    // Latest value within or before the 'to' date
    const endEntries = to ? dates.filter(d => d <= to) : dates;
    if (endEntries.length === 0) return 0;
    const latestDateInRange = endEntries[endEntries.length - 1];
    const endValue = Number(history[latestDateInRange][col]) || 0;

    // If single date selected, return the cumulative total as of that day
    if (from && to && from === to) {
        return endValue;
    }

    // Otherwise, calculate delta
    let startValue = 0;
    if (from) {
        const startEntries = dates.filter(d => d < from);
        if (startEntries.length > 0) {
            const latestDateBeforeRange = startEntries[startEntries.length - 1];
            startValue = Number(history[latestDateBeforeRange][col]) || 0;
        }
    }

    return endValue - startValue;
}

// ─── Sum a numeric column over an array of rows ───────────────────────────
export function sumColumn(rows: Row[], col: string, from?: string, to?: string): number {
    return rows.reduce((acc, r) => {
        return acc + getDeltaForRange(r, col, from, to);
    }, 0);
}

export function avgColumn(rows: Row[], col: string, from?: string, to?: string): number {
    const deltas = rows
        .map((r) => getDeltaForRange(r, col, from, to));
    if (!deltas.length) return 0;
    return deltas.reduce((a, b) => a + b, 0) / deltas.length;
}

// ─── Time Series ─────────────────────────────────────────────────────────────
type Granularity = "day" | "week" | "month";

function dateBucket(date: Date, granularity: Granularity): string {
    if (granularity === "month") {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }
    if (granularity === "week") {
        const start = new Date(date);
        start.setDate(date.getDate() - date.getDay());
        return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function timeSeries(
    rows: Row[],
    dateCol: string,
    valueCol: string,
    granularity: Granularity = "month",
    from?: string,
    to?: string
): TimeSeriesPoint[] {
    const buckets = new Map<string, number>();

    for (const row of rows) {
        const history = row.history as Record<string, Record<string, string | number>> | undefined;
        const historyDates = history ? Object.keys(history).sort() : [];
        
        // Use history deltas only when there are multiple snapshots
        if (history && historyDates.length > 1) {
            for (let i = 0; i < historyDates.length; i++) {
                const dateStr = historyDates[i];
                if ((from && dateStr < from) || (to && dateStr > to)) continue;
                
                const parsedDate = new Date(dateStr);
                const bucket = dateBucket(parsedDate, granularity);
                
                const currentVal = Number(history[dateStr][valueCol]) || 0;
                const prevVal = i > 0 ? (Number(history[historyDates[i - 1]][valueCol]) || 0) : 0;
                const delta = currentVal - prevVal;
                
                buckets.set(bucket, (buckets.get(bucket) ?? 0) + delta);
            }
        } else {
            // Single snapshot or no history: bucket by date_published / dateCol
            // Use the latest snapshot value or the raw row value
            let val = 0;
            if (history && historyDates.length === 1) {
                val = Number(history[historyDates[0]][valueCol]) || 0;
            } else {
                val = typeof row[valueCol] === "number" ? (row[valueCol] as number) : (Number(row[valueCol]) || 0);
            }
            if (val === 0) continue;

            const rawDate = row[dateCol];
            if (!rawDate) continue;
            const parsedDate = parseFlexibleDate(rawDate);
            if (!parsedDate) continue;

            const dateStr = parsedDate.toISOString().split("T")[0];
            if ((from && dateStr < from) || (to && dateStr > to)) continue;

            const bucket = dateBucket(parsedDate, granularity);
            buckets.set(bucket, (buckets.get(bucket) ?? 0) + val);
        }
    }

    return Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value }));
}

// ─── Multi-series time series ─────────────────────────────────────────────
export function timeSeriesByCategory(
    rows: Row[],
    dateCol: string,
    valueCol: string,
    categoryCol: string,
    topNCount: number = 3,
    granularity: Granularity = "month",
    from?: string,
    to?: string
): { date: string; [key: string]: string | number }[] {
    // Find top N categories by total value (using existing deltas logic)
    const catMap = groupBy(rows, categoryCol);
    const catTotals = Array.from(catMap.entries())
        .map(([cat, catRows]) => ({ cat, total: sumColumn(catRows, valueCol) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, topNCount)
        .map((x) => x.cat);

    const buckets = new Map<string, Record<string, number>>();

    for (const row of rows) {
        const cat = String(row[categoryCol] ?? "Unknown");
        if (!catTotals.includes(cat)) continue;

        const history = row.history as Record<string, Record<string, string | number>> | undefined;
        const historyDates = history ? Object.keys(history).sort() : [];
        
        // Use history deltas only when there are multiple snapshots
        if (history && historyDates.length > 1) {
            for (let i = 0; i < historyDates.length; i++) {
                const dateStr = historyDates[i];
                if ((from && dateStr < from) || (to && dateStr > to)) continue;

                const parsedDate = new Date(dateStr);
                const bucket = dateBucket(parsedDate, granularity);
                
                if (!buckets.has(bucket)) buckets.set(bucket, {});
                const b = buckets.get(bucket)!;

                const currentVal = Number(history[dateStr][valueCol]) || 0;
                const prevVal = i > 0 ? (Number(history[historyDates[i - 1]][valueCol]) || 0) : 0;
                const delta = currentVal - prevVal;

                b[cat] = (b[cat] ?? 0) + delta;
            }
        } else {
            // Single snapshot or no history: bucket by date_published / dateCol
            let val = 0;
            if (history && historyDates.length === 1) {
                val = Number(history[historyDates[0]][valueCol]) || 0;
            } else {
                val = typeof row[valueCol] === "number" ? (row[valueCol] as number) : (Number(row[valueCol]) || 0);
            }
            if (val === 0) continue;

            const rawDate = row[dateCol];
            if (!rawDate) continue;
            const parsedDate = parseFlexibleDate(rawDate);
            if (!parsedDate) continue;

            const dateStr = parsedDate.toISOString().split("T")[0];
            if ((from && dateStr < from) || (to && dateStr > to)) continue;

            const bucket = dateBucket(parsedDate, granularity);
            if (!buckets.has(bucket)) buckets.set(bucket, {});
            const b = buckets.get(bucket)!;
            b[cat] = (b[cat] ?? 0) + val;
        }
    }

    return Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date, ...vals }));
}

// ─── Top N ───────────────────────────────────────────────────────────────────
export function topN(
    rows: Row[],
    groupCol: string,
    valueCol: string,
    n: number = 10,
    from?: string,
    to?: string
): BarDataPoint[] {
    const grouped = groupBy(rows, groupCol);
    return Array.from(grouped.entries())
        .map(([category, catRows]) => ({
            category,
            value: sumColumn(catRows, valueCol, from, to),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, n);
}

// ─── Pie breakdown ────────────────────────────────────────────────────────────
export function pieBreakdown(
    rows: Row[],
    categoryCol: string,
    valueCol: string,
    from?: string,
    to?: string
): PieDataPoint[] {
    const data = topN(rows, categoryCol, valueCol, 10, from, to);
    const total = data.reduce((s, d) => s + d.value, 0);
    return data.map((d) => ({
        name: d.category,
        value: d.value,
        percentage: total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0,
    }));
}

// ─── Outlier Detection (IQR) ──────────────────────────────────────────────────
export function detectOutliers(rows: Row[], col: string): OutlierResult[] {
    const vals = rows
        .map((r, i) => ({ row: r, value: r[col] as number, index: i }))
        .filter((x) => typeof x.value === "number" && isFinite(x.value))
        .sort((a, b) => a.value - b.value);

    if (vals.length < 4) return [];

    const q1 = vals[Math.floor(vals.length * 0.25)].value;
    const q3 = vals[Math.floor(vals.length * 0.75)].value;
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const mean = vals.reduce((s, v) => s + v.value, 0) / vals.length;
    const stddev = Math.sqrt(
        vals.reduce((s, v) => s + (v.value - mean) ** 2, 0) / vals.length
    );

    return vals
        .filter((v) => v.value < lower || v.value > upper)
        .map((v) => ({
            row: v.row,
            column: col,
            value: v.value,
            zScore: stddev > 0 ? Math.abs((v.value - mean) / stddev) : 0,
        }))
        .sort((a, b) => b.zScore - a.zScore)
        .slice(0, 5);
}

// ─── KPI Computation ─────────────────────────────────────────────────────────
export function computeKpis(filteredRows: Row[], schema: InferredSchema, allRows: Row[] = [], dateRange: { from: string; to: string } | null = null): KpiCard[] {
    const kpis: KpiCard[] = [];
    const { numericColumns, categoricalColumns, allColumns } = schema;
    const rows = filteredRows;
    const from = dateRange?.from;
    const to = dateRange?.to;

    // Helper: find a column (numeric first, then any) — comparisons are case-insensitive
    const findCol = (...patterns: ((lc: string) => boolean)[]): string | undefined => {
        for (const pred of patterns) {
            const found = numericColumns.find(c => pred(c.toLowerCase()))
                ?? allColumns.find(c => pred(c.toLowerCase()));
            if (found) return found;
        }
        return undefined;
    };

    // ── 1. Total Packages ──
    kpis.push({
        label: "Total Packages",
        value: (allRows.length > 0 ? allRows.length : rows.length).toLocaleString(),
        icon: "package",
    });

    // ── Column detection (case-insensitive, supports both snake_case and spaced names) ──
    const fbReachCol = findCol(
        c => c === "fb_reach" || c === "fb reach",
        c => c.startsWith("fb") && c.includes("reach"),
    );
    const igReachCol = findCol(
        c => c === "ig_reach" || c === "ig reach",
        c => c.startsWith("ig") && c.includes("reach"),
    );
    const reachCol = findCol(
        c => c === "total_reach" || c === "combined reach" || c === "combined_reach",
        c => (c.includes("total") || c.includes("combined")) && c.includes("reach"),
    );
    const spendCol = findCol(
        c => c === "ads_spend" || c === "spend $" || c === "ads spend",
        c => c.includes("spend"),
    );
    const clicksCol = findCol(
        c => c === "fb_total_clicks" || c === "fb total clicks",
        c => c === "fb_link_clicks" || c === "fb link clicks",
        c => c.includes("total") && c.includes("click"),
        c => c.includes("link") && c.includes("click"),
    );
    const reactionsCol = findCol(
        c => c === "total_reactions" || c === "total reactions",
        c => c.includes("total") && c.includes("reaction"),
        c => c.includes("combined") && c.includes("interact"),
        c => c.includes("reaction"),
    );
    const commentsCol = findCol(
        c => c === "total_comments" || c === "total comments",
        c => c.includes("total") && c.includes("comment"),
        c => c.includes("comment"),
    );
    const sharesCol = findCol(
        c => c === "total_shares" || c === "total shares",
        c => c.includes("total") && c.includes("share"),
        c => !c.includes("reaction") && !c.includes("comment") && c.includes("share"),
    );

    // ── 2. Combined Reach ──
    if (reachCol) {
        kpis.push({
            label: "Combined Reach",
            value: sumColumn(rows, reachCol, from, to).toLocaleString(),
            icon: "trending-up",
        });
    } else if (fbReachCol) {
        const total = sumColumn(rows, fbReachCol, from, to)
            + (igReachCol ? sumColumn(rows, igReachCol, from, to) : 0);
        kpis.push({
            label: "Combined Reach",
            value: total.toLocaleString(),
            icon: "trending-up",
        });
    }

    // ── 3. Facebook Reach ──
    if (fbReachCol) {
        kpis.push({
            label: "Facebook Reach",
            value: sumColumn(rows, fbReachCol, from, to).toLocaleString(),
            icon: "facebook",
        });
    }

    // ── 4. Instagram Reach ──
    if (igReachCol) {
        kpis.push({
            label: "Instagram Reach",
            value: sumColumn(rows, igReachCol, from, to).toLocaleString(),
            icon: "instagram",
        });
    }

    // ── 5. Total Engagement (reactions + comments + shares, or combined interactions) ──
    {
        const combinedInteractCol = findCol(
            c => c === "combined total interactions" || c === "combined_total_interactions",
            c => c.includes("combined") && c.includes("interact"),
        );
        const engCols = [reactionsCol, commentsCol, sharesCol].filter(Boolean) as string[];
        if (combinedInteractCol) {
            kpis.push({
                label: "Total Engagement",
                value: sumColumn(rows, combinedInteractCol, from, to).toLocaleString(),
                icon: "bar-chart-2",
            });
        } else if (engCols.length > 0) {
            const total = engCols.reduce((acc, col) => acc + sumColumn(rows, col, from, to), 0);
            kpis.push({
                label: "Total Engagement",
                value: total.toLocaleString(),
                icon: "bar-chart-2",
            });
        }
    }

    // ── 6. Total Clicks ──
    if (clicksCol) {
        kpis.push({
            label: "Link Clicks",
            value: sumColumn(rows, clicksCol, from, to).toLocaleString(),
            icon: "trending-up",
        });
    }

    // ── 7. Ad Spend ──
    if (spendCol) {
        kpis.push({
            label: "Ad Spend",
            value: sumColumn(rows, spendCol, from, to).toFixed(2),
            prefix: "$",
            icon: "dollar-sign",
        });
    }

    // ── 8. Top Destination ──
    const countryCol = [...categoricalColumns, ...allColumns].find(c => {
        const lc = c.toLowerCase();
        return lc === "country" || lc === "destination" || lc.includes("country") || lc.includes("destination");
    });
    const rankCol = reachCol ?? fbReachCol ?? igReachCol;
    if (countryCol && rankCol) {
        const grouped = groupBy(rows, countryCol);
        let topName = "";
        let topVal = 0;
        grouped.forEach((groupRows, name) => {
            const val = sumColumn(groupRows, rankCol, from, to);
            if (val > topVal) { topVal = val; topName = name; }
        });
        if (topName) {
            kpis.push({ label: "Top Destination", value: topName, icon: "map-pin" });
        }
    }

    return kpis.slice(0, 8);
}

// ─── Insights Generation ─────────────────────────────────────────────────────
export function generateInsights(
    rows: Row[],
    schema: InferredSchema
): InsightResult {
    const { numericColumns, categoricalColumns, dateColumns } = schema;

    const reachCol =
        numericColumns.find((c) => (c.includes("total") && c.includes("reach")) || c === "Combined Reach") ||
        numericColumns.find((c) => c.includes("reach") || c === "FB Reach" || c === "IG Reach" || c === "Ads Total Reach") ||
        numericColumns[0];

    const catCol =
        categoricalColumns.find((c) => c === "Destination" || c.includes("country") || c === "Package" || c === "package") ||
        categoricalColumns[0];

    const dateCol = dateColumns[0] ?? null;

    // Top category
    let topCategory: InsightResult["topCategory"] = null;
    if (catCol && reachCol) {
        const data = topN(rows, catCol, reachCol, 1);
        if (data[0]) {
            topCategory = {
                name: data[0].category,
                column: catCol,
                value: data[0].value,
            };
        }
    }

    // Top growth (month-over-month for top category)
    let topGrowth: InsightResult["topGrowth"] = null;
    if (dateCol && catCol && reachCol) {
        const grouped = groupBy(rows, catCol);
        let bestGrowth = -Infinity;
        let bestCat = "";
        grouped.forEach((catRows, cat) => {
            const ts = timeSeries(catRows, dateCol, reachCol, "month");
            if (ts.length >= 2) {
                const last = ts[ts.length - 1].value;
                const prev = ts[ts.length - 2].value;
                const growth = prev > 0 ? ((last - prev) / prev) * 100 : 0;
                if (growth > bestGrowth) {
                    bestGrowth = growth;
                    bestCat = cat;
                }
            }
        });
        if (bestCat) {
            topGrowth = {
                name: bestCat,
                column: catCol,
                growthRate: Math.round(bestGrowth * 10) / 10,
            };
        }
    }

    // Outliers on top numeric col
    const outliers = reachCol ? detectOutliers(rows, reachCol) : [];

    // Date range
    let dateRange: InsightResult["dateRange"] = null;
    if (dateCol) {
        const dates = rows
            .map((r) => parseFlexibleDate(String(r[dateCol] ?? "")))
            .filter(Boolean) as Date[];
        if (dates.length > 0) {
            dates.sort((a, b) => a.getTime() - b.getTime());
            dateRange = {
                from: dates[0].toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                }),
                to: dates[dates.length - 1].toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                }),
            };
        }
    }

    // Summary bullets
    const bullets: string[] = [];
    bullets.push(`Analysed ${rows.length} package post${rows.length !== 1 ? "s" : ""}.`);
    if (dateRange) {
        bullets.push(`Data spans ${dateRange.from} to ${dateRange.to}.`);
    }
    if (topCategory) {
        bullets.push(
            `${topCategory.name} achieved the highest reach with ${topCategory.value.toLocaleString()} total impressions.`
        );
    }
    if (topGrowth) {
        bullets.push(
            `${topGrowth.name} showed the strongest month-over-month growth at ${topGrowth.growthRate > 0 ? "+" : ""}${topGrowth.growthRate}%.`
        );
    }
    const spendCol = numericColumns.find((c) => c.includes("spend") || c === "Amount Spent (USD)");
    if (spendCol) {
        const totalSpend = sumColumn(rows, spendCol);
        const paidRows = rows.filter((r) => r[spendCol] !== null);
        bullets.push(
            `Total ad spend was $${totalSpend.toFixed(2)} across ${paidRows.length} paid campaign${paidRows.length !== 1 ? "s" : ""}.`
        );
    }
    const convCol = numericColumns.find((c) => c.includes("conversation") || c === "FB + IG Messaging Conversations Started");
    if (convCol && spendCol) {
        const totalConv = sumColumn(rows, convCol);
        const totalSpend = sumColumn(rows, spendCol);
        const cpa = totalConv > 0 ? totalSpend / totalConv : 0;
        bullets.push(
            `Total messaging conversations: ${totalConv.toLocaleString()} (avg cost per conversation: $${cpa.toFixed(2)}).`
        );
    }
    if (outliers.length > 0 && catCol) {
        const outRow = outliers[0].row;
        const label = outRow[catCol] ?? "Unknown";
        bullets.push(
            `Possible outlier detected: "${label}" with a reach of ${outliers[0].value.toLocaleString()} (z-score: ${outliers[0].zScore.toFixed(1)}).`
        );
    }

    return {
        topCategory,
        topGrowth,
        outliers,
        summaryBullets: bullets,
        totalRecords: rows.length,
        dateRange,
    };
}

// ─── Last Updated Computation ────────────────────────────────────────────────
export function getLatestUpdateDate(rows: Row[]): string | null {
    if (rows.length === 0) return null;
    let latest = 0;
    for (const row of rows) {
        if (row.updatedAt && typeof row.updatedAt === "string") {
            const time = new Date(row.updatedAt).getTime();
            if (time > latest && !isNaN(time)) latest = time;
        } else {
            // Fallback to published date if no updatedAt exists yet
            const pubDate = String(row["Date Published"] || row["date_published"] || "");
            if (pubDate) {
                let time = new Date(pubDate).getTime();
                if (isNaN(time)) {
                    // Try DD-MM-YYYY
                    const parts = pubDate.split("-");
                    if (parts.length === 3) {
                        time = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
                    }
                }
                if (time > latest && !isNaN(time)) latest = time;
            }
        }
    }

    // If absolutely no dates found, just say "Unknown"
    if (latest === 0) return "Unknown";

    const date = new Date(latest);
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}
