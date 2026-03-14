"use client";

import { useState } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Row, InferredSchema } from "@/lib/types";
import { topN } from "@/lib/aggregate";

const COLORS = [
    "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95",
    "#06b6d4", "#0891b2", "#0e7490", "#155e75", "#164e63",
];

interface TopBarChartProps {
    rows: Row[];
    schema: InferredSchema;
    dateRange?: { from: string; to: string } | null;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-[#1a1a24] border border-slate-200 dark:border-white/10 rounded-xl p-3 shadow-xl text-sm">
            <p className="font-semibold text-slate-800 dark:text-white">{payload[0]?.payload?.category}</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Value: <span className="font-medium text-slate-800 dark:text-white">{payload[0]?.value?.toLocaleString()}</span>
            </p>
        </div>
    );
};

export function TopBarChart({ rows, schema, dateRange }: TopBarChartProps) {
    const { numericColumns, categoricalColumns, highCardinalityColumns } = schema;
    const allCategoricals = [...categoricalColumns, ...(highCardinalityColumns || [])].filter(c => c !== "id" && !c.toLowerCase().includes("image"));

    const [groupCol, setGroupCol] = useState(
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

    if (!allCategoricals.length || !numericColumns.length) {
        return (
            <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118]">
                <CardContent className="p-6 flex items-center justify-center h-64">
                    <p className="text-slate-400 text-sm">No data available.</p>
                </CardContent>
            </Card>
        );
    }

    const data = topN(rows, groupCol, valueCol, 10, dateRange?.from, dateRange?.to);

    return (
        <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm">
            <CardHeader className="px-6 pt-5 pb-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">
                        Top Categories
                    </CardTitle>
                    <div className="flex gap-2">
                        <Select value={groupCol} onValueChange={setGroupCol}>
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
                        <p className="text-slate-400 text-sm">No data matching current filters.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                            <XAxis
                                dataKey="category"
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
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(139,92,246,0.08)" }} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={52}>
                                {data.map((_, index) => (
                                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
