"use client";

import Image from "next/image";
import { X, TrendingUp, Tag, Clock, Calendar, Sparkles, Users, DollarSign, ExternalLink } from "lucide-react";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SeasonalOffer } from "@/lib/db";

function fmt(v: unknown): string {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (!isFinite(n)) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
}

const CATEGORY_THEMES: Record<string, { gradient: string; accent: string; emoji: string; badgeClass: string }> = {
    spa: { gradient: "from-purple-500 to-pink-500", accent: "text-purple-600 dark:text-purple-400", emoji: "💆", badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    buffet: { gradient: "from-amber-500 to-yellow-400", accent: "text-amber-600 dark:text-amber-400", emoji: "🍽️", badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    "happy hour": { gradient: "from-emerald-500 to-teal-400", accent: "text-emerald-600 dark:text-emerald-400", emoji: "🍹", badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    "weekend getaway": { gradient: "from-sky-500 to-cyan-400", accent: "text-sky-600 dark:text-sky-400", emoji: "🏖️", badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
    staycation: { gradient: "from-pink-500 to-rose-400", accent: "text-pink-600 dark:text-pink-400", emoji: "🏨", badgeClass: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300" },
};

function getTheme(category: string) {
    const key = category.toLowerCase().trim();
    for (const [k, v] of Object.entries(CATEGORY_THEMES)) {
        if (key.includes(k) || k.includes(key)) return v;
    }
    return { gradient: "from-violet-500 to-purple-600", accent: "text-violet-600 dark:text-violet-400", emoji: "🎁", badgeClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" };
}

interface StatRowProps { label: string; value: unknown; icon?: React.ReactNode }
function StatRow({ label, value, icon }: StatRowProps) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                {icon}
                {label}
            </div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{fmt(value)}</span>
        </div>
    );
}

interface OfferDetailModalProps {
    offer: SeasonalOffer | null;
    open: boolean;
    onClose: () => void;
}

export function OfferDetailModal({ offer, open, onClose }: OfferDetailModalProps) {
    if (!open || !offer) return null;

    const theme = getTheme(offer.category || "");
    const combinedReach = offer.combinedReach ?? ((offer.fbReach ?? 0) + (offer.igReach ?? 0));
    const hasSocialStats = !!(offer.fbReach || offer.igReach);
    const postUrl = (offer.postUrl as string) || "";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#111118] shadow-2xl border border-slate-200 dark:border-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Images Container */}
                <div className={cn("relative bg-gradient-to-br p-6 pt-16 flex flex-col justify-end min-h-[12rem]", theme.gradient, offer.imageUrls && offer.imageUrls.length > 0 ? "" : "pb-6")}>
                    {/* Background Images Layer */}
                    {offer.imageUrls && offer.imageUrls.length > 0 ? (
                        <div className="absolute inset-0 overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory hide-scrollbar">
                            {offer.imageUrls.map((url, i) => (
                                <div key={url} className="relative w-full h-full flex-shrink-0 snap-center">
                                    <Image src={url} alt={`${offer.name} ${i + 1}`} fill className="object-cover" />
                                </div>
                            ))}
                        </div>
                    ) : offer.imageUrl ? (
                        <Image src={offer.imageUrl} alt={offer.name} fill className="object-cover" />
                    ) : null}

                    {/* Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

                    {/* Header Info */}
                    <div className="relative z-10 mt-auto">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className={cn("text-xs border-0 rounded-full px-3 py-1 font-semibold", theme.badgeClass)}>
                                {theme.emoji} {offer.category}
                            </Badge>
                            {offer.postType === "group" && (
                                <Badge className="text-[10px] bg-white/20 text-white hover:bg-white/30 border-0 rounded-full">
                                    Group Post
                                </Badge>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-white drop-shadow">{offer.name}</h2>
                        {offer.description && (
                            <p className="text-sm text-white/80 mt-1 max-w-md">{offer.description}</p>
                        )}
                        {/* Pagination indicators if multiple urls */}
                        {offer.imageUrls && offer.imageUrls.length > 1 && (
                            <div className="flex gap-1.5 mt-3">
                                {offer.imageUrls.map((_, i) => (
                                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/50" />
                                ))}
                                <span className="text-[10px] text-white/50 ml-1">Scroll to see more</span>
                            </div>
                        )}
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 z-20 text-white hover:bg-white/20 rounded-full"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Meta info */}
                    <div className="flex flex-wrap gap-3">
                        {offer.datePublished && (
                            <div className="flex items-center gap-1.5 text-sm text-slate-500 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg">
                                <Calendar className="w-3.5 h-3.5" />
                                {offer.datePublished}
                            </div>
                        )}
                        {offer.validityPeriod && (
                            <div className="flex items-center gap-1.5 text-sm text-slate-500 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg">
                                <Clock className="w-3.5 h-3.5" />
                                {offer.validityPeriod}
                            </div>
                        )}
                        {offer.isBoosted && (
                            <div className="flex items-center gap-1.5 text-sm text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg font-medium">
                                🎯 Paid Boost
                            </div>
                        )}
                        {postUrl && (
                            <a href={postUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 px-3 py-1.5 rounded-lg font-medium hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" />
                                View Post
                            </a>
                        )}
                    </div>

                    {/* Pricing */}
                    {(offer.price || offer.originalPrice) && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center gap-3">
                            <Tag className={cn("w-5 h-5", theme.accent)} />
                            <div className="flex items-baseline gap-3">
                                {offer.price && <span className={cn("text-xl font-bold", theme.accent)}>{offer.price}</span>}
                                {offer.originalPrice && <span className="text-sm text-slate-400 line-through">{offer.originalPrice}</span>}
                            </div>
                        </div>
                    )}

                    {/* Social stats */}
                    {hasSocialStats && (
                        <>
                            {/* Combined reach highlight */}
                            <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-violet-500" />
                                    <span className="text-sm font-medium text-violet-700 dark:text-violet-300">Combined Reach</span>
                                </div>
                                <span className="text-2xl font-bold text-violet-700 dark:text-violet-300">{fmt(combinedReach)}</span>
                            </div>

                            {/* Platform breakdown */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Facebook */}
                                <div className="p-4 rounded-xl bg-[#1877F2]/5 dark:bg-[#1877F2]/10 border border-[#1877F2]/10">
                                    <div className="flex items-center gap-2 mb-3">
                                        <FacebookLogo className="w-5 h-5" />
                                        <span className="font-bold text-[#1877F2] text-sm uppercase tracking-wide">Facebook</span>
                                    </div>
                                    <StatRow label="Reach" value={offer.fbReach} />
                                    <StatRow label="Reactions" value={offer.fbReactions} />
                                    <StatRow label="Comments" value={offer.fbComments} />
                                    <StatRow label="Shares" value={offer.fbShares} />
                                    <StatRow label="Clicks" value={offer.fbClicks} />
                                </div>

                                {/* Instagram */}
                                <div className="p-4 rounded-xl bg-pink-500/5 dark:bg-pink-500/10 border border-pink-500/10">
                                    <div className="flex items-center gap-2 mb-3">
                                        <InstagramLogo className="w-5 h-5" />
                                        <span className="font-bold text-pink-500 text-sm uppercase tracking-wide">Instagram</span>
                                    </div>
                                    <StatRow label="Reach" value={offer.igReach} />
                                    <StatRow label="Reactions" value={offer.igReactions} />
                                    <StatRow label="Comments" value={offer.igComments} />
                                    <StatRow label="Shares" value={offer.igShares} />
                                    <StatRow label="Saves" value={offer.igSaves} />
                                </div>
                            </div>

                            {/* Boost stats */}
                            {offer.isBoosted && (offer.adSpend || offer.conversations || offer.impressions) && (
                                <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10">
                                    <h4 className="font-semibold text-amber-700 dark:text-amber-400 text-sm mb-3 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" /> Boost Results
                                    </h4>
                                    {offer.adSpend && <StatRow label="Ad Spend" value={`$${Number(offer.adSpend).toFixed(2)}`} icon={<DollarSign className="w-3.5 h-3.5" />} />}
                                    {offer.conversations && <StatRow label="Conversations" value={offer.conversations} icon={<Users className="w-3.5 h-3.5" />} />}
                                    {offer.impressions && <StatRow label="Impressions" value={offer.impressions} icon={<TrendingUp className="w-3.5 h-3.5" />} />}
                                </div>
                            )}
                        </>
                    )}

                    {!hasSocialStats && (
                        <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-center text-sm text-slate-400">
                            No social media stats recorded yet for this offer.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
