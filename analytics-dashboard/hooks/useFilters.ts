"use client";

import { useReducer, useMemo, useCallback } from "react";
import type { Row, FilterState } from "@/lib/types";
import { parseFlexibleDate } from "@/lib/inferSchema";

type Action =
    | { type: "SET_DATE_RANGE"; payload: { from: string; to: string } | null }
    | { type: "SET_CATEGORY_FILTER"; payload: { col: string; values: string[] } }
    | { type: "SET_NUMERIC_RANGE"; payload: { col: string; range: [number, number] } }
    | { type: "SET_SEARCH"; payload: string }
    | { type: "RESET" };

const initialState: FilterState = {
    dateRange: null,
    categoryFilters: {},
    numericRanges: {},
    searchTerm: "",
};

function reducer(state: FilterState, action: Action): FilterState {
    switch (action.type) {
        case "SET_DATE_RANGE":
            return { ...state, dateRange: action.payload };
        case "SET_CATEGORY_FILTER":
            return {
                ...state,
                categoryFilters: {
                    ...state.categoryFilters,
                    [action.payload.col]: action.payload.values,
                },
            };
        case "SET_NUMERIC_RANGE":
            return {
                ...state,
                numericRanges: {
                    ...state.numericRanges,
                    [action.payload.col]: action.payload.range,
                },
            };
        case "SET_SEARCH":
            return { ...state, searchTerm: action.payload };
        case "RESET":
            return initialState;
        default:
            return state;
    }
}

export function useFilters(rows: Row[], dateColumns: string[]) {
    const [filters, dispatch] = useReducer(reducer, initialState);

    const setDateRange = useCallback(
        (range: { from: string; to: string } | null) =>
            dispatch({ type: "SET_DATE_RANGE", payload: range }),
        []
    );

    const setCategoryFilter = useCallback(
        (col: string, values: string[]) =>
            dispatch({ type: "SET_CATEGORY_FILTER", payload: { col, values } }),
        []
    );

    const setNumericRange = useCallback(
        (col: string, range: [number, number]) =>
            dispatch({ type: "SET_NUMERIC_RANGE", payload: { col, range } }),
        []
    );

    const setSearch = useCallback(
        (term: string) => dispatch({ type: "SET_SEARCH", payload: term }),
        []
    );

    const reset = useCallback(() => dispatch({ type: "RESET" }), []);

    const filteredRows = useMemo(() => {
        let result = rows;

        // Date range filter
        if (filters.dateRange && dateColumns.length > 0) {
            // Use T00:00:00 to force local time parsing of YYYY-MM-DD strings
            const from = new Date(filters.dateRange.from + "T00:00:00");
            const to = new Date(filters.dateRange.to + "T23:59:59.999");

            result = result.filter((row) => {
                const history = row.history as Record<string, any> | undefined;
                
                // 1. If history exists, check if any recorded date is before or within the range
                // This ensures we show packages that were already alive and active.
                if (history) {
                    const hDates = Object.keys(history).sort();
                    if (hDates.length > 0 && hDates[0] <= filters.dateRange!.to) return true;
                }

                // 2. Fallback: Check ALL published date columns
                for (const dc of dateColumns) {
                    const rawVal = row[dc];
                    if (!rawVal) continue;
                    const d = parseFlexibleDate(rawVal);
                    
                    // Show if published at or before the end of the range
                    if (d && d <= to) return true;
                }
                return false;
            });
        }

        // Category filters
        for (const [col, values] of Object.entries(filters.categoryFilters)) {
            if (!values || values.length === 0) continue;
            result = result.filter((row) => {
                const val = String(row[col] ?? "");
                return values.includes(val);
            });
        }

        // Numeric range filters
        for (const [col, [min, max]] of Object.entries(filters.numericRanges)) {
            result = result.filter((row) => {
                const val = row[col];
                if (typeof val !== "number") return true;
                return val >= min && val <= max;
            });
        }

        // Search term
        if (filters.searchTerm.trim()) {
            const term = filters.searchTerm.toLowerCase();
            result = result.filter((row) =>
                Object.values(row).some((v) =>
                    String(v ?? "").toLowerCase().includes(term)
                )
            );
        }

        return result;
    }, [rows, filters, dateColumns]);

    return {
        filters,
        filteredRows,
        setDateRange,
        setCategoryFilter,
        setNumericRange,
        setSearch,
        reset,
    };
}
