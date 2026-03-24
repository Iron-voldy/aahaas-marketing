"use client";

import { X, BarChart2 } from "lucide-react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";
import type { Row } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmt(v: unknown): string {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (!isFinite(n)) return String(v);
    return n.toLocaleString();
}

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

const DESTINATION_THEMES: Record<string, { gradient: string; emoji: string }> = {
    singapore: { gradient: "from-[#667eea] to-[#764ba2]", emoji: "🦁" },
    malaysia: { gradient: "from-[#11998e] to-[#38ef7d]", emoji: "🏙️" },
    maldives: { gradient: "from-[#2af598] to-[#009efd]", emoji: "🏝️" },
    kerala: { gradient: "from-[#f7971e] to-[#ffd200]", emoji: "🌴" },
    langkawi: { gradient: "from-[#0575e6] to-[#021b79]", emoji: "⛵" },
};

function getTheme(country: string) {
    const key = country.toLowerCase();
    for (const [k, v] of Object.entries(DESTINATION_THEMES)) {
        if (key.includes(k)) return { ...v, key: k };
    }
    return { gradient: "from-[#8b5cf6] to-[#4c1d95]", emoji: "✈️", key: "default" };
}

interface PackageComparisonPanelProps {
    rows: Row[];
    onRemove: (index: number) => void;
    onClear: () => void;
}

export function PackageComparisonPanel({
    rows,
    onRemove,
    onClear,
}: PackageComparisonPanelProps) {
    if (rows.length === 0) return null;

    const keys = rows[0] ? Object.keys(rows[0]) : [];
    const g = (r: Row, prefix: string, word: string) =>
        Object.keys(r).find((k) => k.startsWith(prefix) && k.includes(word));

    // Build multi-series chart data for key metrics
    const metrics = [
        { key: "fbReach", label: "FB Reach", icon: "fb" },
        { key: "igReach", label: "IG Reach", icon: "ig" },
        { key: "totalReach", label: "Total Reach", icon: "total" },
        { key: "fbReact", label: "FB Reactions", icon: "fb" },
        { key: "fbClicks", label: "FB Clicks", icon: "fb" },
        { key: "conversations", label: "Conversations", icon: "ads" },
        { key: "adSpend", label: "Ad Spend ($)", icon: "ads" },
    ];

    // Extract values per row per metric
    function getVal(row: Row, metricKey: string): number {
        const allKeys = Object.keys(row);
        switch (metricKey) {
            case "fbReach":
                return Number(row[allKeys.find(k => (k.startsWith("fb_") && k.includes("reach")) || k === "FB Reach") ?? ""] ?? 0);
            case "igReach":
                return Number(row[allKeys.find(k => (k.startsWith("ig_") && k.includes("reach")) || k === "IG Reach") ?? ""] ?? 0);
            case "totalReach":
                return Number(row[allKeys.find(k => (k.includes("total") && k.includes("reach")) || k === "Combined Reach") ?? ""] ?? 0);
            case "fbReact":
                return Number(row[allKeys.find(k => (k.startsWith("fb_") && k.includes("react")) || k === "FB Interactions (Reactions)") ?? ""] ?? 0);
            case "fbClicks":
                return Number(row[allKeys.find(k => (k.startsWith("fb_") && k.includes("click") && !k.includes("link")) || k === "FB Total Clicks") ?? ""] ?? 0);
            case "conversations":
                return Number(row[allKeys.find(k => k.includes("conversation") || k === "FB + IG Messaging Conversations Started") ?? ""] ?? 0);
            case "adSpend":
                return Number(row[allKeys.find(k => k.includes("spend") || k === "Amount Spent (USD)") ?? ""] ?? 0);
            default:
                return 0;
        }
    }

    // Chart data: one entry per metric, values for each selected package
    const chartData = metrics.map((m) => {
        const entry: Record<string, string | number> = { metric: m.label };
        rows.forEach((row, i) => {
            const countryField = row["Package"] || row["Country"] || row["country"];
            const country = String(countryField ?? `Pkg ${i + 1}`);
            const date = String(row["date_published"] ?? row["Date Published"] ?? "").split(",")[0];
            entry[`${country} (${date})`] = getVal(row, m.key);
        });
        return entry;
    }).filter((entry) => {
        // Only show metrics where at least one package has a non-zero value
        return rows.some((_, i) => {
            const countryField = rows[i]["Package"] || rows[i]["Country"] || rows[i]["country"] || rows[i]["package"];
            const lbl = `${String(countryField ?? `Pkg ${i + 1}`)} (${String(rows[i]["date_published"] ?? rows[i]["Date Published"] ?? "").split(",")[0]})`;
            return Number(entry[lbl]) > 0;
        });
    });

    const seriesKeys = rows.map((row, i) => {
        const countryField = row["Package"] || row["Country"] || row["country"];
        const country = String(countryField ?? `Pkg ${i + 1}`);
        const date = String(row["date_published"] ?? row["Date Published"] ?? "").split(",")[0];
        return `${country} (${date})`;
    });

    return (
        <div className="bg-white dark:bg-[#111118] border border-violet-200 dark:border-violet-500/20 rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/5 bg-violet-50 dark:bg-violet-500/10">
                <div className="flex items-center gap-2.5">
                    <BarChart2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <h3 className="font-semibold text-slate-800 dark:text-white text-sm">
                        Comparing {rows.length} Package{rows.length > 1 ? "s" : ""}
                    </h3>
                    <Badge className="bg-violet-600 text-white border-0 rounded-full text-[10px] px-2">
                        {rows.length}/4
                    </Badge>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="text-xs text-slate-400 hover:text-rose-500 h-7 px-2"
                >
                    Clear all
                </Button>
            </div>

            {/* Selected package chips */}
            <div className="flex gap-2 flex-wrap px-5 py-3 border-b border-slate-100 dark:border-white/5">
                {rows.map((row, i) => {
                    const countryField = row["Package"] || row["Country"] || row["country"];
                    const country = String(countryField ?? `Pkg ${i + 1}`);
                    const theme = getTheme(country);
                    return (
                        <div
                            key={i}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white"
                            style={{ background: COLORS[i % COLORS.length] }}
                        >
                            <span>{theme.emoji}</span>
                            <span>{country}</span>
                            <button
                                onClick={() => onRemove(i)}
                                className="ml-0.5 hover:opacity-70"
                                aria-label="Remove from comparison"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Stat table comparison */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
                            <th className="px-5 py-2.5 text-left text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide w-36">
                                Metric
                            </th>
                            {rows.map((row, i) => {
                                const countryField = row["Package"] || row["Country"] || row["country"];
                                const country = String(countryField ?? `Pkg ${i + 1}`);
                                const theme = getTheme(country);
                                return (
                                    <th key={i} className="px-4 py-2.5 text-left">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ background: COLORS[i % COLORS.length] }}
                                            />
                                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
                                                {theme.emoji} {country}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 ml-3.5 mt-0.5 font-normal">
                                            {String(row["date_published"] ?? row["Date Published"] ?? "").split(",")[0]}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            {
                                label: "Platform",
                                icon: null,
                                getValue: () => <div className="flex gap-1"><FacebookLogo className="w-3.5 h-3.5" /><InstagramLogo className="w-3.5 h-3.5" /></div>,
                                isHeader: true,
                            },
                            { label: "FB Reach", fn: (r: Row) => fmt(r[Object.keys(r).find(k => (k.startsWith("fb_") && k.includes("reach")) || k === "FB Reach") ?? ""] ?? null) },
                            { label: "IG Reach", fn: (r: Row) => fmt(r[Object.keys(r).find(k => (k.startsWith("ig_") && k.includes("reach")) || k === "IG Reach") ?? ""] ?? null) },
                            { label: "Total Reach", fn: (r: Row) => fmt(r[Object.keys(r).find(k => (k.includes("total") && k.includes("reach")) || k === "Combined Reach") ?? ""] ?? null), highlight: true },
                            { label: "FB Reactions", fn: (r: Row) => fmt(r[Object.keys(r).find(k => (k.startsWith("fb_") && k.includes("react")) || k === "FB Interactions (Reactions)") ?? ""] ?? null) },
                            { label: "IG Reactions", fn: (r: Row) => fmt(r[Object.keys(r).find(k => (k.startsWith("ig_") && k.includes("react")) || k === "IG Interactions (Reactions)") ?? ""] ?? null) },
                            { label: "FB Shares", fn: (r: Row) => fmt(r[Object.keys(r).find(k => (k.startsWith("fb_") && k.includes("share")) || k === "FB Interactions (Shares)") ?? ""] ?? null) },
                            { label: "IG Shares", fn: (r: Row) => fmt(r[Object.keys(r).find(k => (k.startsWith("ig_") && k.includes("share")) || k === "IG Interactions (Shares)") ?? ""] ?? null) },
                            { label: "FB Total Clicks", fn: (r: Row) => fmt(r[Object.keys(r).find(k => (k.startsWith("fb_") && k.includes("click") && !k.includes("link")) || k === "FB Total Clicks") ?? ""] ?? null) },
                            { label: "Conversations", fn: (r: Row) => fmt(r[Object.keys(r).find(k => k.includes("conversation") || k === "FB + IG Messaging Conversations Started") ?? ""] ?? null) },
                            { label: "Ad Spend ($)", fn: (r: Row) => { const k = Object.keys(r).find(k => k.includes("spend") || k === "Amount Spent (USD)"); return k && r[k] !== null ? `$${Number(r[k]).toFixed(2)}` : "—"; }, highlight: true },
                            { label: "CPR ($)", fn: (r: Row) => { const k = Object.keys(r).find(k => k.includes("cpr") || k === "CPR (Cost Per Result)"); return k && r[k] !== null ? `$${Number(r[k]).toFixed(2)}` : "—"; } },
                        ].map((rowDef, ri) => {
                            const values = rows.map(r => rowDef.fn ? rowDef.fn(r) : "");
                            // Find best value index (highest number)
                            const nums = values.map(v => parseFloat(String(v).replace(/[^0-9.-]/g, "")));
                            const maxNum = Math.max(...nums.filter(isFinite));
                            return (
                                <tr
                                    key={ri}
                                    className={cn(
                                        "border-b border-slate-50 dark:border-white/[0.03]",
                                        ri % 2 === 0 ? "" : "bg-slate-50/40 dark:bg-white/[0.01]"
                                    )}
                                >
                                    <td className="px-5 py-2 text-slate-500 dark:text-slate-400 font-medium">
                                        {rowDef.label}
                                    </td>
                                    {values.map((val, i) => {
                                        const num = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
                                        const isBest = isFinite(maxNum) && maxNum > 0 && num === maxNum;
                                        return (
                                            <td key={i} className="px-4 py-2">
                                                <span
                                                    className={cn(
                                                        "font-semibold",
                                                        isBest
                                                            ? "text-emerald-600 dark:text-emerald-400"
                                                            : "text-slate-700 dark:text-slate-200",
                                                        rowDef.highlight ? "text-sm" : "text-xs"
                                                    )}
                                                >
                                                    {val}
                                                    {isBest && rows.length > 1 && (
                                                        <span className="ml-1 text-[9px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1 rounded-full">
                                                            best
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Comparison Bar Chart */}
            {rows.length > 1 && chartData.length > 0 && (
                <div className="px-5 pt-4 pb-5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Visual Comparison
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                            <XAxis dataKey="metric" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={36}
                                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "rgba(17,17,24,0.95)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: "10px",
                                    fontSize: "11px",
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: "10px" }} />
                            {seriesKeys.map((key, i) => (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    fill={COLORS[i % COLORS.length]}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={28}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
