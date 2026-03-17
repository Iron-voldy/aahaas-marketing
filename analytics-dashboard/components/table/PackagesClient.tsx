"use client";

import { useState, useMemo, useEffect } from "react";
import { LayoutGrid, Table2, GitCompare, X, ImagePlus, Clock, Search } from "lucide-react";
import { Filters } from "@/components/dashboard/Filters";
import { useFilters } from "@/hooks/useFilters";
import { sumColumn, getLatestUpdateDate } from "@/lib/aggregate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PackageCard } from "@/components/packages/PackageCard";
import { PackageDetailModal } from "@/components/packages/PackageDetailModal";
import { PackageComparisonPanel } from "@/components/packages/PackageComparisonPanel";
import { QuickEditStatsModal } from "@/components/packages/QuickEditStatsModal";
import { PackagesTable } from "@/components/table/PackagesTable";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";
import type { Row, InferredSchema } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { getPackages } from "@/lib/firebase/db";
import { inferSchema } from "@/lib/inferSchema";

type ViewMode = "cards" | "table";

// Map row number (1-indexed, zero-padded to 2 digits) → /images/packages/01.jpg
// This matches the file naming (01.jpg, 02.jpg … 14.jpg) to the CSV row order exactly.
function getFlyerImage(rowIndex: number): string {
    const n = String(rowIndex + 1).padStart(2, "0");
    return `/images/packages/${n}.jpg`;
}

export function PackagesClient() {
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

    const [viewMode, setViewMode] = useState<ViewMode>("cards");
    const {
        filters,
        filteredRows,
        setDateRange,
        setCategoryFilter,
        setSearch,
        reset,
    } = useFilters(rows, schema?.dateColumns || []);

    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [detailRow, setDetailRow] = useState<Row | null>(null);
    const [quickEditRow, setQuickEditRow] = useState<Row | null>(null);
    const [showComparison, setShowComparison] = useState(false);

    if (isLoading || !schema) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-indigo-500" /></div>;
    }

    const selectedRows = selectedIndices
        .map((origIdx) => rows[origIdx])
        .filter(Boolean);

    const toggleSelect = (originalIndex: number) => {
        setSelectedIndices((prev) => {
            if (prev.includes(originalIndex)) return prev.filter((i) => i !== originalIndex);
            if (prev.length >= 4) return prev;
            return [...prev, originalIndex];
        });
    };

    const clearSelection = () => setSelectedIndices([]);
    const removeFromComparison = (i: number) => {
        setSelectedIndices((prev) => prev.filter((_, idx) => idx !== i));
    };

    // Compute platform totals
    // Compute platform totals based on filtered results and date range
    const fbReachCol = schema.numericColumns.find(c => (c.startsWith("fb_") && c.includes("reach")) || c === "FB Reach");
    const igReachCol = schema.numericColumns.find(c => (c.startsWith("ig_") && c.includes("reach")) || c === "IG Reach");
    const totalReachCol = schema.numericColumns.find(c => (c.includes("total") && c.includes("reach")) || c === "Combined Reach");
    
    const from = filters.dateRange?.from;
    const to = filters.dateRange?.to;

    const fbTotal = fbReachCol ? sumColumn(filteredRows, fbReachCol, from, to) : 0;
    const igTotal = igReachCol ? sumColumn(filteredRows, igReachCol, from, to) : 0;
    const combinedTotal = totalReachCol ? sumColumn(filteredRows, totalReachCol, from, to) : (fbTotal + igTotal);
    const latestUpdate = getLatestUpdateDate(rows);

    return (
        <div className="flex flex-col min-h-full pb-8">
            {/* ── Page Header ── */}
            <div className="sticky top-0 z-20 bg-slate-50 dark:bg-[#0a0a0f] border-b border-slate-200 dark:border-white/5 px-4 lg:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            Packages
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {filteredRows.length} packages — click flyers to explore stats
                        </p>
                    </div>

                    {latestUpdate && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2.5 py-1.5 rounded-md">
                            <Clock className="w-3.5 h-3.5" />
                            Last Synced: {latestUpdate}
                        </div>
                    )}

                    {/* View toggle */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                            <button
                                onClick={() => setViewMode("cards")}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                                    viewMode === "cards"
                                        ? "bg-violet-600 text-white"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                )}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                Cards
                            </button>
                            <button
                                onClick={() => setViewMode("table")}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-slate-200 dark:border-white/10",
                                    viewMode === "table"
                                        ? "bg-violet-600 text-white"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                )}
                            >
                                <Table2 className="w-3.5 h-3.5" />
                                Table
                            </button>
                        </div>

                        {selectedIndices.length > 0 && (
                            <Button
                                size="sm"
                                className="h-9 rounded-xl gap-1.5 text-xs bg-violet-600 hover:bg-violet-700"
                                onClick={() => setShowComparison(!showComparison)}
                            >
                                <GitCompare className="w-3.5 h-3.5" />
                                Compare ({selectedIndices.length})
                            </Button>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="mt-4">
                    <Filters
                        rows={rows}
                        schema={schema}
                        filters={filters}
                        onDateRange={setDateRange}
                        onCategoryFilter={setCategoryFilter}
                        onSearch={setSearch}
                        onReset={reset}
                    />
                </div>
            </div>

            <div className="px-4 lg:px-6 pt-5 space-y-5">
                {/* Total Stats Summary */}
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 bg-[#1877F2]/10 dark:bg-[#1877F2]/15 rounded-full px-3 py-1">
                        <FacebookLogo className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold text-[#1877F2]">
                            {fbTotal.toLocaleString()} FB REACH
                        </span>
                    </div>
                    <div className="flex items-center gap-2 bg-pink-500/10 dark:bg-pink-500/15 rounded-full px-3 py-1">
                        <InstagramLogo className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold text-pink-500">
                            {igTotal.toLocaleString()} IG REACH
                        </span>
                    </div>
                    <div className="flex items-center gap-2 bg-violet-500/10 dark:bg-violet-500/15 rounded-full px-3 py-1">
                        <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400 uppercase">
                            {combinedTotal.toLocaleString()} Combined
                        </span>
                    </div>
                </div>

                {/* Comparison panel (shown when packages selected) */}
                {showComparison && selectedRows.length > 0 && (
                    <PackageComparisonPanel
                        rows={selectedRows}
                        onRemove={removeFromComparison}
                        onClear={() => { clearSelection(); setShowComparison(false); }}
                    />
                )}

                {/* Selection info bar */}
                {selectedIndices.length > 0 && !showComparison && (
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">
                        <Badge className="bg-violet-600 text-white border-0 rounded-full text-xs">
                            {selectedIndices.length} selected
                        </Badge>
                        <span className="text-xs text-violet-700 dark:text-violet-300">
                            Select up to 4 packages to compare side-by-side
                        </span>
                        <button
                            onClick={clearSelection}
                            className="ml-auto text-xs text-violet-500 hover:text-violet-700"
                        >
                            Clear
                        </button>
                    </div>
                )}


                {/* ── Card Grid View ── */}
                {viewMode === "cards" && (
                    <>
                        {filteredRows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <Search className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm">No packages match your search.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
                                {filteredRows.map((row) => {
                                    // Find original index for image mapping
                                    const originalIndex = rows.indexOf(row);
                                    return (
                                        <PackageCard
                                            key={row.id || originalIndex}
                                            row={row}
                                            index={originalIndex}
                                            isSelected={selectedIndices.includes(originalIndex)}
                                            dateRange={filters.dateRange}
                                            onToggleSelect={() => toggleSelect(originalIndex)}
                                            onViewDetail={() => setDetailRow(row)}
                                            onQuickEdit={() => setQuickEditRow(row)}
                                            imagePath={(row.imageUrl as string) || getFlyerImage(originalIndex)}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {/* ── Table View ── */}
                {viewMode === "table" && (
                    <PackagesTable rows={filteredRows} globalFilter={filters.searchTerm} />
                )}
            </div>

            {/* Package Detail Modal */}
            <PackageDetailModal
                row={detailRow}
                open={!!detailRow}
                onClose={() => setDetailRow(null)}
            />

            {/* Quick Edit Stats Modal */}
            <QuickEditStatsModal
                row={quickEditRow}
                open={!!quickEditRow}
                onClose={() => setQuickEditRow(null)}
                onUpdateSuccess={() => {
                    setQuickEditRow(null);
                    // Refresh data after edit
                    setIsLoading(true);
                    getPackages()
                        .then((data) => {
                            setRows(data);
                            setSchema(inferSchema(data));
                        })
                        .catch(console.error)
                        .finally(() => setIsLoading(false));
                }}
            />
        </div>
    );
}
