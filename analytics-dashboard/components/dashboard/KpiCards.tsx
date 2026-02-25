"use client";

import { TrendingUp, BarChart2, DollarSign, MessageCircle, Package, Users } from "lucide-react";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { KpiCard as KpiCardType } from "@/lib/types";
import { cn } from "@/lib/utils";

// Map icon name → component; fb/ig use official logo SVGs
function getIcon(iconName: string | undefined): React.ReactNode {
    switch (iconName) {
        case "facebook": return <FacebookLogo className="w-5 h-5" />;
        case "instagram": return <InstagramLogo className="w-5 h-5" />;
        case "bar-chart-2": return <BarChart2 className="w-5 h-5 text-white" />;
        case "dollar-sign": return <DollarSign className="w-5 h-5 text-white" />;
        case "message-circle": return <MessageCircle className="w-5 h-5 text-white" />;
        case "package": return <Package className="w-5 h-5 text-white" />;
        case "users": return <Users className="w-5 h-5 text-white" />;
        default: return <TrendingUp className="w-5 h-5 text-white" />;
    }
}

// Colour scheme per card index — Facebook=blue, Instagram=gradient-pink, etc.
const colorClasses = [
    { gradient: "from-violet-500 to-purple-700", shadow: "shadow-violet-500/20", bg: "bg-violet-500" },
    { gradient: "from-[#1877F2] to-[#0a5fc8]", shadow: "shadow-blue-500/20", bg: "bg-[#1877F2]" },  // FB blue
    { gradient: "from-[#e1306c] to-[#833ab4]", shadow: "shadow-pink-500/20", bg: "bg-[#e1306c]" },  // IG gradient
    { gradient: "from-amber-500 to-orange-600", shadow: "shadow-amber-500/20", bg: "bg-amber-500" },
    { gradient: "from-emerald-500 to-teal-600", shadow: "shadow-emerald-500/20", bg: "bg-emerald-500" },
    { gradient: "from-indigo-500 to-violet-600", shadow: "shadow-indigo-500/20", bg: "bg-indigo-500" },
];

function KpiCardItem({ card, index }: { card: KpiCardType; index: number }) {
    const color = colorClasses[index % colorClasses.length];
    const icon = getIcon(card.icon);

    return (
        <Card className="border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl overflow-hidden">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                            {card.label}
                        </p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white truncate">
                            {card.prefix && <span className="text-lg">{card.prefix}</span>}
                            {card.value}
                            {card.suffix && (
                                <span className="text-base text-slate-500 dark:text-slate-400 font-normal ml-1">
                                    {card.suffix}
                                </span>
                            )}
                        </p>
                    </div>
                    {/* Icon badge — FB/IG logos are already colored, others get gradient bg */}
                    <div
                        className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg",
                            card.icon === "facebook" || card.icon === "instagram"
                                ? "" // logos carry their own colors, just show them raw on a subtle bg
                                : `bg-gradient-to-br ${color.gradient} ${color.shadow}`,
                            (card.icon === "facebook")
                                ? "bg-[#1877F2]/10 dark:bg-[#1877F2]/20"
                                : (card.icon === "instagram")
                                    ? "bg-pink-500/10 dark:bg-pink-500/20"
                                    : ""
                        )}
                    >
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function KpiCards({ cards }: { cards: KpiCardType[] }) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {cards.map((card, i) => (
                <KpiCardItem key={card.label} card={card} index={i} />
            ))}
        </div>
    );
}

export function KpiCardsSkeleton() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="border border-slate-200 dark:border-white/5 rounded-2xl">
                    <CardContent className="p-5">
                        <Skeleton className="h-3 w-20 mb-2" />
                        <Skeleton className="h-7 w-28" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
