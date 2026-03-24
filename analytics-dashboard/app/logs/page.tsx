"use client";

import { useEffect, useState } from "react";
import { getLogs, type AuditLog } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ClipboardList, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";

export default function AccessLogsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (!user) return;
        getLogs()
            .then(setLogs)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [user]);

    if (loading || isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                    <ClipboardList className="w-8 h-8 text-violet-500" />
                    Access Logs
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                    Review administrative login history and secure authentication events.
                </p>
            </div>

            <Card className="border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-black/20 border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <ShieldAlert className="w-5 h-5 text-emerald-500" />
                        Authentication History
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {logs.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">
                            No logs found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 dark:bg-black/10 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Timestamp</th>
                                        <th className="px-6 py-4 font-medium">User Account</th>
                                        <th className="px-6 py-4 font-medium">Action Event</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => {
                                        let dateObj = new Date(log.timestamp);
                                        let dateStr = "Invalid Date";
                                        if (!isNaN(dateObj.getTime())) {
                                            dateStr = dateObj.toLocaleString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                                hour: "numeric",
                                                minute: "2-digit",
                                                hour12: true
                                            });
                                        }

                                        return (
                                            <tr
                                                key={log.id}
                                                className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                                            >
                                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                                                    {dateStr}
                                                </td>
                                                <td className="px-6 py-4 text-violet-600 dark:text-violet-400 font-medium">
                                                    {log.email}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                    {log.action}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
