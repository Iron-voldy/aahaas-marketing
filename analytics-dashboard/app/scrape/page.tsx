"use client";

import { useState } from "react";
import { getPackages, getOffers } from "@/lib/firebase/db";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, Database, Download } from "lucide-react";

type LogEntry = { type: "info" | "success" | "error"; msg: string };

export default function ScrapePage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [isDone, setIsDone] = useState(false);

    const log = (type: LogEntry["type"], msg: string) => {
        setLogs((prev) => [...prev, { type, msg }]);
        console.log(`[scrape] [${type}] ${msg}`);
    };

    const handleScrape = async () => {
        setIsRunning(true);
        setIsDone(false);
        setLogs([]);

        try {
            // ── Step 1: Fetch packages from Firebase ─────────────────────────
            log("info", "Fetching packages from Firebase...");
            let packages: any[] = [];
            try {
                packages = await getPackages();
                log("success", `Found ${packages.length} packages`);
                packages.forEach((pkg, i) => {
                    const name = pkg.Package || pkg.country || pkg.Country || "Unknown";
                    const dest = pkg.Destination || pkg.destination || "";
                    const imgCount = (pkg.imageUrls || []).length;
                    log("info", `  Package ${i + 1}: "${name}" — Dest: ${dest}, Images: ${imgCount}, PostURL: ${pkg.postUrl || "none"}`);
                });
            } catch (err: any) {
                log("error", `Failed to fetch packages: ${err.message}`);
            }

            // ── Step 2: Fetch offers from Firebase ───────────────────────────
            log("info", "Fetching seasonal offers from Firebase...");
            let offers: any[] = [];
            try {
                offers = await getOffers();
                log("success", `Found ${offers.length} seasonal offers`);
                offers.forEach((offer, i) => {
                    const imgCount = (offer.imageUrls || []).length;
                    log("info", `  Offer ${i + 1}: "${offer.name}" — Cat: ${offer.category}, Images: ${imgCount}, FB: ${offer.fbReach ?? 0}, IG: ${offer.igReach ?? 0}`);
                });
            } catch (err: any) {
                log("error", `Failed to fetch offers: ${err.message}`);
            }

            if (packages.length === 0 && offers.length === 0) {
                log("error", "No data to migrate!");
                setIsRunning(false);
                return;
            }

            // ── Step 3: Send to MySQL via API ────────────────────────────────
            log("info", `Sending ${packages.length} packages + ${offers.length} offers to MySQL...`);
            const resp = await fetch("/api/migrate/firebase-to-mysql", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ packages, offers }),
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || `HTTP ${resp.status}`);
            }

            const result = await resp.json();
            log("success", `MySQL migration complete: ${result.packages} packages, ${result.offers} offers`);
            if (result.errors && result.errors.length > 0) {
                result.errors.forEach((e: string) => log("error", `  Error: ${e}`));
            }

            // ── Step 4: Dump JSON to console for backup ──────────────────────
            console.log("\n=== FULL PACKAGES DATA (JSON) ===");
            console.log(JSON.stringify(packages, null, 2));
            console.log("\n=== FULL OFFERS DATA (JSON) ===");
            console.log(JSON.stringify(offers, null, 2));

            log("success", "All data also logged to browser console (F12 → Console) as JSON backup");
            setIsDone(true);
        } catch (err: any) {
            log("error", `Fatal error: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0f] p-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <Database className="w-8 h-8 text-indigo-600" />
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Firebase → MySQL Migration
                        </h1>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        This page reads data from Firebase (using your browser auth session)
                        and inserts it into the local MySQL database.
                    </p>
                </div>

                <div className="flex justify-center mb-6">
                    <Button
                        onClick={handleScrape}
                        disabled={isRunning}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 text-base"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Migrating...
                            </>
                        ) : isDone ? (
                            <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Run Again
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                Start Scrape &amp; Migrate
                            </>
                        )}
                    </Button>
                </div>

                {/* Log output */}
                {logs.length > 0 && (
                    <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs space-y-1 max-h-[60vh] overflow-auto">
                        {logs.map((entry, i) => (
                            <div
                                key={i}
                                className={
                                    entry.type === "success"
                                        ? "text-green-400"
                                        : entry.type === "error"
                                        ? "text-red-400"
                                        : "text-slate-300"
                                }
                            >
                                {entry.type === "success" && "✓ "}
                                {entry.type === "error" && "✗ "}
                                {entry.msg}
                            </div>
                        ))}
                    </div>
                )}

                {isDone && (
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-center">
                        <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                            Migration Complete!
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            All Firebase data is now in MySQL. You can switch the app back to MySQL mode.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
