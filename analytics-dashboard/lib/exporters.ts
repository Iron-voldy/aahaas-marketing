import * as XLSX from "xlsx";

function normalizeValue(value: unknown): string | number | boolean {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (value instanceof Date) return value.toISOString();
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function sanitizeFileName(name: string): string {
    return name
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
}

function toRecordRows(data: Record<string, unknown>): Array<{ Field: string; Value: string | number | boolean }> {
    return Object.entries(data).map(([field, value]) => ({
        Field: field,
        Value: normalizeValue(value),
    }));
}

export function exportRecordToXlsx(fileBaseName: string, data: Record<string, unknown>, sheetName = "Details"): void {
    const rows = toRecordRows(data);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
    XLSX.writeFile(workbook, `${sanitizeFileName(fileBaseName)}.xlsx`);
}

export async function exportRecordToPdf(fileBaseName: string, title: string, data: Record<string, unknown>): Promise<void> {
        const rows = toRecordRows(data);
        const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
        if (!popup) {
                throw new Error("Unable to open print preview window");
        }

        const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeRows = rows
                .map(
                        (row) => `<tr><th>${String(row.Field).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</th><td>${String(row.Value).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td></tr>`
                )
                .join("");

        popup.document.open();
        popup.document.write(`
                <html>
                    <head>
                        <title>${safeTitle}</title>
                        <style>
                            @page { size: A4; margin: 16mm; }
                            body { font-family: Arial, sans-serif; margin: 0; color: #0f172a; }
                            .sheet { padding: 8px; }
                            h1 { font-size: 20px; margin: 0 0 6px; }
                            .meta { font-size: 12px; color: #475569; margin-bottom: 16px; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; vertical-align: top; }
                            th { width: 36%; text-align: left; background: #0f172a; color: #e2e8f0; }
                            tr:nth-child(even) td { background: #f8fafc; }
                        </style>
                    </head>
                    <body>
                        <div class="sheet">
                            <h1>${safeTitle}</h1>
                            <div class="meta">Generated: ${new Date().toLocaleString()}</div>
                            <table>${safeRows}</table>
                        </div>
                        <script>
                            window.onload = function () {
                                window.focus();
                                window.print();
                            };
                            window.onafterprint = function () { window.close(); };
                        </script>
                    </body>
                </html>
        `);
        popup.document.close();
}
