"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, Eye, TrendingUp, MapPin, Calendar, Users, AlertCircle } from "lucide-react";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/types";

// Destination gradients & emoji for fallback
const DESTINATION_THEMES: Record<
    string,
    { gradient: string; emoji: string }
> = {
    singapore: { gradient: "from-[#667eea] via-[#764ba2] to-[#f093fb]", emoji: "🦁" },
    malaysia: { gradient: "from-[#11998e] via-[#38ef7d] to-[#11998e]", emoji: "🏙️" },
    maldives: { gradient: "from-[#2af598] via-[#009efd] to-[#15aabf]", emoji: "🏝️" },
    "india - kerala": { gradient: "from-[#f7971e] via-[#ffd200] to-[#f7971e]", emoji: "🌴" },
    kerala: { gradient: "from-[#f7971e] via-[#ffd200] to-[#f7971e]", emoji: "🌴" },
    "malaysia - langkawi": { gradient: "from-[#0575e6] via-[#021b79] to-[#0575e6]", emoji: "⛵" },
    langkawi: { gradient: "from-[#0575e6] via-[#021b79] to-[#0575e6]", emoji: "⛵" },
};

function getTheme(country: string) {
    const key = country.toLowerCase().trim();
    for (const [k, v] of Object.entries(DESTINATION_THEMES)) {
        if (key.includes(k) || k.includes(key)) return v;
    }
    return { gradient: "from-[#8b5cf6] via-[#6d28d9] to-[#4c1d95]", emoji: "✈️" };
}

function fmt(v: unknown): string {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (!isFinite(n)) return "—";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
}

function getStats(row: Row) {
    const keys = Object.keys(row);
    const totalReachCol = keys.find(k => (k.includes("total") && k.includes("reach")) || k === "Combined Reach");
    const fbReachCol = keys.find(k => (k.startsWith("fb_") && k.includes("reach")) || k === "FB Reach");
    const igReachCol = keys.find(k => (k.startsWith("ig_") && k.includes("reach")) || k === "IG Reach");
    const fbReactCol = keys.find(k => (k.startsWith("fb_") && k.includes("react")) || k === "FB Interactions (Reactions)");
    const igReactCol = keys.find(k => (k.startsWith("ig_") && k.includes("react")) || k === "IG Interactions (Reactions)");
    const fbClicksCol = keys.find(k => (k.startsWith("fb_") && k.includes("click") && !k.includes("link")) || k === "FB Total Clicks");
    const igSaveCol = keys.find(k => (k.startsWith("ig_") && k.includes("save")) || k === "IG Interactions (Saves)");
    const convCol = keys.find(k => k.includes("conversation") || k === "FB + IG Messaging Conversations Started");
    const spendCol = keys.find(k => k.includes("spend") || k === "Amount Spent (USD)");
    return {
        totalReach: totalReachCol ? row[totalReachCol] : null,
        fbReach: fbReachCol ? row[fbReachCol] : null,
        igReach: igReachCol ? row[igReachCol] : null,
        fbReactions: fbReactCol ? row[fbReactCol] : null,
        igReactions: igReactCol ? row[igReactCol] : null,
        fbClicks: fbClicksCol ? row[fbClicksCol] : null,
        igSaves: igSaveCol ? row[igSaveCol] : null,
        conversations: convCol ? row[convCol] : null,
        adSpend: spendCol ? row[spendCol] : null,
        isPaid: spendCol ? (row[spendCol] !== null && row[spendCol] !== undefined && row[spendCol] !== "") : false,
    };
}

interface PackageCardProps {
    row: Row;
    index: number;
    isSelected: boolean;
    onToggleSelect: () => void;
    onViewDetail: () => void;
    imagePath?: string | null;
}

export function PackageCard({
    row,
    index,
    isSelected,
    onToggleSelect,
    onViewDetail,
    imagePath,
}: PackageCardProps) {
    const [imgError, setImgError] = useState(false);
    const country = String(row["Package"] || row["package"] || row["country"] || "Unknown");
    const datePublished = String(row["date_published"] ?? "");
    const theme = getTheme(country);
    const stats = getStats(row);
    const shortDate = datePublished.split(",")[0].trim();
    const showRealImage = !!imagePath && !imgError;

    return (
        <div
            className={cn(
                "rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col",
                "bg-white dark:bg-[#111118]",
                isSelected
                    ? "border-violet-500 shadow-xl shadow-violet-500/20 ring-2 ring-violet-500/30"
                    : "border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-500/30"
            )}
        >
            {/* ── Flyer Image Area ── */}
            <div className="relative w-full aspect-[4/3] overflow-hidden flex-shrink-0">
                {showRealImage ? (
                    <Image
                        src={imagePath!}
                        alt={`${country} package flyer`}
                        fill
                        className="object-cover transition-transform duration-500 hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div
                        className={cn(
                            "absolute inset-0 bg-gradient-to-br flex flex-col items-center justify-center",
                            theme.gradient
                        )}
                    >
                        <div className="absolute top-3 right-3 w-20 h-20 rounded-full bg-white/10 blur-xl" />
                        <div className="absolute bottom-4 left-4 w-16 h-16 rounded-full bg-white/10 blur-lg" />
                        <div className="relative z-10 flex flex-col items-center gap-2 text-white px-4 text-center">
                            <span className="text-5xl drop-shadow-lg select-none">{theme.emoji}</span>
                            <p className="text-xl font-bold tracking-wide drop-shadow">{country}</p>
                            <p className="text-xs opacity-80 font-medium uppercase tracking-widest">Travel Package</p>
                        </div>
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                            <span className="text-[10px] text-white/40 font-semibold tracking-widest uppercase">aahaas</span>
                        </div>
                    </div>
                )}

                {/* Paid badge */}
                {stats.isPaid && (
                    <div className="absolute top-2 left-2 z-10">
                        <Badge className="text-[10px] bg-amber-500 text-white border-0 shadow-lg rounded-full px-2 py-0.5 font-semibold">
                            🎯 Paid
                        </Badge>
                    </div>
                )}

                {/* Package number badge */}
                <div className="absolute top-2 right-2 z-10">
                    <span className="text-[10px] font-bold text-white bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                        #{index + 1}
                    </span>
                </div>
            </div>

            {/* ── Card Body ── */}
            <div className="flex flex-col flex-1 p-4 gap-3">
                {/* Country + Date */}
                <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <MapPin className="w-3 h-3 text-violet-500 flex-shrink-0" />
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate">{country}</h3>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 ml-4">
                        <Calendar className="w-2.5 h-2.5" />
                        <span className="truncate">{shortDate}</span>
                    </div>
                </div>

                {/* Total Reach highlight */}
                {stats.totalReach !== null && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
                            <span className="text-xs text-slate-500 dark:text-slate-400">Combined Reach</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {fmt(stats.totalReach)}
                        </span>
                    </div>
                )}

                {/* Facebook / Instagram stats side by side */}
                <div className="grid grid-cols-2 gap-2">
                    {/* FB */}
                    <div className="p-2 rounded-xl bg-[#1877F2]/5 dark:bg-[#1877F2]/10 border border-[#1877F2]/10">
                        <div className="flex items-center gap-1 mb-1.5">
                            <FacebookLogo className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold text-[#1877F2] uppercase tracking-wide">FB</span>
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">Reach</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(stats.fbReach)}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">Reactions</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(stats.fbReactions)}</span>
                            </div>
                            {stats.fbClicks !== null && (
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-400">Clicks</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(stats.fbClicks)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* IG */}
                    <div className="p-2 rounded-xl bg-pink-500/5 dark:bg-pink-500/10 border border-pink-500/10">
                        <div className="flex items-center gap-1 mb-1.5">
                            <InstagramLogo className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold text-pink-500 uppercase tracking-wide">IG</span>
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">Reach</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(stats.igReach)}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">Reactions</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(stats.igReactions)}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">Saves</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(stats.igSaves)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Paid Ad row (if applicable) */}
                {stats.isPaid && (stats.conversations !== null || stats.adSpend !== null) && (
                    <div className="p-2 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 flex items-center justify-between gap-2">
                        {stats.conversations !== null && (
                            <div className="flex items-center gap-1.5">
                                <Users className="w-3 h-3 text-amber-500" />
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">Conv:</span>
                                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{fmt(stats.conversations)}</span>
                            </div>
                        )}
                        {stats.adSpend !== null && (
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 ml-auto">
                                ${Number(stats.adSpend).toFixed(2)} spent
                            </span>
                        )}
                    </div>
                )}

                {/* Action buttons — always visible at bottom */}
                <div className="flex gap-2 mt-auto pt-1">
                    {/* View Stats — always visible, no hover needed */}
                    <Button
                        size="sm"
                        className="flex-1 h-8 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold gap-1.5"
                        onClick={onViewDetail}
                        type="button"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        View Stats
                    </Button>

                    {/* Compare toggle */}
                    <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                            "h-8 rounded-xl text-xs font-semibold px-3",
                            isSelected
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                                : "border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600"
                        )}
                        onClick={onToggleSelect}
                        type="button"
                    >
                        {isSelected ? <><Check className="w-3.5 h-3.5" /> Selected</> : "Compare"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
