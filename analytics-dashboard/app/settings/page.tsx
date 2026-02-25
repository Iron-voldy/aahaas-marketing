import { loadCsv } from "@/lib/loadCsv";
import { inferSchema } from "@/lib/inferSchema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, GitBranch, Table2, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
    const rows = await loadCsv();
    const schema = inferSchema(rows);

    return (
        <div className="flex flex-col gap-6 p-4 lg:p-6">
            <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Dataset info and app configuration
                </p>
            </div>

            {/* Theme */}
            <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm">
                <CardHeader className="px-6 pt-5 pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-violet-500" />
                        Appearance
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Theme</p>
                            <p className="text-xs text-slate-400 mt-0.5">Toggle light / dark mode</p>
                        </div>
                        <ThemeToggle />
                    </div>
                </CardContent>
            </Card>

            {/* Dataset info */}
            <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm">
                <CardHeader className="px-6 pt-5 pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-violet-500" />
                        Dataset
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-5 space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Source file</span>
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-lg">
                            public/data/packages.csv
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Total records</span>
                        <Badge variant="secondary" className="rounded-full text-xs">{rows.length}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Total columns</span>
                        <Badge variant="secondary" className="rounded-full text-xs">{schema.allColumns.length}</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Schema */}
            <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm">
                <CardHeader className="px-6 pt-5 pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-violet-500" />
                        Auto-Detected Schema
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-5 space-y-4">
                    {[
                        { label: "Numeric", cols: schema.numericColumns, color: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" },
                        { label: "Categorical", cols: schema.categoricalColumns, color: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" },
                        { label: "Date", cols: schema.dateColumns, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
                        { label: "High-cardinality", cols: schema.highCardinalityColumns, color: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400" },
                    ].map(({ label, cols, color }) => (
                        <div key={label}>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                {label} ({cols.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {cols.length === 0 ? (
                                    <span className="text-xs text-slate-400">none</span>
                                ) : (
                                    cols.map((col) => (
                                        <span
                                            key={col}
                                            className={`text-xs px-2 py-0.5 rounded-full font-mono ${color}`}
                                        >
                                            {col}
                                        </span>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* CSV replacement info */}
            <Card className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm">
                <CardHeader className="px-6 pt-5 pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-violet-500" />
                        Updating Data
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-5">
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Replace the file at{" "}
                        <code className="font-mono text-xs bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-violet-700 dark:text-violet-300">
                            public/data/packages.csv
                        </code>{" "}
                        with a new export. The app auto-detects column types — no code changes required
                        as long as the CSV has the same multi-row header format.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
