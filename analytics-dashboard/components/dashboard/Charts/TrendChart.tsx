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
import { timeSeries } from "@/lib/aggregate";

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

interface TrendChartProps {
    rows: Row[];
    schema: InferredSchema;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-[#1a1a24] border border-slate-200 dark:border-white/10 rounded-xl p-3 shadow-xl text-sm">
            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-slate-500 dark:text-slate-400">{p.dataKey}:</span>
                    <span className="font-medium text-slate-800 dark:text-white">{p.value?.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
};

export function TrendChart({ rows, schema }: TrendChartProps) {
    const { numericColumns, dateColumns } = schema;

    const [selectedMetric, setSelectedMetric] = useState(
        numericColumns.find((c) => c.toLowerCase().includes("combined") && c.toLowerCase().includes("reach")) ||
        numericColumns.find((c) => c.toLowerCase().includes("reach")) ||
        numericColumns[0] ||
        ""
    );

    if (!dateColumns.length || !numericColumns.length) {
        return (
            <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118]">
                <CardContent className="p-6 flex items-center justify-center h-64">
                    <p className="text-slate-400 text-sm">No date or numeric data for trend chart.</p>
                </CardContent>
            </Card>
        );
    }

    const data = timeSeries(rows, dateColumns[0], selectedMetric, "month");

    return (
        <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm">
            <CardHeader className="px-6 pt-5 pb-0 flex flex-row items-center justify-between gap-4">
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">
                    Trend Over Time
                </CardTitle>
                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                    <SelectTrigger className="w-44 h-8 text-xs rounded-lg">
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
            </CardHeader>
            <CardContent className="px-2 pt-4 pb-4">
                {data.length === 0 ? (
                    <div className="flex items-center justify-center h-56">
                        <p className="text-slate-400 text-sm">No data available for selected metric.</p>
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
                            <Line
                                type="monotone"
                                dataKey="value"
                                name={selectedMetric.replace(/_/g, " ")}
                                stroke={COLORS[0]}
                                strokeWidth={2.5}
                                dot={{ fill: COLORS[0], r: 4, strokeWidth: 0 }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
