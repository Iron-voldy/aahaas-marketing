import type { Row } from "@/lib/types";
import { parseFlexibleDate } from "@/lib/inferSchema";

const PRIORITY_PUBLISHED_DATE_COLUMNS = [
    "Date Published",
    "date_published",
    "datePublished",
    "publish_time",
    "publishTime",
];

export function getPublishedDateColumn(dateColumns: string[] = []): string | undefined {
    return PRIORITY_PUBLISHED_DATE_COLUMNS.find((column) => dateColumns.includes(column)) ?? dateColumns[0];
}

export function getPublishedDate(row: Row, dateColumns: string[] = []): Date | null {
    const candidateColumns = [
        ...PRIORITY_PUBLISHED_DATE_COLUMNS,
        ...dateColumns.filter((column) => !PRIORITY_PUBLISHED_DATE_COLUMNS.includes(column)),
    ];

    for (const column of candidateColumns) {
        const rawValue = row[column];
        if (!rawValue) continue;

        const parsedDate = parseFlexibleDate(rawValue);
        if (parsedDate && !isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }

    return null;
}

export function sortRowsByPublishedDate(rows: Row[], dateColumns: string[] = []): Row[] {
    return [...rows].sort((a, b) => {
        const dateA = getPublishedDate(a, dateColumns);
        const dateB = getPublishedDate(b, dateColumns);

        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;

        return dateB.getTime() - dateA.getTime();
    });
}
