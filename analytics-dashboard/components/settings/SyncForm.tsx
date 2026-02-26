"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cloud, Loader2, Link2, CheckCircle2, AlertCircle } from "lucide-react";

export function SyncForm({ lastUpdated }: { lastUpdated: string | null }) {
    const router = useRouter();
    const [url, setUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    // Load initial URL from localStorage
    useEffect(() => {
        const savedUrl = localStorage.getItem("aahaas_cloud_sheet_url");
        if (savedUrl) setUrl(savedUrl);
    }, []);

    async function handleSync(e: React.FormEvent) {
        e.preventDefault();
        if (!url.trim()) return;

        setIsLoading(true);
        setStatus("idle");
        setMessage("");

        try {
            // Save URL preference
            localStorage.setItem("aahaas_cloud_sheet_url", url);

            const res = await fetch("/api/packages/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to sync");

            setStatus("success");
            setMessage(`Sync successful! Fetched ${data.rowCount} rows.`);

            // If API returned parsed rows, we can store them in localStorage for Vercel
            if (data.rows && data.lastUpdated) {
                localStorage.setItem("aahaas_cloud_cache_rows", JSON.stringify(data.rows));
                localStorage.setItem("aahaas_cloud_cache_date", data.lastUpdated);
            }

            // Refresh the server components to rebuild layout
            router.refresh();

            // Clear success message after 4s
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 4000);

        } catch (err: any) {
            setStatus("error");
            setMessage(err.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Card className="rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-[#111118] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <Cloud className="w-48 h-48 -mt-10 -mr-10" />
            </div>

            <CardHeader className="px-6 pt-5 pb-3">
                <CardTitle className="text-base font-semibold text-blue-900 dark:text-blue-400 flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    Microsoft Cloud Sync
                </CardTitle>
                <CardDescription className="text-blue-700/80 dark:text-blue-300/60">
                    Connect an active Microsoft Cloud Sheet link to dynamically pull the latest data.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-5 relative z-10 space-y-4">
                <form onSubmit={handleSync} className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            type="url"
                            placeholder="https://acme-my.sharepoint.com/:x:/g/personal/..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="pl-9 bg-white dark:bg-black/40 border-slate-200 dark:border-white/10 h-10"
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={isLoading || !url}
                        className="h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-sm sm:w-32 transition-all"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Syncing...
                            </>
                        ) : (
                            "Sync Now"
                        )}
                    </Button>
                </form>

                {status !== "idle" && (
                    <div className={`flex items-start gap-2 p-3 text-sm rounded-lg border ${status === "success"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
                            : "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20"
                        }`}>
                        {status === "success" ? (
                            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        )}
                        <span>{message}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
