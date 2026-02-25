"use client";

import { useState, useMemo } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    getFilteredRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
    type VisibilityState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    Columns3,
    Download,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import type { Row } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PackagesTableProps {
    rows: Row[];
    globalFilter?: string;
}

function formatValue(v: unknown): string {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "number") return isFinite(v) ? v.toLocaleString() : "—";
    return String(v);
}

function downloadCsv(rows: Row[], columns: string[], filename = "packages.csv") {
    const header = columns.join(",");
    const body = rows
        .map((row) =>
            columns
                .map((col) => {
                    const val = row[col] ?? "";
                    return typeof val === "string" && val.includes(",")
                        ? `"${val}"`
                        : val;
                })
                .join(",")
        )
        .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function PackagesTable({ rows, globalFilter = "" }: PackagesTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [pageSize, setPageSize] = useState(10);

    const allCols = useMemo(
        () => (rows.length > 0 ? Object.keys(rows[0]) : []),
        [rows]
    );

    const columns = useMemo<ColumnDef<Row>[]>(
        () =>
            allCols.map((col) => ({
                accessorKey: col,
                id: col,
                header: ({ column }: any) => {
                    const sorted = column.getIsSorted();
                    return (
                        <button
                            className="flex items-center gap-1 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide hover:text-violet-600 dark:hover:text-violet-400 transition-colors w-full"
                            onClick={() => column.toggleSorting(sorted === "asc")}
                            aria-label={`Sort by ${col}`}
                        >
                            <span className="truncate max-w-[100px]">
                                {col.replace(/_/g, " ")}
                            </span>
                            {sorted === "asc" ? (
                                <ChevronUp className="w-3 h-3 flex-shrink-0 text-violet-600" />
                            ) : sorted === "desc" ? (
                                <ChevronDown className="w-3 h-3 flex-shrink-0 text-violet-600" />
                            ) : (
                                <ChevronsUpDown className="w-3 h-3 flex-shrink-0 opacity-30" />
                            )}
                        </button>
                    );
                },
                cell: ({ getValue }: any) => {
                    const v = getValue();
                    return (
                        <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[140px] block">
                            {formatValue(v)}
                        </span>
                    );
                },
            })),
        [allCols]
    );

    const table = useReactTable({
        data: rows,
        columns,
        state: { sorting, columnVisibility, globalFilter },
        onSortingChange: setSorting,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize } },
    });

    const visibleCols = table
        .getAllColumns()
        .filter((c) => c.getIsVisible())
        .map((c) => c.id);

    // Update pageSize
    const handlePageSizeChange = (val: string) => {
        const n = parseInt(val);
        setPageSize(n);
        table.setPageSize(n);
    };

    return (
        <div className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
            {/* Table toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {table.getFilteredRowModel().rows.length} records
                    </span>
                    {globalFilter && (
                        <Badge variant="secondary" className="text-xs rounded-full">
                            Filtered
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg gap-1.5 text-xs border-slate-200 dark:border-white/10"
                            >
                                <Columns3 className="w-3.5 h-3.5" />
                                Columns
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                            {table.getAllColumns().map((col) => (
                                <DropdownMenuCheckboxItem
                                    key={col.id}
                                    checked={col.getIsVisible()}
                                    onCheckedChange={(val) => col.toggleVisibility(val)}
                                    className="text-xs capitalize"
                                >
                                    {col.id.replace(/_/g, " ")}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg gap-1.5 text-xs border-slate-200 dark:border-white/10"
                        onClick={() =>
                            downloadCsv(
                                table.getFilteredRowModel().rows.map((r) => r.original),
                                visibleCols
                            )
                        }
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#0d0d14]">
                        {table.getHeaderGroups().map((hg) => (
                            <tr key={hg.id} className="border-b border-slate-100 dark:border-white/5">
                                {hg.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-4 py-2.5 text-left whitespace-nowrap"
                                    >
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={visibleCols.length}
                                    className="text-center py-12 text-slate-400 text-sm"
                                >
                                    No records match your filters.
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row, i) => (
                                <tr
                                    key={row.id}
                                    className={cn(
                                        "border-b border-slate-50 dark:border-white/[0.03] hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors",
                                        i % 2 === 0 ? "" : "bg-slate-50/40 dark:bg-white/[0.01]"
                                    )}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-4 py-2.5 whitespace-nowrap">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Rows per page:</span>
                    <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                        <SelectTrigger className="w-16 h-7 text-xs rounded-lg">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[10, 25, 50].map((n) => (
                                <SelectItem key={n} value={String(n)} className="text-xs">
                                    {n}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        Page {table.getState().pagination.pageIndex + 1} of{" "}
                        {Math.max(table.getPageCount(), 1)}
                    </span>
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 rounded-lg"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 rounded-lg"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            aria-label="Next page"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
