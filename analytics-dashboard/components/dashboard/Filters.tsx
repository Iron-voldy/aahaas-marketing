"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { X, Search, SlidersHorizontal } from "lucide-react";
import type { Row, InferredSchema } from "@/lib/types";
import { useState } from "react";

interface FiltersProps {
    rows: Row[];
    schema: InferredSchema;
    filters: {
        dateRange: { from: string; to: string } | null;
        categoryFilters: Record<string, string[]>;
        searchTerm: string;
    };
    onDateRange: (range: { from: string; to: string } | null) => void;
    onCategoryFilter: (col: string, values: string[]) => void;
    onSearch: (term: string) => void;
    onReset: () => void;
}

export function Filters({
    rows,
    schema,
    filters,
    onDateRange,
    onCategoryFilter,
    onSearch,
    onReset,
}: FiltersProps) {
    const { categoricalColumns, dateColumns } = schema;
    const [expanded, setExpanded] = useState(false);

    // Unique values for categorical columns
    const catOptions: Record<string, string[]> = {};
    for (const col of categoricalColumns.slice(0, 4)) {
        const vals = [
            ...new Set(
                rows
                    .map((r) => String(r[col] ?? ""))
                    .filter((v) => v && v !== "null" && v !== "undefined")
            ),
        ].sort();
        catOptions[col] = vals;
    }

    const activeFilterCount =
        (filters.dateRange ? 1 : 0) +
        Object.values(filters.categoryFilters).filter((v) => v.length > 0).length +
        (filters.searchTerm ? 1 : 0);

    return (
        <div className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-white/5 rounded-2xl p-4 shadow-sm">
            {/* Search + toggle */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                        placeholder="Search packages..."
                        className="pl-9 h-9 rounded-xl text-sm bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                        value={filters.searchTerm}
                        onChange={(e) => onSearch(e.target.value)}
                    />
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl gap-2 text-xs border-slate-200 dark:border-white/10"
                    onClick={() => setExpanded(!expanded)}
                >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Filters
                    {activeFilterCount > 0 && (
                        <Badge className="ml-0.5 h-4 px-1.5 text-[10px] bg-violet-600 text-white border-0 rounded-full">
                            {activeFilterCount}
                        </Badge>
                    )}
                </Button>
                {activeFilterCount > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-xl text-xs text-slate-500 hover:text-rose-500"
                        onClick={onReset}
                    >
                        <X className="w-3.5 h-3.5" />
                    </Button>
                )}
            </div>

            {/* Expanded filter panel */}
            {expanded && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Date range */}
                    {dateColumns.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                From Date
                            </label>
                            <Input
                                type="date"
                                className="h-9 rounded-xl text-sm bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                                value={filters.dateRange?.from ?? ""}
                                onChange={(e) => {
                                    const from = e.target.value;
                                    const to = filters.dateRange?.to ?? from;
                                    if (from) onDateRange({ from, to });
                                    else onDateRange(null);
                                }}
                            />
                        </div>
                    )}
                    {dateColumns.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                To Date
                            </label>
                            <Input
                                type="date"
                                className="h-9 rounded-xl text-sm bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                                value={filters.dateRange?.to ?? ""}
                                onChange={(e) => {
                                    const to = e.target.value;
                                    const from = filters.dateRange?.from ?? to;
                                    if (to) onDateRange({ from, to });
                                    else onDateRange(null);
                                }}
                            />
                        </div>
                    )}

                    {/* Categorical filters */}
                    {Object.entries(catOptions).map(([col, options]) => (
                        <div key={col} className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                {col.replace(/_/g, " ")}
                            </label>
                            <Select
                                value={filters.categoryFilters[col]?.[0] ?? "all"}
                                onValueChange={(val) => {
                                    if (val === "all") onCategoryFilter(col, []);
                                    else onCategoryFilter(col, [val]);
                                }}
                            >
                                <SelectTrigger className="h-9 rounded-xl text-sm bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10">
                                    <SelectValue placeholder={`All ${col}`} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {options.map((opt) => (
                                        <SelectItem key={opt} value={opt} className="text-sm">
                                            {opt}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
            )}

            {/* Active filter badges */}
            {activeFilterCount > 0 && !expanded && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {filters.searchTerm && (
                        <Badge variant="secondary" className="gap-1.5 text-xs rounded-full px-2.5">
                            Search: "{filters.searchTerm}"
                            <X
                                className="w-3 h-3 cursor-pointer"
                                onClick={() => onSearch("")}
                            />
                        </Badge>
                    )}
                    {Object.entries(filters.categoryFilters).map(([col, vals]) =>
                        vals.map((val) => (
                            <Badge
                                key={`${col}-${val}`}
                                variant="secondary"
                                className="gap-1.5 text-xs rounded-full px-2.5"
                            >
                                {col.replace(/_/g, " ")}: {val}
                                <X
                                    className="w-3 h-3 cursor-pointer"
                                    onClick={() => onCategoryFilter(col, [])}
                                />
                            </Badge>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
