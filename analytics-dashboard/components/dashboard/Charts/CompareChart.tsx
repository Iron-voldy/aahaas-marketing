"use client";

import { useState } from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
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
import { timeSeriesByCategory } from "@/lib/aggregate";

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

interface CompareChartProps {
    rows: Row[];
    schema: InferredSchema;
    dateRange?: { from: string; to: string } | null;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-[#1a1a24] border border-slate-200 dark:border-white/10 rounded-xl p-3 shadow-xl text-sm">
            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-slate-500 dark:text-slate-400 truncate max-w-[120px]">{p.dataKey}:</span>
                    <span className="font-medium text-slate-800 dark:text-white">{p.value?.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
};

export function CompareChart({ rows, schema, dateRange }: CompareChartProps) {
    const { numericColumns, categoricalColumns, dateColumns, highCardinalityColumns } = schema;
    const allCategoricals = [...categoricalColumns, ...(highCardinalityColumns || [])].filter(c => c !== "id" && !c.toLowerCase().includes("image"));

    const [catCol, setCatCol] = useState(
        allCategoricals.find((c) => c.toLowerCase().includes("package")) ||
        allCategoricals.find((c) => c.toLowerCase().includes("destination")) ||
        allCategoricals.find((c) => c.toLowerCase().includes("name")) ||
        allCategoricals.find((c) => c.toLowerCase().includes("country")) ||
        allCategoricals[0] || ""
    );
    const [valueCol, setValueCol] = useState(
        numericColumns.find((c) => c.toLowerCase().includes("combined") && c.toLowerCase().includes("reach")) ||
        numericColumns.find((c) => c.toLowerCase().includes("reach")) ||
        numericColumns[0] || ""
    );

    if (!dateColumns.length || !allCategoricals.length) {
        return (
            <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118]">
                <CardContent className="p-6 flex items-center justify-center h-64">
                    <p className="text-slate-400 text-sm">Date or categorical data required for comparison.</p>
                </CardContent>
            </Card>
        );
    }

    const data = timeSeriesByCategory(rows, dateColumns[0], valueCol, catCol, 4, "month", dateRange?.from, dateRange?.to);
    const categories = data.length > 0
        ? Object.keys(data[0]).filter((k) => k !== "date")
        : [];

    return (
        <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm">
            <CardHeader className="px-6 pt-5 pb-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">
                        Compare by Category
                    </CardTitle>
                    <div className="flex gap-2">
                        <Select value={catCol} onValueChange={setCatCol}>
                            <SelectTrigger className="w-36 h-8 text-xs rounded-lg">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {allCategoricals.map((col) => (
                                    <SelectItem key={col} value={col} className="text-xs">
                                        {col.replace(/_/g, " ")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={valueCol} onValueChange={setValueCol}>
                            <SelectTrigger className="w-36 h-8 text-xs rounded-lg">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {numericColumns.map((col) => (
                                    <SelectItem key={col} value={col} className="text-xs">
                                        {col.replace(/_/g, " ")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-2 pt-4 pb-4">
                {data.length === 0 ? (
                    <div className="flex items-center justify-center h-52">
                        <p className="text-slate-400 text-sm">No data for comparison.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
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
                                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                                width={40}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                            />
                            {categories.map((cat, i) => (
                                <Line
                                    key={cat}
                                    type="monotone"
                                    dataKey={cat}
                                    stroke={COLORS[i % COLORS.length]}
                                    strokeWidth={2}
                                    dot={{ fill: COLORS[i % COLORS.length], r: 3, strokeWidth: 0 }}
                                    activeDot={{ r: 5, strokeWidth: 0 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
