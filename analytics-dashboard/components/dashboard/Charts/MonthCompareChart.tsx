"use client";

import { useMemo, useState } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Row, InferredSchema } from "@/lib/types";
import { parseFlexibleDate } from "@/lib/inferSchema";

const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Build a map of yyyy-MM label → { metric totals } from rows */
function buildMonthlyTotals(rows: Row[], dateCol: string) {
    const map = new Map<string, number>();

    for (const row of rows) {
        const d = parseFlexibleDate(row[dateCol]);
        if (!d) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        map.set(key, (map.get(key) ?? 0) + 1); // just count for bucket detection
    }
    return [...map.keys()].sort().reverse(); // newest first
}

function sumForMonth(rows: Row[], dateCol: string, monthKey: string, metricCol: string): number {
    let total = 0;
    for (const row of rows) {
        const d = parseFlexibleDate(row[dateCol]);
        if (!d) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key !== monthKey) continue;
        total += Number(row[metricCol]) || 0;
    }
    return total;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-[#1a1a24] border border-slate-200 dark:border-white/10 rounded-xl p-3 shadow-xl text-sm">
            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
                    <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
                    <span className="font-medium text-slate-800 dark:text-white">{p.value?.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
};

function formatMonthLabel(key: string): string {
    const [y, m] = key.split("-");
    return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`;
}

interface Props {
    rows: Row[];
    schema: InferredSchema;
    dateRange?: { from: string; to: string } | null;
}

export function MonthCompareChart({ rows, schema }: Props) {
    const { numericColumns, dateColumns } = schema;
    const dateCol = dateColumns[0] ?? "";

    const monthKeys = useMemo(() => buildMonthlyTotals(rows, dateCol), [rows, dateCol]);

    const [monthA, setMonthA] = useState(monthKeys[1] ?? monthKeys[0] ?? "");
    const [monthB, setMonthB] = useState(monthKeys[0] ?? "");

    // Metrics to compare
    const metricsToShow = useMemo(() => {
        const preferred = [
            "total_reach", "total_reactions", "total_comments", "total_shares",
            "fb_reach", "ig_reach", "fb_total_clicks", "ads_spend",
        ];
        const found = preferred.filter(p => numericColumns.includes(p));
        return found.length > 0 ? found : numericColumns.slice(0, 6);
    }, [numericColumns]);

    const data = useMemo(() => {
        if (!monthA || !monthB || !dateCol) return [];
        return metricsToShow.map(metric => ({
            metric: metric.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            [formatMonthLabel(monthA)]: sumForMonth(rows, dateCol, monthA, metric),
            [formatMonthLabel(monthB)]: sumForMonth(rows, dateCol, monthB, metric),
        }));
    }, [rows, dateCol, monthA, monthB, metricsToShow]);

    if (!dateCol || monthKeys.length < 2) {
        return (
            <Card className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f0f1e]">
                <CardContent className="p-6 flex items-center justify-center h-64">
                    <p className="text-slate-400 text-sm">Need at least 2 months of data for comparison.</p>
                </CardContent>
            </Card>
        );
    }

    const labelA = formatMonthLabel(monthA);
    const labelB = formatMonthLabel(monthB);

    return (
        <Card className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0f0f1e] shadow-sm">
            <CardHeader className="px-6 pt-5 pb-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">
                            Month-over-Month
                        </CardTitle>
                        <p className="text-xs text-slate-400 mt-0.5">Compare key metrics between two months</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={monthA} onValueChange={setMonthA}>
                            <SelectTrigger className="w-32 h-8 text-xs rounded-lg">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {monthKeys.map(k => (
                                    <SelectItem key={k} value={k} className="text-xs">{formatMonthLabel(k)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-xs text-slate-400">vs</span>
                        <Select value={monthB} onValueChange={setMonthB}>
                            <SelectTrigger className="w-32 h-8 text-xs rounded-lg">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {monthKeys.map(k => (
                                    <SelectItem key={k} value={k} className="text-xs">{formatMonthLabel(k)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-2 pt-4 pb-4">
                {data.length === 0 ? (
                    <div className="flex items-center justify-center h-56">
                        <p className="text-slate-400 text-sm">No data available for selected months.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis
                                dataKey="metric"
                                tick={{ fontSize: 11, fill: "#94a3b8" }}
                                axisLine={false}
                                tickLine={false}
                                interval={0}
                                angle={-20}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: "#94a3b8" }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(139,92,246,0.06)" }} />
                            <Legend
                                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                                iconType="circle"
                                iconSize={8}
                            />
                            <Bar dataKey={labelA} fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={24} />
                            <Bar dataKey={labelB} fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
