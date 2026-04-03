"use client";

import { useState, useMemo } from "react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Row, InferredSchema } from "@/lib/types";
import { timeSeries, groupBy } from "@/lib/aggregate";
import { TrendingUp, Medal } from "lucide-react";

interface TrendChartProps {
    rows: Row[];
    schema: InferredSchema;
    dateRange?: { from: string; to: string } | null;
}

const RANK_COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
const RANK_BADGES = ["🥇", "🥈", "🥉", "4", "5"];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-[#1a1a24] border border-slate-200 dark:border-white/10 rounded-xl p-3 shadow-xl text-sm">
            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
                    <span className="font-medium text-slate-800 dark:text-white">{p.value?.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
};

function sumCol(rows: Row[], col: string): number {
    return rows.reduce((s, r) => {
        const v = r[col];
        return s + (typeof v === "number" ? v : Number(v) || 0);
    }, 0);
}

export function TrendChart({ rows, schema, dateRange }: TrendChartProps) {
    const { numericColumns, dateColumns, allColumns } = schema;

    // Pick a sensible default metric (prefer combined/fb reach)
    const defaultMetric =
        numericColumns.find((c) => c.toLowerCase().includes("combined") && c.toLowerCase().includes("reach")) ||
        numericColumns.find((c) => c.toLowerCase() === "fb reach") ||
        numericColumns.find((c) => c.toLowerCase().includes("reach")) ||
        numericColumns[0] ||
        "";

    const [selectedMetric, setSelectedMetric] = useState(defaultMetric);

    // Build top-5 leaderboard for the selected metric
    const pkgCol = allColumns.find(c =>
        c.toLowerCase() === "package" || c.toLowerCase().includes("package")
    ) ?? "";

    const top5 = useMemo(() => {
        if (!pkgCol || !selectedMetric) return [];
        const grouped = groupBy(rows, pkgCol);
        const entries: { name: string; value: number }[] = [];
        grouped.forEach((pkgRows, name) => {
            const val = sumCol(pkgRows, selectedMetric);
            if (val > 0) entries.push({ name, value: val });
        });
        return entries.sort((a, b) => b.value - a.value).slice(0, 5);
    }, [rows, pkgCol, selectedMetric]);

    const maxVal = top5[0]?.value ?? 1;

    const hasChartData = dateColumns.length > 0 && numericColumns.length > 0;
    const trendData = hasChartData
        ? timeSeries(rows, dateColumns[0], selectedMetric, "month", dateRange?.from, dateRange?.to)
        : [];

    const metricLabel = selectedMetric.replace(/_/g, " ");

    // Metric selector options — filter to only meaningful ones
    const metricOptions = numericColumns.filter(c => {
        const lc = c.toLowerCase();
        return lc.includes("reach") || lc.includes("react") || lc.includes("click")
            || lc.includes("engagement") || lc.includes("interact") || lc.includes("share")
            || lc.includes("comment") || lc.includes("spend") || lc.includes("impression");
    });
    const allMetricOptions = metricOptions.length > 0 ? metricOptions : numericColumns;

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* ── Area Chart ─────────────────────────────────────────── */}
            <Card className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f0f1e] shadow-sm">
                <CardHeader className="px-6 pt-5 pb-0 flex flex-row items-center justify-between gap-4 flex-wrap">
                    <div>
                        <CardTitle className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-violet-400" />
                            Trend Over Time
                        </CardTitle>
                        <p className="text-xs text-slate-400 mt-0.5">Monthly progression · <span className="text-violet-400">{metricLabel}</span></p>
                    </div>
                    <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                        <SelectTrigger className="w-48 h-8 text-xs rounded-lg bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {allMetricOptions.map((col) => (
                                <SelectItem key={col} value={col} className="text-xs">
                                    {col.replace(/_/g, " ")}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent className="px-2 pt-4 pb-4">
                    {trendData.length === 0 ? (
                        <div className="flex items-center justify-center h-56">
                            <p className="text-slate-400 text-sm">No trend data available for selected metric.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                                    width={42}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(139,92,246,0.3)", strokeWidth: 1, strokeDasharray: "4 2" }} />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    name={metricLabel}
                                    stroke="#8b5cf6"
                                    strokeWidth={2.5}
                                    fill="url(#trendGradient)"
                                    dot={false}
                                    activeDot={{ r: 5, fill: "#8b5cf6", stroke: "#c4b5fd", strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* ── Top 5 Leaderboard ──────────────────────────────────── */}
            <Card className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f0f1e] shadow-sm">
                <CardHeader className="px-5 pt-5 pb-0">
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <Medal className="w-4 h-4 text-amber-400" />
                        Top 5 Packages
                    </CardTitle>
                    <p className="text-xs text-slate-400 mt-0.5">by <span className="text-violet-400">{metricLabel}</span></p>
                </CardHeader>
                <CardContent className="px-5 pt-4 pb-5">
                    {top5.length === 0 ? (
                        <div className="flex items-center justify-center h-48">
                            <p className="text-slate-400 text-sm text-center">No package data available.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {top5.map((item, i) => {
                                const pct = Math.round((item.value / maxVal) * 100);
                                const color = RANK_COLORS[i];
                                const badge = RANK_BADGES[i];
                                const isNum = i >= 3;
                                return (
                                    <div key={item.name} className="group">
                                        <div className="flex items-center gap-3 mb-1.5">
                                            {/* Rank badge */}
                                            <div
                                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                                                style={{ background: `${color}22`, color }}
                                            >
                                                {isNum ? badge : <span>{badge}</span>}
                                            </div>
                                            {/* Name + value */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate leading-tight">
                                                    {item.name}
                                                </p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    {item.value.toLocaleString()}
                                                </p>
                                            </div>
                                            {/* Percent */}
                                            <span className="text-[11px] font-semibold flex-shrink-0" style={{ color }}>
                                                {pct}%
                                            </span>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/6 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%`, background: color }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
