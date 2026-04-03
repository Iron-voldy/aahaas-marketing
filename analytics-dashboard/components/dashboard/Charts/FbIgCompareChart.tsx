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
    Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";
import type { Row, InferredSchema } from "@/lib/types";
import { groupBy } from "@/lib/aggregate";

interface Props {
    rows: Row[];
    schema: InferredSchema;
    dateRange?: { from: string; to: string } | null;
}

function sumCol(rows: Row[], col: string): number {
    return rows.reduce((acc, r) => {
        const v = r[col];
        return acc + (typeof v === "number" ? v : Number(v) || 0);
    }, 0);
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-[#1a1a24] border border-slate-200 dark:border-white/10 rounded-xl p-3 shadow-xl text-sm min-w-[160px]">
            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2 truncate max-w-[200px]">{label}</p>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="flex items-center justify-between gap-4 mt-1">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
                        <span className="text-slate-500 dark:text-slate-400 text-xs">{p.name}:</span>
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-white text-xs">{p.value?.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
};

const CustomLegend = ({ payload }: any) => (
    <div className="flex items-center justify-center gap-6 mt-1">
        {payload?.map((entry: any, i: number) => (
            <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: entry.color }} />
                <span className="text-xs text-slate-500 dark:text-slate-400">{entry.value}</span>
            </div>
        ))}
    </div>
);

export function FbIgCompareChart({ rows, schema }: Props) {
    const { allColumns, categoricalColumns, highCardinalityColumns } = schema;

    // Case-insensitive column lookup helper
    const findAnyCol = (...names: string[]): string | undefined =>
        allColumns.find(c => names.some(n => c.toLowerCase() === n.toLowerCase()))
        ?? allColumns.find(c => names.some(n => c.toLowerCase().includes(n.toLowerCase())));

    // Package column — capital or lowercase
    const pkgCol = [...categoricalColumns, ...(highCardinalityColumns ?? [])]
        .find(c => c.toLowerCase() === "package" || c.toLowerCase().includes("package")) ?? "";

    // FB engagement columns — support both snake_case and spaced names
    const FB_NAMES = [
        ["fb_reactions", "fb reactions", "fb interactions (reactions)"],
        ["fb_comments", "fb comments", "fb interactions (comments)"],
        ["fb_shares", "fb shares", "fb interactions (shares)"],
        ["fb_saves", "fb saves", "fb interactions (saves)"],
    ];
    const IG_NAMES = [
        ["ig_reactions", "ig reactions", "ig interactions (reactions)"],
        ["ig_comments", "ig comments", "ig interactions (comments)"],
        ["ig_shares", "ig shares", "ig interactions (shares)"],
        ["ig_saves", "ig saves", "ig interactions (saves)"],
    ];

    const fbCols = FB_NAMES.map(names => findAnyCol(...names)).filter(Boolean) as string[];
    const igCols = IG_NAMES.map(names => findAnyCol(...names)).filter(Boolean) as string[];

    // Fallback: use "Combined Total Interactions" if no individual cols found
    const combinedCol = fbCols.length === 0 && igCols.length === 0
        ? findAnyCol("combined total interactions", "total interactions", "combined_total_interactions")
        : undefined;

    const hasData = pkgCol && (fbCols.length > 0 || igCols.length > 0 || combinedCol);
    const showBoth = fbCols.length > 0 && igCols.length > 0;

    const data = useMemo(() => {
        if (!hasData) return [];

        const grouped = groupBy(rows, pkgCol);
        const entries: { package: string; fb: number; ig: number }[] = [];

        grouped.forEach((pkgRows, name) => {
            const fb = combinedCol
                ? sumCol(pkgRows, combinedCol)
                : fbCols.reduce((s, c) => s + sumCol(pkgRows, c), 0);
            const ig = igCols.reduce((s, c) => s + sumCol(pkgRows, c), 0);
            if (fb > 0 || ig > 0) entries.push({ package: name, fb, ig });
        });

        return entries
            .sort((a, b) => (b.fb + b.ig) - (a.fb + a.ig))
            .slice(0, 10)
            .map(e => ({
                name: e.package.length > 22 ? e.package.slice(0, 21) + "…" : e.package,
                fullName: e.package,
                "Facebook": e.fb,
                ...(showBoth ? { "Instagram": e.ig } : {}),
            }));
    }, [rows, pkgCol, fbCols.join(), igCols.join(), combinedCol, hasData]);

    if (data.length === 0) {
        return (
            <Card className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f0f1e]">
                <CardContent className="p-6 flex items-center justify-center h-64">
                    <p className="text-slate-400 text-sm">No engagement data available.</p>
                </CardContent>
            </Card>
        );
    }

    const chartHeight = Math.max(280, data.length * 44 + 60);

    return (
        <Card className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f0f1e] shadow-sm">
            <CardHeader className="px-6 pt-5 pb-0">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">
                            Engagement per Package
                        </CardTitle>
                        <p className="text-xs text-slate-400 mt-0.5">Reactions, comments, shares & saves per package</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1877F2]/10 border border-[#1877F2]/20">
                            <FacebookLogo className="w-3 h-3" />
                            <span className="text-[11px] text-[#1877F2] font-medium">Facebook</span>
                        </div>
                        {showBoth && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20">
                                <InstagramLogo className="w-3 h-3" />
                                <span className="text-[11px] text-pink-500 font-medium">Instagram</span>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-2 pt-4 pb-4">
                <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
                        barCategoryGap="24%"
                        barGap={3}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" horizontal={false} />
                        <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        />
                        <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                            width={130}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(139,92,246,0.05)" }} />
                        <Legend content={<CustomLegend />} />
                        <Bar dataKey="Facebook" fill="#1877F2" radius={[0, 4, 4, 0]} barSize={showBoth ? 12 : 18} />
                        {showBoth && <Bar dataKey="Instagram" fill="#e1306c" radius={[0, 4, 4, 0]} barSize={12} />}
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
