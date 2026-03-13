"use client";

import { KpiCards } from "@/components/dashboard/KpiCards";
import { Filters } from "@/components/dashboard/Filters";
import { TrendChart } from "@/components/dashboard/Charts/TrendChart";
import { TopBarChart } from "@/components/dashboard/Charts/TopBarChart";
import { DonutChart } from "@/components/dashboard/Charts/DonutChart";
import { CompareChart } from "@/components/dashboard/Charts/CompareChart";
import { useFilters } from "@/hooks/useFilters";
import { computeKpis, getLatestUpdateDate } from "@/lib/aggregate";
import { getPackages } from "@/lib/firebase/db";
import { inferSchema } from "@/lib/inferSchema";
import type { Row, InferredSchema } from "@/lib/types";
import { useState, useEffect } from "react";
import { Loader2, Clock } from "lucide-react";

export function DashboardClient() {
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

    const {
        filters,
        filteredRows,
        setDateRange,
        setCategoryFilter,
        setSearch,
        reset,
    } = useFilters(rows, schema?.dateColumns || []);

    if (isLoading || !schema) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-indigo-500" /></div>;
    }

    const kpis = computeKpis(filteredRows, schema, rows, filters.dateRange);
    const latestUpdate = getLatestUpdateDate(rows);

    return (
        <div className="flex flex-col gap-6 p-4 lg:p-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                        Dashboard
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Social media performance for Aahaas travel packages
                    </p>
                </div>
                {latestUpdate && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2.5 py-1.5 rounded-md">
                        <Clock className="w-3.5 h-3.5" />
                        Last Synced: {latestUpdate}
                    </div>
                )}
            </div>

            {/* Filters */}
            <Filters
                rows={rows}
                schema={schema}
                filters={filters}
                onDateRange={setDateRange}
                onCategoryFilter={setCategoryFilter}
                onSearch={setSearch}
                onReset={reset}
            />

            {/* KPI Cards */}
            <KpiCards cards={kpis} />

            {/* Charts - first row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <TrendChart rows={filteredRows} schema={schema} />
                <DonutChart rows={filteredRows} schema={schema} />
            </div>

            {/* Charts - second row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <TopBarChart rows={filteredRows} schema={schema} />
                <CompareChart rows={filteredRows} schema={schema} />
            </div>
        </div>
    );
}
