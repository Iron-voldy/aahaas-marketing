"use client";

import { KpiCards } from "@/components/dashboard/KpiCards";
import { Filters } from "@/components/dashboard/Filters";
import { TrendChart } from "@/components/dashboard/Charts/TrendChart";
import { TopBarChart } from "@/components/dashboard/Charts/TopBarChart";
import { DonutChart } from "@/components/dashboard/Charts/DonutChart";
import { CompareChart } from "@/components/dashboard/Charts/CompareChart";
import { useFilters } from "@/hooks/useFilters";
import { computeKpis } from "@/lib/aggregate";
import type { Row, InferredSchema } from "@/lib/types";

interface DashboardClientProps {
    rows: Row[];
    schema: InferredSchema;
}

export function DashboardClient({ rows, schema }: DashboardClientProps) {
    const {
        filters,
        filteredRows,
        setDateRange,
        setCategoryFilter,
        setSearch,
        reset,
    } = useFilters(rows, schema.dateColumns);

    const kpis = computeKpis(filteredRows, schema);

    return (
        <div className="flex flex-col gap-6 p-4 lg:p-6">
            {/* Page header */}
            <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    Dashboard
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Social media performance for Aahaas travel packages
                </p>
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
