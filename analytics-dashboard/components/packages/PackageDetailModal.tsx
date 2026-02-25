"use client";

import { X, TrendingUp, BarChart2, ChevronRight } from "lucide-react";
import {
    ResponsiveContainer,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
    Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";
import type { Row } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmt(v: unknown, decimals = 0): string {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (!isFinite(n)) return String(v);
    if (decimals > 0) return n.toFixed(decimals);
    return n.toLocaleString();
}

// Always use Aahaas brand red for the header
const BRAND_RED = "#e62b2b";


interface PackageDetailModalProps {
    row: Row | null;
    open: boolean;
    onClose: () => void;
}

export function PackageDetailModal({ row, open, onClose }: PackageDetailModalProps) {
    if (!row) return null;

    const country = String(row["country"] ?? "Unknown");
    const datePublished = String(row["date_published"] ?? "");
    const validity = String(row["validity_period"] ?? "");

    const keys = Object.keys(row);
    const g = (prefix: string, word: string) =>
        keys.find((k) => k.startsWith(prefix) && k.includes(word));

    const fbReach = g("fb_", "reach");
    const igReach = g("ig_", "reach");
    const totalReach = keys.find((k) => k.includes("total") && k.includes("reach"));
    const fbReact = g("fb_", "react");
    const igReact = g("ig_", "react");
    const fbShare = g("fb_", "share");
    const igShare = g("ig_", "share");
    const fbSave = g("fb_", "save");
    const igSave = g("ig_", "save");
    const fbComment = g("fb_", "comment");
    const igComment = g("ig_", "comment");
    const fbClicks = keys.find((k) => k.startsWith("fb_") && k.includes("click") && !k.includes("link"));
    const linkClicks = g("fb_", "link");
    const convCol = keys.find((k) => k.includes("conversation"));
    const spendCol = keys.find((k) => k.includes("spend"));
    const cprCol = keys.find((k) => k.includes("cpr"));
    const impressionsCol = keys.find((k) => k.includes("impression"));
    const adsReach = keys.find((k) => k.startsWith("ads_") && k.includes("reach"));
    const objective = keys.find((k) => k.includes("objective"));
    const startDate = keys.find((k) => k.startsWith("ads_") && k.includes("start"));
    const endDate = keys.find((k) => k.startsWith("ads_") && k.includes("end"));

    // Bar chart data for engagement comparison
    const engagementData = [
        { metric: "Reactions", fb: Number(fbReact ? row[fbReact] : 0), ig: Number(igReact ? row[igReact] : 0) },
        { metric: "Comments", fb: Number(fbComment ? row[fbComment] : 0), ig: Number(igComment ? row[igComment] : 0) },
        { metric: "Shares", fb: Number(fbShare ? row[fbShare] : 0), ig: Number(igShare ? row[igShare] : 0) },
        { metric: "Saves", fb: Number(fbSave ? row[fbSave] : 0), ig: Number(igSave ? row[igSave] : 0) },
    ].filter(d => d.fb > 0 || d.ig > 0);

    const hasPaidAds = spendCol && row[spendCol] !== null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            {/* Explicit solid white/dark background — never transparent */}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-0 shadow-2xl bg-white dark:bg-[#111118] text-slate-900 dark:text-white [&>button]:hidden">
                {/* Brand red header */}
                <div className="relative p-6" style={{ background: `linear-gradient(135deg, ${BRAND_RED} 0%, #c01f1f 100%)` }}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 w-8 h-8 text-white/80 hover:text-white hover:bg-white/20 rounded-lg"
                        onClick={onClose}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                    {/* Brand logo area */}
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-[11px] font-bold tracking-[0.2em] text-white/60 uppercase">Aahaas Analytics</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">{country}</h2>
                    <p className="text-white/75 text-sm mt-1">{datePublished.split(",")[0]}</p>
                    {validity && (
                        <p className="text-white/55 text-xs mt-0.5">Valid until: {validity}</p>
                    )}
                    {totalReach && row[totalReach] !== null && (
                        <div className="mt-3 inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
                            <TrendingUp className="w-4 h-4 text-white" />
                            <span className="text-white font-bold text-sm">{fmt(row[totalReach])} total reach</span>
                        </div>
                    )}
                </div>

                <div className="p-5 space-y-5">
                    {/* FB vs IG side by side */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Facebook */}
                        <div className="rounded-xl border border-[#1877F2]/20 bg-[#1877F2]/5 dark:bg-[#1877F2]/10 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <FacebookLogo className="w-5 h-5" />
                                <span className="font-bold text-[#1877F2] text-sm">Facebook</span>
                            </div>
                            {[
                                ["Reach", fbReach ? row[fbReach] : null],
                                ["Reactions", fbReact ? row[fbReact] : null],
                                ["Comments", fbComment ? row[fbComment] : null],
                                ["Shares", fbShare ? row[fbShare] : null],
                                ["Saves", fbSave ? row[fbSave] : null],
                                ["Total Clicks", fbClicks ? row[fbClicks] : null],
                                ["Link Clicks", linkClicks ? row[linkClicks] : null],
                            ].map(([label, val]) => (
                                <div key={String(label)} className="flex justify-between py-1 border-b border-[#1877F2]/10 last:border-0">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
                                    <span className="text-xs font-semibold text-slate-800 dark:text-white">{fmt(val)}</span>
                                </div>
                            ))}
                        </div>

                        {/* Instagram */}
                        <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 dark:bg-pink-500/10 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <InstagramLogo className="w-5 h-5" />
                                <span className="font-bold text-pink-500 text-sm">Instagram</span>
                            </div>
                            {[
                                ["Reach", igReach ? row[igReach] : null],
                                ["Reactions", igReact ? row[igReact] : null],
                                ["Comments", igComment ? row[igComment] : null],
                                ["Shares", igShare ? row[igShare] : null],
                                ["Saves", igSave ? row[igSave] : null],
                            ].map(([label, val]) => (
                                <div key={String(label)} className="flex justify-between py-1 border-b border-pink-500/10 last:border-0">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
                                    <span className="text-xs font-semibold text-slate-800 dark:text-white">{fmt(val)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Engagement Chart */}
                    {engagementData.length > 0 && (
                        <div className="rounded-xl border border-slate-100 dark:border-white/5 p-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <BarChart2 className="w-3.5 h-3.5" />
                                FB vs IG Engagement
                            </p>
                            <ResponsiveContainer width="100%" height={160}>
                                <BarChart data={engagementData} barGap={4}>
                                    <XAxis dataKey="metric" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={28} />
                                    <Tooltip
                                        contentStyle={{
                                            background: "rgba(17,17,24,0.95)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            borderRadius: "10px",
                                            fontSize: "11px",
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                                    <Bar dataKey="fb" name="Facebook" fill="#1877F2" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                    <Bar dataKey="ig" name="Instagram" fill="#e1306c" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Paid Ads section */}
                    {hasPaidAds && (
                        <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-4">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                🎯 Paid Ad Campaign
                            </p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                {[
                                    ["Objective", objective ? row[objective] : null],
                                    ["Start Date", startDate ? row[startDate] : null],
                                    ["End Date", endDate ? row[endDate] : null],
                                    ["Conversations", convCol ? row[convCol] : null],
                                    ["Ad Spend", spendCol ? `$${Number(row[spendCol]).toFixed(2)}` : null],
                                    ["CPR", cprCol ? `$${Number(row[cprCol]).toFixed(2)}` : null],
                                    ["Impressions", impressionsCol ? row[impressionsCol] : null],
                                    ["Paid Reach", adsReach ? row[adsReach] : null],
                                ].map(([label, val]) => val !== null && val !== undefined && (
                                    <div key={String(label)} className="flex justify-between py-1 border-b border-amber-100 dark:border-amber-500/10 last:border-0">
                                        <span className="text-xs text-amber-600 dark:text-amber-400/70">{label}</span>
                                        <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">{fmt(val)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
