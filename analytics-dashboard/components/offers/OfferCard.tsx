"use client";

import Image from "next/image";
import { useState } from "react";
import {
    Sparkles, TrendingUp, Calendar, Eye, Edit2, Trash2,
    Tag, Clock
} from "lucide-react";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SeasonalOffer } from "@/lib/firebase/db";

// Per-category colour palette & emoji
const CATEGORY_THEMES: Record<string, { gradient: string; bg: string; accent: string; emoji: string; badgeClass: string }> = {
    spa: {
        gradient: "from-[#a18cd1] via-[#fbc2eb] to-[#a18cd1]",
        bg: "from-purple-500/10 to-pink-500/10",
        accent: "text-purple-600 dark:text-purple-400",
        emoji: "💆",
        badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    },
    buffet: {
        gradient: "from-[#f7971e] via-[#ffd200] to-[#f7971e]",
        bg: "from-amber-500/10 to-yellow-500/10",
        accent: "text-amber-600 dark:text-amber-400",
        emoji: "🍽️",
        badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    },
    "happy hour": {
        gradient: "from-[#43e97b] via-[#38f9d7] to-[#43e97b]",
        bg: "from-emerald-500/10 to-teal-500/10",
        accent: "text-emerald-600 dark:text-emerald-400",
        emoji: "🍹",
        badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    },
    "weekend getaway": {
        gradient: "from-[#4facfe] via-[#00f2fe] to-[#4facfe]",
        bg: "from-sky-500/10 to-cyan-500/10",
        accent: "text-sky-600 dark:text-sky-400",
        emoji: "🏖️",
        badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    },
    staycation: {
        gradient: "from-[#f093fb] via-[#f5576c] to-[#f093fb]",
        bg: "from-pink-500/10 to-rose-500/10",
        accent: "text-pink-600 dark:text-pink-400",
        emoji: "🏨",
        badgeClass: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    },
};

function getTheme(category: string) {
    const key = category.toLowerCase().trim();
    for (const [k, v] of Object.entries(CATEGORY_THEMES)) {
        if (key.includes(k) || k.includes(key)) return v;
    }
    return {
        gradient: "from-[#667eea] via-[#764ba2] to-[#667eea]",
        bg: "from-violet-500/10 to-purple-500/10",
        accent: "text-violet-600 dark:text-violet-400",
        emoji: "🎁",
        badgeClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    };
}

function fmt(v: unknown): string {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (!isFinite(n)) return "—";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
}

interface OfferCardProps {
    offer: SeasonalOffer;
    onViewDetail: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export function OfferCard({ offer, onViewDetail, onEdit, onDelete }: OfferCardProps) {
    const [imgError, setImgError] = useState(false);
    const theme = getTheme(offer.category || "");
    const showRealImage = !!offer.imageUrl && !imgError;
    const combinedReach = offer.combinedReach ?? ((offer.fbReach ?? 0) + (offer.igReach ?? 0));
    const hasSocialStats = !!(offer.fbReach || offer.igReach);

    return (
        <div
            className={cn(
                "rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col group",
                "bg-white dark:bg-[#111118]",
                "border-slate-200 dark:border-white/5 shadow-sm hover:shadow-xl hover:border-violet-300 dark:hover:border-violet-500/30"
            )}
        >
            {/* ── Hero Image / Gradient Fallback ── */}
            <div className="relative w-full aspect-[4/3] overflow-hidden flex-shrink-0">
                {showRealImage ? (
                    <Image
                        src={offer.imageUrl!}
                        alt={offer.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
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
                            <p className="text-xl font-bold tracking-wide drop-shadow">{offer.name}</p>
                            <p className="text-xs opacity-80 font-medium uppercase tracking-widest">{offer.category}</p>
                        </div>
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                            <span className="text-[10px] text-white/40 font-semibold tracking-widest uppercase">aahaas</span>
                        </div>
                    </div>
                )}

                {/* Category badge */}
                <div className="absolute top-2 left-2 z-10">
                    <Badge className={cn("text-[10px] border-0 shadow-lg rounded-full px-2 py-0.5 font-semibold", theme.badgeClass)}>
                        {theme.emoji} {offer.category}
                    </Badge>
                </div>

                {/* Boosted badge */}
                {offer.isBoosted && (
                    <div className="absolute top-2 right-2 z-10">
                        <Badge className="text-[10px] bg-amber-500 text-white border-0 shadow-lg rounded-full px-2 py-0.5 font-semibold">
                            🎯 Paid
                        </Badge>
                    </div>
                )}
            </div>

            {/* ── Card Body ── */}
            <div className="flex flex-col flex-1 p-4 gap-3">
                {/* Name + Meta */}
                <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <Sparkles className={cn("w-3 h-3 flex-shrink-0", theme.accent)} />
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate" title={offer.name}>
                            {offer.name}
                        </h3>
                    </div>
                    {offer.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 ml-4 mt-0.5">
                            {offer.description}
                        </p>
                    )}
                    <div className="flex items-center gap-3 ml-4 mt-1">
                        {offer.datePublished && (
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                                <Calendar className="w-2.5 h-2.5" />
                                <span>{offer.datePublished}</span>
                            </div>
                        )}
                        {offer.validityPeriod && (
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{offer.validityPeriod}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Price Display */}
                {(offer.price || offer.originalPrice) && (
                    <div className={cn("p-2 rounded-xl bg-gradient-to-r flex items-center gap-2", theme.bg)}>
                        <Tag className={cn("w-3.5 h-3.5 flex-shrink-0", theme.accent)} />
                        <div className="flex items-baseline gap-2">
                            {offer.price && (
                                <span className={cn("text-sm font-bold", theme.accent)}>{offer.price}</span>
                            )}
                            {offer.originalPrice && (
                                <span className="text-xs text-slate-400 line-through">{offer.originalPrice}</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Combined Reach highlight */}
                {hasSocialStats && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
                            <span className="text-xs text-slate-500 dark:text-slate-400">Combined Reach</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {fmt(combinedReach || null)}
                        </span>
                    </div>
                )}

                {/* FB + IG stats */}
                {hasSocialStats && (
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
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(offer.fbReach)}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-400">Reactions</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(offer.fbReactions)}</span>
                                </div>
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
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(offer.igReach)}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-400">Saves</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(offer.igSaves)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-auto pt-1">
                    <Button
                        size="sm"
                        variant="outline"
                        className="px-2.5 h-8 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-white/10"
                        onClick={onEdit}
                        type="button"
                        title="Edit Offer"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                        size="sm"
                        className={cn("flex-1 h-8 rounded-xl text-white text-xs font-semibold gap-1.5 bg-violet-600 hover:bg-violet-700")}
                        onClick={onViewDetail}
                        type="button"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        View Stats
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        className="px-2.5 h-8 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 border-slate-200 dark:border-white/10"
                        onClick={onDelete}
                        type="button"
                        title="Delete Offer"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
