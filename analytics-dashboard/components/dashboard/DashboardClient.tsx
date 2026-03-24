"use client";

import dynamic from "next/dynamic";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { Filters } from "@/components/dashboard/Filters";
import { useFilters } from "@/hooks/useFilters";
import { computeKpis, getLatestUpdateDate } from "@/lib/aggregate";
import { getPackages } from "@/lib/db";
import { inferSchema } from "@/lib/inferSchema";
import type { Row, InferredSchema } from "@/lib/types";
import { useState, useEffect } from "react";
import { Loader2, Clock } from "lucide-react";

const ChartPlaceholder = () => <div className="h-72 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />;

const TrendChart = dynamic(() => import("@/components/dashboard/Charts/TrendChart").then(m => m.TrendChart), { ssr: false, loading: ChartPlaceholder });
const TopBarChart = dynamic(() => import("@/components/dashboard/Charts/TopBarChart").then(m => m.TopBarChart), { ssr: false, loading: ChartPlaceholder });
const DonutChart = dynamic(() => import("@/components/dashboard/Charts/DonutChart").then(m => m.DonutChart), { ssr: false, loading: ChartPlaceholder });
const CompareChart = dynamic(() => import("@/components/dashboard/Charts/CompareChart").then(m => m.CompareChart), { ssr: false, loading: ChartPlaceholder });

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
                <TrendChart rows={filteredRows} schema={schema} dateRange={filters.dateRange} />
                <DonutChart rows={filteredRows} schema={schema} dateRange={filters.dateRange} />
            </div>

            {/* Charts - second row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <TopBarChart rows={filteredRows} schema={schema} dateRange={filters.dateRange} />
                <CompareChart rows={filteredRows} schema={schema} dateRange={filters.dateRange} />
            </div>
        </div>
    );
}
