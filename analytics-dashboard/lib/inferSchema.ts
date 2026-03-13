import type { Row, InferredSchema } from "./types";

const DATE_COLUMN_PATTERNS =
    /date|time|created|published|booked|start|end|period/i;
const CATEGORICAL_CARDINALITY_THRESHOLD = 30;

function isDateString(value: string): boolean {
    if (!value || typeof value !== "string") return false;
    // Skip pure numbers
    if (/^\d+$/.test(value.trim())) return false;
    // Common date formats
    const patterns = [
        /\d{1,2}[/-]\w{3,}-?\d{2,4}/, // DD-Month-YYYY
        /\w+ \d{1,2}, \d{4}/,         // Month DD, YYYY
        /\d{1,2} \w+ \d{4}/,          // DD Month YYYY
        /^\d{4}-\d{2}-\d{2}/,         // YYYY-MM-DD
        /\d{1,2}-\w{3}-\d{2,4}/i,     // DD-MMM-YY
        /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/, // DD-MM-YYYY or DD/MM/YYYY
    ];
    return patterns.some((p) => p.test(value.trim()));
}

function isNumericColumn(rows: Row[], col: string): boolean {
    const nonEmpty = rows.filter((r) => r[col] !== null && r[col] !== undefined);
    if (nonEmpty.length === 0) return false;
    const numericCount = nonEmpty.filter((r) => typeof r[col] === "number").length;
    return numericCount / nonEmpty.length >= 0.7;
}

function isDateColumn(rows: Row[], col: string): boolean {
    // Name heuristic
    if (DATE_COLUMN_PATTERNS.test(col)) {
        // Confirm at least one value looks like a date
        const sample = rows
            .map((r) => r[col])
            .filter((v) => v !== null && typeof v === "string")
            .slice(0, 5);
        if (sample.some((v) => isDateString(v as string))) return true;
    }
    // Value heuristic: majority parse as dates
    const nonEmpty = rows
        .filter((r) => r[col] !== null && typeof r[col] === "string")
        .slice(0, 10);
    if (nonEmpty.length === 0) return false;
    const dateCount = nonEmpty.filter((r) =>
        isDateString(r[col] as string)
    ).length;
    return dateCount / nonEmpty.length >= 0.6;
}

function isCategoricalColumn(
    rows: Row[],
    col: string,
    schema: { numericColumns: string[]; dateColumns: string[] }
): boolean {
    if (schema.numericColumns.includes(col)) return false;
    if (schema.dateColumns.includes(col)) return false;
    const uniqueValues = new Set(
        rows
            .map((r) => r[col])
            .filter((v) => v !== null && v !== undefined && v !== "")
    );
    return (
        uniqueValues.size >= 1 &&
        uniqueValues.size <= CATEGORICAL_CARDINALITY_THRESHOLD
    );
}

export function inferSchema(rows: Row[]): InferredSchema {
    if (!rows || rows.length === 0) {
        return {
            allColumns: [],
            numericColumns: [],
            categoricalColumns: [],
            dateColumns: [],
            highCardinalityColumns: [],
        };
    }

    const allColumns = Object.keys(rows[0]);

    const numericColumns = allColumns.filter((col) =>
        isNumericColumn(rows, col)
    );
    const dateColumns = allColumns.filter(
        (col) => !numericColumns.includes(col) && isDateColumn(rows, col)
    );
    const categoricalColumns = allColumns.filter((col) =>
        isCategoricalColumn(rows, col, { numericColumns, dateColumns })
    );
    const highCardinalityColumns = allColumns.filter(
        (col) =>
            !numericColumns.includes(col) &&
            !dateColumns.includes(col) &&
            !categoricalColumns.includes(col)
    );

    return {
        allColumns,
        numericColumns,
        categoricalColumns,
        dateColumns,
        highCardinalityColumns,
    };
}

export function parseFlexibleDate(value: any): Date | null {
    if (!value) return null;

    // Handle Firestore Timestamp or similar objects
    if (typeof value === "object") {
        if (typeof value.toDate === "function") return value.toDate();
        if (value.seconds !== undefined) return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
        if (value instanceof Date) return value;
    }

    if (typeof value !== "string") return null;

    // Handle "16 December 2025, 14:30" format
    const cleaned = value.replace(/,.*$/, "").trim();

    // Check if new Date() can parse it (e.g., YYYY-MM-DD or MM/DD/YYYY)
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d;

    // Handle "21-Jan-26" or "21-Jan-2026" format
    const shortMatch = cleaned.match(/^(\d{1,2})-(\w{3})-(\d{2,4})$/i);
    if (shortMatch) {
        const [_, day, mon, yr] = shortMatch;
        const year = yr.length === 2 ? 2000 + parseInt(yr) : parseInt(yr);
        const parsed = new Date(`${mon} ${day} ${year}`);
        if (!isNaN(parsed.getTime())) return parsed;
    }

    // Handle "DD-MM-YYYY" or "DD/MM/YYYY" format
    // Note: Ambiguous dates like 03/06/2026 are tricky.
    // We'll try to guess based on common patterns if new Date() fails.
    const partsMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (partsMatch) {
        const [_, p1, p2, yr] = partsMatch;
        const year = yr.length === 2 ? 2000 + parseInt(yr) : parseInt(yr);
        
        // Try DD/MM/YYYY first
        const d1 = new Date(year, parseInt(p2) - 1, parseInt(p1));
        if (!isNaN(d1.getTime())) return d1;
    }

    return null;
}
