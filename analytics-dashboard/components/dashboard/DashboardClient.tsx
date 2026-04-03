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
import { Loader2, Clock, TrendingUp, Package, BarChart3, Activity, Sparkles, Filter } from "lucide-react";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";

const ChartPlaceholder = () => <div className="h-72 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse" />;

const TrendChart = dynamic(() => import("@/components/dashboard/Charts/TrendChart").then(m => m.TrendChart), { ssr: false, loading: ChartPlaceholder });
const TopPackagesChart = dynamic(() => import("@/components/dashboard/Charts/TopRankingsCharts").then(m => m.TopPackagesChart), { ssr: false, loading: ChartPlaceholder });
const TopDestinationsChart = dynamic(() => import("@/components/dashboard/Charts/TopRankingsCharts").then(m => m.TopDestinationsChart), { ssr: false, loading: ChartPlaceholder });
const FbIgCompareChart = dynamic(() => import("@/components/dashboard/Charts/FbIgCompareChart").then(m => m.FbIgCompareChart), { ssr: false, loading: ChartPlaceholder });

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
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30 animate-pulse">
                    <Activity className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Loader2 className="animate-spin w-4 h-4 text-violet-500" />
                    <span className="text-sm">Loading analytics...</span>
                </div>
            </div>
        );
    }

    const kpis = computeKpis(filteredRows, schema, rows, filters.dateRange);
    const latestUpdate = getLatestUpdateDate(rows);

    return (
        <div className="flex flex-col gap-0">
            {/* ── Hero Banner ── */}
            <div
                className="relative overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, #09090f 0%, #140a2e 45%, #0e1630 100%)",
                    minHeight: "180px",
                }}
            >
                {/* Background image overlay */}
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: "url('/images/dashboard-hero-bg.jpg')",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                />
                {/* Mesh gradient overlay */}
                <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(9,9,15,0.7) 0%, rgba(124,58,237,0.08) 50%, rgba(14,22,48,0.7) 100%)" }} />

                {/* Decorative orbs */}
                <div className="absolute top-4 right-24 w-56 h-56 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-8 left-32 w-44 h-44 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
                <div className="absolute top-8 left-1/2 w-72 h-32 rounded-full bg-purple-800/10 blur-3xl pointer-events-none" />

                <div className="relative z-10 px-4 lg:px-6 pt-6 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-300 text-[11px] font-semibold uppercase tracking-widest">
                                <Sparkles className="w-3 h-3" />
                                Analytics Overview
                            </span>
                        </div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight">
                            Performance Dashboard
                        </h1>
                        <p className="text-sm text-white/45 mt-1.5 max-w-md">
                            Social media reach & engagement across all Aahaas travel packages
                        </p>
                        {/* Platform badges */}
                        <div className="flex items-center gap-2 mt-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1877F2]/20 border border-[#1877F2]/40 text-[#60a5fa] text-xs font-medium">
                                <FacebookLogo className="w-3.5 h-3.5" /> Facebook
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/20 border border-pink-400/40 text-pink-300 text-xs font-medium">
                                <InstagramLogo className="w-3.5 h-3.5" /> Instagram
                            </span>
                        </div>
                    </div>

                    {/* Right: Stats chips */}
                    <div className="flex flex-col gap-2 sm:items-end">
                        <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/8 backdrop-blur-sm border border-white/12">
                                <Package className="w-3.5 h-3.5 text-violet-300" />
                                <span className="text-xs text-white/60">Total</span>
                                <span className="text-xs font-bold text-white">{rows.length} packages</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/8 backdrop-blur-sm border border-white/12">
                                <Filter className="w-3.5 h-3.5 text-cyan-300" />
                                <span className="text-xs text-white/60">Showing</span>
                                <span className="text-xs font-bold text-white">{filteredRows.length}</span>
                            </div>
                        </div>
                        {latestUpdate && (
                            <div className="flex items-center gap-1.5 text-xs text-white/40 mt-1">
                                <Clock className="w-3 h-3 text-violet-300/70" />
                                <span>Last synced: {latestUpdate}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Animated bottom border */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
            </div>

            {/* Page body */}
            <div className="flex flex-col gap-6 p-4 lg:p-6">
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
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-violet-400" />
                        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Key Metrics</h2>
                        <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-white/8 to-transparent" />
                    </div>
                    <KpiCards cards={kpis} />
                </div>

                {/* Charts - Trend */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-violet-400" />
                        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Reach & Engagement Trends</h2>
                        <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-white/8 to-transparent" />
                    </div>
                    <TrendChart rows={filteredRows} schema={schema} dateRange={filters.dateRange} />
                </div>

                {/* Charts - Top Rankings */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-violet-400" />
                        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Top Rankings by Reach</h2>
                        <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-white/8 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <TopPackagesChart rows={filteredRows} schema={schema} dateRange={filters.dateRange} />
                        <TopDestinationsChart rows={filteredRows} schema={schema} dateRange={filters.dateRange} />
                    </div>
                </div>

                {/* Charts - FB vs IG Engagement */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-violet-400" />
                        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Facebook vs Instagram Engagement</h2>
                        <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-white/8 to-transparent" />
                    </div>
                    <FbIgCompareChart rows={filteredRows} schema={schema} dateRange={filters.dateRange} />
                </div>
            </div>
        </div>
    );
}


