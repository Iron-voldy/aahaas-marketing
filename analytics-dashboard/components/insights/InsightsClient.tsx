"use client";

import { useState, useEffect } from "react";
import { getPackages } from "@/lib/firebase/db";
import { inferSchema } from "@/lib/inferSchema";
import { generateInsights } from "@/lib/aggregate";
import type { Row, InferredSchema } from "@/lib/types";
import {
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    BarChart2,
    Calendar,
    Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function InsightsClient() {
    const [rows, setRows] = useState<Row[]>([]);
    const [schema, setSchema] = useState<InferredSchema | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getPackages()
            .then((data) => {
                setRows(data);
                setSchema(inferSchema(data));
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading || !schema) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-indigo-500" /></div>;
    }

    const insights = generateInsights(rows, schema);

    return (
        <div className="flex flex-col gap-6 p-4 lg:p-6 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        Insights
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Auto-generated analysis from your package data
                    </p>
                </div>
            </div>

            {/* Summary bullets */}
            <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm">
                <CardHeader className="px-6 pt-5 pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-violet-500" />
                        Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-5">
                    <ul className="space-y-3">
                        {insights.summaryBullets.map((bullet, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <CheckCircle2 className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-slate-600 dark:text-slate-300">{bullet}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            {/* Top cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top category */}
                {insights.topCategory && (
                    <Card className="rounded-2xl border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 shadow-sm">
                        <CardHeader className="px-6 pt-5 pb-3">
                            <CardTitle className="text-base font-semibold text-violet-800 dark:text-violet-200 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                Top Performing Destination
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">
                                        {insights.topCategory.name}
                                    </p>
                                    <p className="text-sm text-violet-600 dark:text-violet-300 mt-1">
                                        {insights.topCategory.value.toLocaleString()} total reach
                                    </p>
                                </div>
                                <Badge className="bg-violet-600 text-white border-0 rounded-full text-xs">
                                    #1
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Top growth */}
                {insights.topGrowth && (
                    <Card className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 shadow-sm">
                        <CardHeader className="px-6 pt-5 pb-3">
                            <CardTitle className="text-base font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                Fastest Growing
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                                        {insights.topGrowth.name}
                                    </p>
                                    <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-1">
                                        {insights.topGrowth.growthRate > 0 ? "+" : ""}
                                        {insights.topGrowth.growthRate}% month-over-month
                                    </p>
                                </div>
                                <Badge className="bg-emerald-600 text-white border-0 rounded-full text-xs">
                                    Growth
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Date range */}
            {insights.dateRange && (
                <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm">
                    <CardContent className="px-6 py-4 flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            Data period:{" "}
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                {insights.dateRange.from}
                            </span>{" "}
                            to{" "}
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                {insights.dateRange.to}
                            </span>
                        </span>
                    </CardContent>
                </Card>
            )}

            {/* Outliers */}
            {insights.outliers.length > 0 && (
                <Card className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-white dark:bg-[#111118] shadow-sm">
                    <CardHeader className="px-6 pt-5 pb-3">
                        <CardTitle className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            Anomalies / Outliers
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-5">
                        <div className="space-y-3">
                            {insights.outliers.map((outlier, i) => {
                                const countryCol = schema.categoricalColumns.find((c) =>
                                    c.includes("country")
                                );
                                const label = countryCol
                                    ? String(outlier.row[countryCol] ?? "Unknown")
                                    : `Row ${i + 1}`;
                                const dateCol = schema.dateColumns[0];
                                const dateLabel = dateCol
                                    ? String(outlier.row[dateCol] ?? "")
                                    : "";
                                return (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20"
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                        <div className="text-sm">
                                            <span className="font-medium text-slate-800 dark:text-white">
                                                {label}
                                            </span>
                                            {dateLabel && (
                                                <span className="text-slate-500 dark:text-slate-400 ml-2 text-xs">
                                                    {dateLabel.split(",")[0]}
                                                </span>
                                            )}
                                            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                                {outlier.column.replace(/_/g, " ")}:{" "}
                                                <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                    {outlier.value.toLocaleString()}
                                                </span>{" "}
                                                (z-score: {outlier.zScore.toFixed(1)})
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
