"use client";

import { useMemo } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Row, InferredSchema } from "@/lib/types";
import { groupBy } from "@/lib/aggregate";

interface Props {
    rows: Row[];
    schema: InferredSchema;
    dateRange?: { from: string; to: string } | null;
}

const COLORS = [
    "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6",
    "#4c1d95", "#6366f1", "#4f46e5", "#4338ca",
    "#3730a3", "#312e81",
];

function sumCol(rows: Row[], col: string): number {
    return rows.reduce((s, r) => {
        const v = r[col];
        return s + (typeof v === "number" ? v : Number(v) || 0);
    }, 0);
}

const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-white dark:bg-[#1a1a24] border border-slate-200 dark:border-white/10 rounded-xl p-3 shadow-xl text-sm">
            <p className="font-semibold text-slate-800 dark:text-white mb-1">{d.fullName || d.category}</p>
            <p className="text-slate-500 dark:text-slate-400">
                Reach: <span className="font-semibold text-slate-800 dark:text-white">{payload[0].value?.toLocaleString()}</span>
            </p>
        </div>
    );
};

/** Top packages ranked by total combined reach */
export function TopPackagesChart({ rows, schema, dateRange }: Props) {
    const { allColumns } = schema;

    const pkgCol = allColumns.find(c =>
        c.toLowerCase() === "package" || c.toLowerCase().includes("package")
    ) ?? "";
    const reachCol = allColumns.find(c => {
        const lc = c.toLowerCase();
        return lc === "total_reach" || lc === "combined reach" || lc === "combined_reach";
    }) ?? allColumns.find(c => {
        const lc = c.toLowerCase();
        return (lc.includes("total") || lc.includes("combined")) && lc.includes("reach");
    }) ?? allColumns.find(c => {
        const lc = c.toLowerCase();
        return lc.startsWith("fb") && lc.includes("reach");
    }) ?? allColumns.find(c => c.toLowerCase().includes("reach")) ?? "";

    const data = useMemo(() => {
        if (!pkgCol || !reachCol) return [];
        const grouped = groupBy(rows, pkgCol);
        const entries: { category: string; fullName: string; value: number }[] = [];
        grouped.forEach((pkgRows, name) => {
            const val = sumCol(pkgRows, reachCol);
            if (val > 0) entries.push({
                category: name.length > 20 ? name.slice(0, 19) + "…" : name,
                fullName: name,
                value: val,
            });
        });
        return entries.sort((a, b) => b.value - a.value).slice(0, 10);
    }, [rows, pkgCol, reachCol]);

    if (data.length === 0) {
        return (
            <Card className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f0f1e]">
                <CardContent className="p-6 flex items-center justify-center h-64">
                    <p className="text-slate-400 text-sm">No package reach data available.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f0f1e] shadow-sm">
            <CardHeader className="px-6 pt-5 pb-0">
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">
                    Top Packages by Reach
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">Best performing packages ranked by total reach</p>
            </CardHeader>
            <CardContent className="px-2 pt-4 pb-2">
                <ResponsiveContainer width="100%" height={Math.max(240, data.length * 36 + 20)}>
                    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" horizontal={false} />
                        <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        />
                        <YAxis
                            type="category"
                            dataKey="category"
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            tickLine={false}
                            axisLine={false}
                            width={110}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(139,92,246,0.06)" }} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                            {data.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

/** Top destinations ranked by total combined reach */
export function TopDestinationsChart({ rows, schema, dateRange }: Props) {
    const { allColumns } = schema;

    const countryCol = allColumns.find(c => {
        const lc = c.toLowerCase();
        return lc === "country" || lc === "destination" || lc.includes("country") || lc.includes("destination");
    }) ?? "";
    const reachCol = allColumns.find(c => {
        const lc = c.toLowerCase();
        return lc === "total_reach" || lc === "combined reach" || lc === "combined_reach";
    }) ?? allColumns.find(c => {
        const lc = c.toLowerCase();
        return (lc.includes("total") || lc.includes("combined")) && lc.includes("reach");
    }) ?? allColumns.find(c => {
        const lc = c.toLowerCase();
        return lc.startsWith("fb") && lc.includes("reach");
    }) ?? allColumns.find(c => c.toLowerCase().includes("reach")) ?? "";

    const DEST_COLORS = [
        "#06b6d4", "#0891b2", "#0e7490", "#155e75",
        "#164e63", "#10b981", "#059669", "#047857",
        "#065f46", "#064e3b",
    ];

    const data = useMemo(() => {
        if (!countryCol || !reachCol) return [];
        const grouped = groupBy(rows, countryCol);
        const entries: { category: string; fullName: string; value: number }[] = [];
        grouped.forEach((destRows, name) => {
            const val = sumCol(destRows, reachCol);
            if (val > 0 && name && name !== "Unknown") entries.push({
                category: name.length > 20 ? name.slice(0, 19) + "…" : name,
                fullName: name,
                value: val,
            });
        });
        return entries.sort((a, b) => b.value - a.value).slice(0, 10);
    }, [rows, countryCol, reachCol]);

    if (data.length === 0) {
        return (
            <Card className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f0f1e]">
                <CardContent className="p-6 flex items-center justify-center h-64">
                    <p className="text-slate-400 text-sm">No destination reach data available.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f0f1e] shadow-sm">
            <CardHeader className="px-6 pt-5 pb-0">
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">
                    Top Destinations by Reach
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">Best performing destinations ranked by total reach</p>
            </CardHeader>
            <CardContent className="px-2 pt-4 pb-2">
                <ResponsiveContainer width="100%" height={Math.max(240, data.length * 36 + 20)}>
                    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" horizontal={false} />
                        <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        />
                        <YAxis
                            type="category"
                            dataKey="category"
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            tickLine={false}
                            axisLine={false}
                            width={110}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(6,182,212,0.06)" }} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                            {data.map((_, i) => (
                                <Cell key={i} fill={DEST_COLORS[i % DEST_COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
