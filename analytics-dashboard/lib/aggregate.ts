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

// ─── Sum a numeric column over an array of rows ───────────────────────────
export function sumColumn(rows: Row[], col: string): number {
    return rows.reduce((acc, r) => {
        const v = r[col];
        return acc + (typeof v === "number" && isFinite(v) ? v : 0);
    }, 0);
}

export function avgColumn(rows: Row[], col: string): number {
    const vals = rows
        .map((r) => r[col])
        .filter((v) => typeof v === "number" && isFinite(v as number)) as number[];
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
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
    granularity: Granularity = "month"
): TimeSeriesPoint[] {
    const buckets = new Map<string, number>();
    for (const row of rows) {
        const rawDate = row[dateCol];
        if (!rawDate) continue;
        const parsedDate = parseFlexibleDate(String(rawDate));
        if (!parsedDate) continue;
        const bucket = dateBucket(parsedDate, granularity);
        const val = typeof row[valueCol] === "number" ? (row[valueCol] as number) : 0;
        buckets.set(bucket, (buckets.get(bucket) ?? 0) + val);
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
    topN: number = 3,
    granularity: Granularity = "month"
): { date: string;[key: string]: string | number }[] {
    // Find top N categories by total value
    const catMap = groupBy(rows, categoryCol);
    const catTotals = Array.from(catMap.entries())
        .map(([cat, catRows]) => ({ cat, total: sumColumn(catRows, valueCol) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, topN)
        .map((x) => x.cat);

    const buckets = new Map<string, Record<string, number>>();

    for (const row of rows) {
        const cat = String(row[categoryCol] ?? "Unknown");
        if (!catTotals.includes(cat)) continue;
        const rawDate = row[dateCol];
        if (!rawDate) continue;
        const parsedDate = parseFlexibleDate(String(rawDate));
        if (!parsedDate) continue;
        const bucket = dateBucket(parsedDate, granularity);
        if (!buckets.has(bucket)) buckets.set(bucket, {});
        const b = buckets.get(bucket)!;
        const val = typeof row[valueCol] === "number" ? (row[valueCol] as number) : 0;
        b[cat] = (b[cat] ?? 0) + val;
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
    n: number = 10
): BarDataPoint[] {
    const grouped = groupBy(rows, groupCol);
    return Array.from(grouped.entries())
        .map(([category, catRows]) => ({
            category,
            value: sumColumn(catRows, valueCol),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, n);
}

// ─── Pie breakdown ────────────────────────────────────────────────────────────
export function pieBreakdown(
    rows: Row[],
    categoryCol: string,
    valueCol: string
): PieDataPoint[] {
    const data = topN(rows, categoryCol, valueCol, 10);
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
export function computeKpis(filteredRows: Row[], schema: InferredSchema, allRows: Row[] = []): KpiCard[] {
    const kpis: KpiCard[] = [];
    const { numericColumns, categoricalColumns } = schema;

    kpis.push({
        label: "Total Packages",
        value: (allRows.length > 0 ? allRows.length : filteredRows.length).toLocaleString(),
        icon: "package",
    });

    kpis.push({
        label: "Packages Published",
        value: filteredRows.length.toLocaleString(),
        icon: "trending-up",
    });

    const rows = filteredRows;

    // Find reach-related columns (total reach first)
    const reachCol = numericColumns.find((c) => (c.includes("total") && c.includes("reach")) || c === "Combined Reach");
    const fbReachCol = numericColumns.find((c) => (c.startsWith("fb_") && c.includes("reach")) || c === "FB Reach");
    const igReachCol = numericColumns.find((c) => (c.startsWith("ig_") && c.includes("reach")) || c === "IG Reach");
    const spendCol = numericColumns.find((c) => c.includes("spend") || c === "Amount Spent (USD)");
    const convCol = numericColumns.find((c) => c.includes("conversation") || c === "FB + IG Messaging Conversations Started");
    const clicksCol = numericColumns.find((c) => c.includes("total_clicks") || (c.includes("fb") && c.includes("click")) || c === "FB Total Clicks");

    if (reachCol) {
        kpis.push({
            label: "Total Combined Reach",
            value: sumColumn(rows, reachCol).toLocaleString(),
            icon: "trending-up",
            prefix: "",
        });
    } else if (fbReachCol && igReachCol) {
        const totalReach = sumColumn(rows, fbReachCol) + sumColumn(rows, igReachCol);
        kpis.push({
            label: "Total Combined Reach",
            value: totalReach.toLocaleString(),
            icon: "trending-up",
        });
    }

    if (fbReachCol) {
        kpis.push({
            label: "Facebook Reach",
            value: sumColumn(rows, fbReachCol).toLocaleString(),
            icon: "facebook",
        });
    }

    if (igReachCol) {
        kpis.push({
            label: "Instagram Reach",
            value: sumColumn(rows, igReachCol).toLocaleString(),
            icon: "instagram",
        });
    }

    if (spendCol) {
        kpis.push({
            label: "Total Ad Spend",
            value: sumColumn(rows, spendCol).toFixed(2),
            prefix: "$",
            icon: "dollar-sign",
        });
    }

    if (convCol) {
        kpis.push({
            label: "Ad Conversations",
            value: sumColumn(rows, convCol).toLocaleString(),
            icon: "message-circle",
        });
    }

    // Top destination by total reach
    const countryCol = categoricalColumns.find((c) => c === "Destination" || c.includes("country") || c === "Package" || c === "package");
    if (countryCol && reachCol) {
        const grouped = groupBy(rows, countryCol);
        let topCountry = "";
        let topVal = 0;
        grouped.forEach((groupRows, country) => {
            const val = sumColumn(groupRows, reachCol);
            if (val > topVal) {
                topVal = val;
                topCountry = country;
            }
        });
        if (topCountry) {
            kpis.push({
                label: "Top Destination",
                value: topCountry,
                icon: "map-pin",
            });
        }
    }

    // Avg CPR if available
    const cprCol = numericColumns.find((c) => c.includes("cpr") || c === "CPR (Cost Per Result)");
    if (cprCol) {
        const paidRows = rows.filter((r) => r[cprCol] !== null && r[cprCol] !== undefined);
        if (paidRows.length > 0) {
            kpis.push({
                label: "Avg CPR",
                value: avgColumn(paidRows, cprCol).toFixed(2),
                prefix: "$",
                icon: "target",
            });
        }
    }

    return kpis.slice(0, 6);
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
