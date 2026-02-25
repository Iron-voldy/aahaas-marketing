"use client";

import { useState } from "react";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
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
import { pieBreakdown } from "@/lib/aggregate";

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#ec4899"];

interface DonutChartProps {
    rows: Row[];
    schema: InferredSchema;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-white dark:bg-[#1a1a24] border border-slate-200 dark:border-white/10 rounded-xl p-3 shadow-xl text-sm">
            <p className="font-semibold text-slate-800 dark:text-white">{d.name}</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                {d.value?.toLocaleString()} <span className="text-slate-400">({d.percentage}%)</span>
            </p>
        </div>
    );
};

const CustomLegend = ({ payload }: any) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-3">
        {payload?.map((entry: any, i: number) => (
            <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[100px]">{entry.value}</span>
            </div>
        ))}
    </div>
);

export function DonutChart({ rows, schema }: DonutChartProps) {
    const { numericColumns, categoricalColumns } = schema;

    const [catCol, setCatCol] = useState(
        categoricalColumns.find((c) => c.includes("country")) || categoricalColumns[0] || ""
    );
    const [valueCol, setValueCol] = useState(
        numericColumns.find((c) => c.includes("total") && c.includes("reach")) ||
        numericColumns[0] || ""
    );

    if (!categoricalColumns.length || !numericColumns.length) return null;

    const data = pieBreakdown(rows, catCol, valueCol);

    return (
        <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm">
            <CardHeader className="px-6 pt-5 pb-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">
                        Share Breakdown
                    </CardTitle>
                    <div className="flex gap-2">
                        <Select value={catCol} onValueChange={setCatCol}>
                            <SelectTrigger className="w-36 h-8 text-xs rounded-lg">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {categoricalColumns.map((col) => (
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
            <CardContent className="px-2 pt-2 pb-4">
                {data.length === 0 ? (
                    <div className="flex items-center justify-center h-52">
                        <p className="text-slate-400 text-sm">No data available.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={230}>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="45%"
                                innerRadius={58}
                                outerRadius={88}
                                paddingAngle={3}
                                dataKey="value"
                            >
                                {data.map((_, index) => (
                                    <Cell
                                        key={index}
                                        fill={COLORS[index % COLORS.length]}
                                        stroke="transparent"
                                    />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend content={<CustomLegend />} />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
