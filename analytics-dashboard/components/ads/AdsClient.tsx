"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
    Megaphone, Upload, Search, X, Trash2, Download, RefreshCw,
    Loader2, TrendingUp, TrendingDown, DollarSign, Eye, MousePointerClick,
    Users, BarChart2, ChevronDown, ChevronUp, Info, FileSpreadsheet,
    Filter, ArrowUpDown, LayoutGrid, List as ListIcon, Calendar,
    BookOpen, ImagePlus, Images, Pencil, Save,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AdCampaign {
    id: number;
    batch_id: string;
    reporting_starts: string | null;
    reporting_ends: string | null;
    ad_name: string;
    objective: string | null;
    ad_delivery: string | null;
    results: number;
    result_indicator: string | null;
    reach: number;
    frequency: number;
    cost_per_result: number;
    ad_set_budget: string | null;
    ad_set_budget_type: number;
    amount_spent_usd: number;
    ends: string | null;
    impressions: number;
    views: number;
    engagements: number;
    cpm_usd: number;
    link_clicks: number;
    cpc_link_click_usd: number;
    ctr_link_click: number;
    clicks_all: number;
    ctr_all: number;
    cpc_all_usd: number;
    booking_count: number;
    product_image_url: string | null;
    product_image_urls: string[];
    created_at: string;
}

interface AdUpdatePayload {
    booking_count: number;
    product_image_url: string | null;
    product_image_urls: string[];
}

// ─── Lazy chart imports ───────────────────────────────────────────────────────
const ResponsiveContainer = dynamic(
    () => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false }
);
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number, decimals = 0) =>
    n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: decimals });

const fmtUsd = (n: number) =>
    n == null ? "—" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (n: number) =>
    n == null ? "—" : `${(n * 100).toFixed(2)}%`;

function shortName(name: string) {
    return name.length > 30 ? name.slice(0, 28) + "…" : name;
}

const PALETTE = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#3b82f6", "#a78bfa", "#34d399", "#fb923c"];

function deliveryBadge(delivery: string | null) {
    if (!delivery) return null;
    const label = delivery === "active" ? "Active" : delivery === "not_delivering" ? "Ended" : delivery;
    const cls = delivery === "active"
        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
        : "bg-slate-500/15 text-slate-400 border-slate-500/25";
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>{label}</span>;
}

function resultLabel(indicator: string | null) {
    if (!indicator) return "Results";
    if (indicator.includes("messaging_conversation")) return "Conversations";
    if (indicator.includes("post_interaction")) return "Post Interactions";
    if (indicator.includes("link_click")) return "Link Clicks";
    if (indicator.includes("video_view") || indicator.includes("thruplay")) return "Views";
    return "Results";
}

function titleize(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function objectiveLabel(ad: AdCampaign): string {
    if (ad.objective?.trim()) return ad.objective.trim();
    if (ad.result_indicator?.trim()) return titleize(ad.result_indicator);
    return "Not Set";
}

function viewsValue(ad: AdCampaign): number {
    if (ad.views > 0) return ad.views;
    if (ad.result_indicator?.includes("video_view") || ad.result_indicator?.includes("thruplay")) {
        return ad.results;
    }
    return 0;
}

function engagementsValue(ad: AdCampaign): number {
    if (ad.engagements > 0) return ad.engagements;
    if (ad.result_indicator?.includes("post_interaction")) {
        return ad.results;
    }
    return ad.clicks_all;
}

function parseAdDate(value: string | null): Date | null {
    if (!value) return null;
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T00:00:00+05:30`
        : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatAdDateTimeSL(value: string | null): string {
    const date = parseAdDate(value);
    if (!date) return "Not set";
    const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day} : ${byType.hour}:${byType.minute}`;
}

function dateRangeSummary(ad: AdCampaign) {
    const start = parseAdDate(ad.reporting_starts);
    const end = parseAdDate(ad.reporting_ends || ad.ends);

    const startLabel = formatAdDateTimeSL(ad.reporting_starts);
    const endLabel = formatAdDateTimeSL(ad.reporting_ends || ad.ends);

    if (!start && !end) {
        return {
            startLabel,
            endLabel,
            durationLabel: "Dates unavailable",
        };
    }

    if (start && end) {
        const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
        return {
            startLabel,
            endLabel,
            durationLabel: `${diffDays} day${diffDays === 1 ? "" : "s"}`,
        };
    }

    return {
        startLabel,
        endLabel,
        durationLabel: start ? "Start date only" : "End date only",
    };
}

function normalizeImageUrls(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((item) => String(item)).filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item)).filter(Boolean);
            }
        } catch {
            return [value];
        }
    }

    return [];
}

function normalizeAdCampaign(ad: Record<string, unknown>): AdCampaign {
    const productImageUrls = normalizeImageUrls(ad.product_image_urls);
    const productImageUrl =
        typeof ad.product_image_url === "string" && ad.product_image_url.trim()
            ? ad.product_image_url
            : productImageUrls[0] ?? null;

    return {
        ...ad,
        id: Number(ad.id),
        results: Number(ad.results) || 0,
        reach: Number(ad.reach) || 0,
        frequency: Number(ad.frequency) || 0,
        cost_per_result: Number(ad.cost_per_result) || 0,
        ad_set_budget_type: Number(ad.ad_set_budget_type) || 0,
        amount_spent_usd: Number(ad.amount_spent_usd) || 0,
        impressions: Number(ad.impressions) || 0,
        cpm_usd: Number(ad.cpm_usd) || 0,
        link_clicks: Number(ad.link_clicks) || 0,
        cpc_link_click_usd: Number(ad.cpc_link_click_usd) || 0,
        ctr_link_click: Number(ad.ctr_link_click) || 0,
        clicks_all: Number(ad.clicks_all) || 0,
        ctr_all: Number(ad.ctr_all) || 0,
        cpc_all_usd: Number(ad.cpc_all_usd) || 0,
        booking_count: Number(ad.booking_count) || 0,
        product_image_url: productImageUrl,
        product_image_urls: productImageUrls,
        batch_id: String(ad.batch_id ?? ""),
        reporting_starts: (ad.reporting_starts as string | null) ?? null,
        reporting_ends: (ad.reporting_ends as string | null) ?? null,
        ad_name: String(ad.ad_name ?? ""),
        objective: (ad.objective as string | null) ?? null,
        ad_delivery: (ad.ad_delivery as string | null) ?? null,
        result_indicator: (ad.result_indicator as string | null) ?? null,
        ad_set_budget: (ad.ad_set_budget as string | null) ?? null,
        ends: (ad.ends as string | null) ?? null,
        views: Number(ad.views) || 0,
        engagements: Number(ad.engagements) || 0,
        created_at: String(ad.created_at ?? ""),
    };
}

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsDataURL(file);
    });
}

// ─── Export helpers ───────────────────────────────────────────────────────────
function exportAdToXlsx(ad: AdCampaign) {
    const data = [
        { Metric: "Ad Name", Value: ad.ad_name },
        { Metric: "Objective", Value: objectiveLabel(ad) },
        { Metric: "Reporting Period", Value: `${ad.reporting_starts ?? ""} → ${ad.reporting_ends ?? ""}` },
        { Metric: "Delivery Status", Value: ad.ad_delivery ?? "" },
        { Metric: "Results", Value: ad.results },
        { Metric: "Result Type", Value: resultLabel(ad.result_indicator) },
        { Metric: "Reach", Value: ad.reach },
        { Metric: "Impressions", Value: ad.impressions },
        { Metric: "Views", Value: viewsValue(ad) },
        { Metric: "Engagements", Value: engagementsValue(ad) },
        { Metric: "Frequency", Value: ad.frequency },
        { Metric: "Amount Spent (USD)", Value: ad.amount_spent_usd },
        { Metric: "Cost Per Result (USD)", Value: ad.cost_per_result },
        { Metric: "CPM (USD)", Value: ad.cpm_usd },
        { Metric: "Link Clicks", Value: ad.link_clicks },
        { Metric: "CPC – Link Click (USD)", Value: ad.cpc_link_click_usd },
        { Metric: "CTR – Link Click", Value: `${(ad.ctr_link_click * 100).toFixed(4)}%` },
        { Metric: "Clicks (All)", Value: ad.clicks_all },
        { Metric: "CPC – All (USD)", Value: ad.cpc_all_usd },
        { Metric: "CTR – All", Value: `${(ad.ctr_all * 100).toFixed(4)}%` },
        { Metric: "Ad Set Budget", Value: ad.ad_set_budget ?? "" },
        { Metric: "Campaign End Date", Value: ad.ends ?? "" },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 30 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ad Details");
    XLSX.writeFile(wb, `${ad.ad_name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50)}.xlsx`);
}

function exportAllToXlsx(ads: AdCampaign[]) {
    const data = ads.map((ad) => ({
        "Ad Name": ad.ad_name,
        "Objective": objectiveLabel(ad),
        "Starts": ad.reporting_starts ?? "",
        "Ends": ad.reporting_ends ?? "",
        "Delivery": ad.ad_delivery ?? "",
        "Results": ad.results,
        "Result Type": resultLabel(ad.result_indicator),
        "Reach": ad.reach,
        "Impressions": ad.impressions,
        "Views": viewsValue(ad),
        "Engagements": engagementsValue(ad),
        "Frequency": Number(ad.frequency),
        "Amount Spent (USD)": Number(ad.amount_spent_usd),
        "Cost Per Result (USD)": Number(ad.cost_per_result),
        "CPM (USD)": Number(ad.cpm_usd),
        "Link Clicks": ad.link_clicks,
        "CPC – Link (USD)": Number(ad.cpc_link_click_usd),
        "CTR – Link (%)": Number((ad.ctr_link_click * 100).toFixed(4)),
        "Clicks (All)": ad.clicks_all,
        "CPC – All (USD)": Number(ad.cpc_all_usd),
        "CTR – All (%)": Number((ad.ctr_all * 100).toFixed(4)),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "All Ad Campaigns");
    XLSX.writeFile(wb, `Aahaas_Ads_All.xlsx`);
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
    label, value, sub, icon: Icon, iconColor, iconBg, trend,
}: {
    label: string; value: string; sub?: string;
    icon: React.ElementType; iconColor: string; iconBg: string;
    trend?: "up" | "down" | null;
}) {
    return (
        <div className="rounded-2xl border border-white/8 bg-[#0f0f1e] p-4 flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
                <p className="text-xl font-bold text-white leading-tight">{value}</p>
                {sub && (
                    <p className={cn("text-xs mt-0.5 flex items-center gap-1",
                        trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-slate-500"
                    )}>
                        {trend === "up" && <TrendingUp className="w-3 h-3" />}
                        {trend === "down" && <TrendingDown className="w-3 h-3" />}
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
}

// ─── Chart card wrapper ─────────────────────────────────────────────────────
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-white/8 bg-[#0f0f1e] p-5">
            <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
            {children}
        </div>
    );
}

const ChartTooltipStyle = {
    contentStyle: { backgroundColor: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#e2e8f0", fontSize: 12 },
    labelStyle: { color: "#a1aec0", marginBottom: 4 },
};

// ─── Ad Detail Modal ──────────────────────────────────────────────────────────
function AdDetailModal({
    ad,
    onClose,
    onSave,
    saving,
}: {
    ad: AdCampaign;
    onClose: () => void;
    onSave: (payload: AdUpdatePayload) => Promise<void>;
    saving: boolean;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [bookingCount, setBookingCount] = useState(String(ad.booking_count ?? 0));
    const [imageUrls, setImageUrls] = useState<string[]>(
        ad.product_image_urls.length > 0
            ? ad.product_image_urls
            : ad.product_image_url
                ? [ad.product_image_url]
                : []
    );
    const imageInputRef = useRef<HTMLInputElement>(null);

    const metrics = [
        { label: "Objective", value: objectiveLabel(ad), icon: Megaphone, color: "text-violet-400" },
        { label: "Start Date", value: formatAdDateTimeSL(ad.reporting_starts), icon: Calendar, color: "text-sky-400" },
        { label: "End Date", value: formatAdDateTimeSL(ad.reporting_ends || ad.ends), icon: Calendar, color: "text-amber-400" },
        { label: "Amount Spent", value: fmtUsd(ad.amount_spent_usd), icon: DollarSign, color: "text-emerald-400" },
        { label: "Cost / Result", value: fmtUsd(ad.cost_per_result), icon: DollarSign, color: "text-orange-400" },
        { label: "Impressions", value: fmt(ad.impressions), icon: Eye, color: "text-violet-400" },
        { label: "Reach", value: fmt(ad.reach), icon: Users, color: "text-blue-400" },
        { label: "Views", value: fmt(viewsValue(ad)), icon: Eye, color: "text-cyan-400" },
        { label: "Clicks", value: fmt(ad.clicks_all), icon: MousePointerClick, color: "text-yellow-400" },
        { label: "Engagements", value: fmt(engagementsValue(ad)), icon: TrendingUp, color: "text-fuchsia-400" },
        { label: resultLabel(ad.result_indicator), value: fmt(ad.results), icon: TrendingUp, color: "text-pink-400" },
        { label: "Frequency", value: fmt(ad.frequency, 2), icon: BarChart2, color: "text-cyan-400" },
        { label: "Link Clicks", value: fmt(ad.link_clicks), icon: MousePointerClick, color: "text-teal-400" },
        { label: "CTR (Link)", value: fmtPct(ad.ctr_link_click), icon: TrendingUp, color: "text-lime-400" },
        { label: "CTR (All)", value: fmtPct(ad.ctr_all), icon: TrendingUp, color: "text-rose-400" },
        { label: "CPM", value: fmtUsd(ad.cpm_usd), icon: BarChart2, color: "text-indigo-400" },
        { label: "CPC (Link)", value: fmtUsd(ad.cpc_link_click_usd), icon: DollarSign, color: "text-sky-400" },
        { label: "Bookings", value: fmt(ad.booking_count), icon: BookOpen, color: "text-emerald-300" },
    ];

    const barData = [
        { name: "Reach", value: ad.reach, fill: "#8b5cf6" },
        { name: "Impressions", value: ad.impressions, fill: "#06b6d4" },
        { name: "Clicks (All)", value: ad.clicks_all, fill: "#10b981" },
        { name: "Link Clicks", value: ad.link_clicks, fill: "#f59e0b" },
        { name: "Results", value: ad.results, fill: "#ef4444" },
    ];

    const handleImageUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const uploads = await Promise.all(Array.from(files).map(fileToDataUrl));
        setImageUrls((prev) => [...prev, ...uploads].filter(Boolean));
        setIsEditing(true);
    };

    const handleRemoveImage = (index: number) => {
        setImageUrls((prev) => prev.filter((_, i) => i !== index));
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setBookingCount(String(ad.booking_count ?? 0));
        setImageUrls(
            ad.product_image_urls.length > 0
                ? ad.product_image_urls
                : ad.product_image_url
                    ? [ad.product_image_url]
                    : []
        );
    };

    const handleSave = async () => {
        const nextBookingCount = Math.max(0, Number(bookingCount) || 0);
        const nextImageUrls = imageUrls.filter(Boolean);
        try {
            await onSave({
                booking_count: nextBookingCount,
                product_image_url: nextImageUrls[0] ?? null,
                product_image_urls: nextImageUrls,
            });
            setIsEditing(false);
        } catch {
            // The parent already surfaces the save error.
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a18] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#0a0a18] border-b border-white/8 px-6 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <Megaphone className="w-4 h-4 text-violet-400 flex-shrink-0" />
                            <span className="text-xs text-violet-400 font-semibold uppercase tracking-widest">Ad Details</span>
                            {deliveryBadge(ad.ad_delivery)}
                        </div>
                        <h2 className="text-lg font-bold text-white leading-snug">{ad.ad_name}</h2>
                        {(ad.reporting_starts || ad.reporting_ends || ad.ends) && (
                            <p className="text-xs text-slate-500 mt-1">
                                {dateRangeSummary(ad).startLabel} to {dateRangeSummary(ad).endLabel} (Sri Lanka time)
                            </p>
                        )}
                        {false && ad.reporting_starts && (
                            <p className="text-xs text-slate-500 mt-1">{formatAdDateTimeSL(ad.reporting_starts)} → {formatAdDateTimeSL(ad.reporting_ends)}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {!isEditing ? (
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-xs border-white/10 bg-white/5 hover:bg-white/10"
                                onClick={() => setIsEditing(true)}
                            >
                                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                            </Button>
                        ) : (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs border-white/10 bg-white/5 hover:bg-white/10"
                                    onClick={handleCancelEdit}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    className="text-xs bg-violet-600 hover:bg-violet-700"
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                                    Save
                                </Button>
                            </>
                        )}
                        <Button size="sm" variant="outline"
                            className="text-xs border-white/10 bg-white/5 hover:bg-white/10"
                            onClick={() => exportAdToXlsx(ad)}>
                            <Download className="w-3.5 h-3.5 mr-1" /> Export XLSX
                        </Button>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.8fr] gap-4">
                        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                    <Images className="w-4 h-4 text-violet-400" />
                                    <div>
                                        <p className="text-sm font-semibold text-white">Ad Images</p>
                                        <p className="text-[11px] text-slate-500">Upload product images for this ad.</p>
                                    </div>
                                </div>
                                {isEditing && (
                                    <>
                                        <input
                                            ref={imageInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => {
                                                void handleImageUpload(e.target.files);
                                                e.target.value = "";
                                            }}
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs border-white/10 bg-white/5 hover:bg-white/10"
                                            onClick={() => imageInputRef.current?.click()}
                                            disabled={saving}
                                        >
                                            <ImagePlus className="w-3.5 h-3.5 mr-1" /> Upload Images
                                        </Button>
                                    </>
                                )}
                            </div>

                            {imageUrls.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {imageUrls.map((url, index) => (
                                        <div key={`${url.slice(0, 20)}-${index}`} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20 aspect-[4/3]">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={url} alt={`${ad.ad_name} image ${index + 1}`} className="w-full h-full object-cover" />
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/65 text-white hover:bg-red-500 transition-colors"
                                                    onClick={() => handleRemoveImage(index)}
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {index === 0 && (
                                                <span className="absolute bottom-2 left-2 rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                                                    Cover
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
                                    <ImagePlus className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-slate-300">No images saved yet</p>
                                    <p className="text-[11px] text-slate-500 mt-1">Use Edit to upload product images for this ad.</p>
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                                    <BookOpen className="w-5 h-5 text-emerald-300" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">Bookings</p>
                                    <p className="text-[11px] text-slate-500">Track confirmed bookings from this ad.</p>
                                </div>
                            </div>

                            {isEditing ? (
                                <div className="space-y-3">
                                    <Input
                                        type="number"
                                        min="0"
                                        value={bookingCount}
                                        onChange={(e) => setBookingCount(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white"
                                    />
                                    <p className="text-[11px] text-slate-500">Update the booking count, then save the ad.</p>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-end gap-2">
                                        <span className="text-4xl font-black text-white">{fmt(ad.booking_count)}</span>
                                        <span className="text-sm text-slate-500 mb-1">bookings</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-3">Click Edit to change the booking total.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {metrics.map(({ label, value, icon: Icon, color }) => (
                            <div key={label} className="rounded-xl border border-white/8 bg-white/3 p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                                    <span className="text-[11px] text-slate-500">{label}</span>
                                </div>
                                <p className="text-base font-bold text-white">{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Bar chart */}
                    <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                        <p className="text-xs font-semibold text-slate-400 mb-3">Audience Funnel</p>
                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData} layout="vertical" margin={{ left: 60, right: 20 }}>
                                    <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    <Tooltip {...ChartTooltipStyle} formatter={((v: unknown) => [v != null ? fmt(Number(v)) : "—", ""]) as any} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {barData.map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Budget info */}
                    {ad.ad_set_budget && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-300">
                            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-400" />
                            <span>Budget: <strong>{ad.ad_set_budget}</strong>{ad.ends ? ` · Ended: ${ad.ends}` : ""}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main client component ────────────────────────────────────────────────────
export function AdsClient() {
    const [ads, setAds] = useState<AdCampaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [savingAdId, setSavingAdId] = useState<number | null>(null);
    const [promotingAdId, setPromotingAdId] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<keyof AdCampaign>("amount_spent_usd");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [selectedAd, setSelectedAd] = useState<AdCampaign | null>(null);
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
    const [selectedMonth, setSelectedMonth] = useState<string>("all");
    const [deliveryFilter, setDeliveryFilter] = useState<string>("all");
    const [resultTypeFilter, setResultTypeFilter] = useState<string>("all");
    const fileRef = useRef<HTMLInputElement>(null);

    const load = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/ads", { credentials: "include" });
            const data = await res.json();
            setAds(Array.isArray(data) ? data.map((item) => normalizeAdCampaign(item as Record<string, unknown>)) : []);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleUpload = async (file: File) => {
        setUploading(true);
        setUploadMsg(null);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/ads/upload", { method: "POST", body: fd, credentials: "include" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setUploadMsg({ type: "ok", text: `✓ ${data.inserted} ads imported successfully` });
            await load();
        } catch (err: unknown) {
            setUploadMsg({ type: "err", text: err instanceof Error ? err.message : "Upload failed" });
        } finally {
            setUploading(false);
        }
    };

    const handleClearAll = async () => {
        if (!confirm("Delete all ad campaign data? This cannot be undone.")) return;
        await fetch("/api/ads", { method: "DELETE", credentials: "include" });
        setAds([]);
    };

    const handleDeleteAd = async (id: number) => {
        await fetch(`/api/ads/${id}`, { method: "DELETE", credentials: "include" });
        setAds((prev) => prev.filter((a) => a.id !== id));
        if (selectedAd?.id === id) setSelectedAd(null);
    };

    const handleSaveAd = async (id: number, payload: AdUpdatePayload) => {
        setSavingAdId(id);
        try {
            const res = await fetch(`/api/ads/${id}`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save ad");

            const updated = normalizeAdCampaign(data as Record<string, unknown>);
            setAds((prev) => prev.map((ad) => ad.id === id ? updated : ad));
            setSelectedAd(updated);
            setUploadMsg({ type: "ok", text: `Saved updates for ${updated.ad_name}` });
        } catch (error) {
            setUploadMsg({
                type: "err",
                text: error instanceof Error ? error.message : "Failed to save ad details",
            });
            throw error;
        } finally {
            setSavingAdId(null);
        }
    };

    const handleAddToCategory = async (
        adId: number,
        category: "package" | "seasonal_offer"
    ) => {
        setPromotingAdId(adId);
        try {
            const res = await fetch("/api/ads/categorize", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adId, category }),
            });
            const data = await res.json().catch(() => null) as { error?: string; mode?: "created" | "updated" } | null;
            if (!res.ok) throw new Error(data?.error || "Failed to add ad campaign");

            const noun = category === "package" ? "package" : "offer";
            const verb = data?.mode === "updated" ? "Updated" : "Added";
            setUploadMsg({ type: "ok", text: `${verb} this ad campaign in ${noun}s` });
        } catch (error) {
            setUploadMsg({
                type: "err",
                text: error instanceof Error ? error.message : "Failed to add ad campaign",
            });
        } finally {
            setPromotingAdId(null);
        }
    };

    // ── Derive available months from all ads ────────────────────────────────
    // Use "ends" date if available, else fall back to reporting_ends
    const availableMonths = useMemo(() => {
        const monthSet = new Set<string>();
        ads.forEach((a) => {
            const dateStr = a.ends || a.reporting_ends || a.reporting_starts;
            if (dateStr) {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                }
            }
        });
        return Array.from(monthSet).sort();
    }, [ads]);

    const toggleSort = (key: keyof AdCampaign) => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir("desc"); }
    };

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return ads
            .filter((a) => {
                // Text search
                if (q && !a.ad_name.toLowerCase().includes(q)) return false;
                // Month filter — match on ends → reporting_ends → reporting_starts
                if (selectedMonth !== "all") {
                    const dateStr = a.ends || a.reporting_ends || a.reporting_starts;
                    if (!dateStr) return false;
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return false;
                    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    if (ym !== selectedMonth) return false;
                }
                // Delivery filter
                if (deliveryFilter !== "all" && a.ad_delivery !== deliveryFilter) return false;
                // Result type filter
                if (resultTypeFilter !== "all") {
                    const label = resultLabel(a.result_indicator).toLowerCase();
                    if (!label.includes(resultTypeFilter)) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const av = a[sortKey] ?? 0;
                const bv = b[sortKey] ?? 0;
                const diff = typeof av === "number" && typeof bv === "number"
                    ? av - bv
                    : String(av).localeCompare(String(bv));
                return sortDir === "asc" ? diff : -diff;
            });
    }, [ads, search, selectedMonth, deliveryFilter, resultTypeFilter, sortKey, sortDir]);

    // ── KPIs — derived from filtered so month filter affects them ───────────
    const totalSpend = filtered.reduce((s, a) => s + Number(a.amount_spent_usd), 0);
    const totalReach = filtered.reduce((s, a) => s + Number(a.reach), 0);
    const totalImpressions = filtered.reduce((s, a) => s + Number(a.impressions), 0);
    const totalResults = filtered.reduce((s, a) => s + Number(a.results), 0);
    const totalLinkClicks = filtered.reduce((s, a) => s + Number(a.link_clicks), 0);
    const avgCtr = filtered.length ? (filtered.reduce((s, a) => s + Number(a.ctr_link_click), 0) / filtered.length) * 100 : 0;
    const avgCpm = filtered.length ? filtered.reduce((s, a) => s + Number(a.cpm_usd), 0) / filtered.length : 0;
    const avgCpr = filtered.length ? filtered.reduce((s, a) => s + Number(a.cost_per_result), 0) / filtered.length : 0;

    // ── Chart data ──────────────────────────────────────────────────────────────
    const spendReachData = filtered.map((a) => ({
        name: shortName(a.ad_name),
        Spend: Number(a.amount_spent_usd),
        Reach: Number(a.reach) / 1000,
    }));

    const ctrData = filtered.map((a) => ({
        name: shortName(a.ad_name),
        "CTR%": Number((a.ctr_link_click * 100).toFixed(4)),
        "CTR All%": Number((a.ctr_all * 100).toFixed(4)),
    }));

    const conversionData = filtered.map((a) => ({
        name: shortName(a.ad_name),
        Results: Number(a.results),
        "Cost/Result": Number(a.cost_per_result),
    }));

    const pieData = filtered.slice(0, 8).map((a, i) => ({
        name: shortName(a.ad_name),
        value: Number(a.amount_spent_usd),
        fill: PALETTE[i % PALETTE.length],
    }));

    const cpcCprData = filtered.map((a) => ({
        name: shortName(a.ad_name),
        "CPC (Link)": Number(a.cpc_link_click_usd),
        "CPR": Number(a.cost_per_result),
    }));

    // ─── Loading / Empty states ──────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                <span className="text-slate-500 text-sm">Loading ad campaigns…</span>
            </div>
        );
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-0">
            {/* ── PAGE HERO ── */}
            <div
                className="relative overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, #0d0d2b 0%, #1a0a3c 40%, #0f1a3a 100%)",
                    minHeight: "140px",
                }}
            >
                <div className="absolute top-0 right-20 w-64 h-64 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 left-40 w-48 h-48 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
                <div className="relative z-10 px-4 lg:px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Megaphone className="w-4 h-4 text-violet-400" />
                            <span className="text-violet-400 text-xs font-semibold uppercase tracking-widest">Ad Campaigns</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Ads Performance</h1>
                        <p className="text-sm text-white/50 mt-1">Facebook & Instagram campaign analytics</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Upload */}
                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}
                            className="bg-violet-600 hover:bg-violet-700 text-white text-xs">
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                            {uploading ? "Uploading…" : "Upload Excel"}
                        </Button>
                        {ads.length > 0 && (
                            <>
                                <Button size="sm" variant="outline"
                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs"
                                    onClick={() => exportAllToXlsx(filtered)}>
                                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Export All
                                </Button>
                                <Button size="sm" variant="outline"
                                    className="border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs"
                                    onClick={handleClearAll}>
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear All
                                </Button>
                            </>
                        )}
                        <Button size="sm" variant="outline"
                            className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs"
                            onClick={load}>
                            <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-6 p-4 lg:p-6">
                {/* Upload feedback */}
                {uploadMsg && (
                    <div className={cn("flex items-center gap-2 px-4 py-3 rounded-xl text-sm border",
                        uploadMsg.type === "ok"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                            : "bg-red-500/10 border-red-500/20 text-red-300"
                    )}>
                        {uploadMsg.text}
                        <button onClick={() => setUploadMsg(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                    </div>
                )}

                {ads.length === 0 ? (
                    /* ── EMPTY STATE ── */
                    <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                            <Megaphone className="w-8 h-8 text-violet-400" />
                        </div>
                        <div>
                            <p className="text-white font-semibold text-lg mb-1">No ad campaigns yet</p>
                            <p className="text-slate-500 text-sm max-w-xs">Upload your Facebook Ads Manager Excel export to start analysing campaign performance.</p>
                        </div>
                        <Button onClick={() => fileRef.current?.click()} className="bg-violet-600 hover:bg-violet-700 text-white">
                            <Upload className="w-4 h-4 mr-2" /> Upload Excel Sheet
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* ── MONTH FILTER BAR ── */}
                        {availableMonths.length > 0 && (
                            <div className="rounded-2xl border border-white/8 bg-[#0f0f1e] p-4">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <div className="flex items-center gap-2 text-slate-400 flex-shrink-0">
                                        <Calendar className="w-4 h-4" />
                                        <span className="text-xs font-semibold uppercase tracking-widest">Filter by Month</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            onClick={() => setSelectedMonth("all")}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border",
                                                selectedMonth === "all"
                                                    ? "bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-500/20"
                                                    : "border-white/10 text-slate-400 hover:text-white hover:border-white/20 bg-white/5"
                                            )}
                                        >
                                            All Time
                                        </button>
                                        {availableMonths.map((ym) => {
                                            const [year, month] = ym.split("-");
                                            const label = new Date(Number(year), Number(month) - 1, 1)
                                                .toLocaleString("en", { month: "short", year: "numeric" });
                                            const isActive = selectedMonth === ym;
                                            return (
                                                <button
                                                    key={ym}
                                                    onClick={() => setSelectedMonth(ym)}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border",
                                                        isActive
                                                            ? "bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-500/20"
                                                            : "border-white/10 text-slate-400 hover:text-white hover:border-white/20 bg-white/5"
                                                    )}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {selectedMonth !== "all" && (
                                        <button
                                            onClick={() => setSelectedMonth("all")}
                                            className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" /> Clear filter
                                        </button>
                                    )}
                                </div>
                                {selectedMonth !== "all" && (
                                    <p className="mt-2 text-[11px] text-slate-500">
                                        Showing <span className="text-violet-400 font-semibold">{filtered.length}</span> ad{filtered.length !== 1 ? "s" : ""} ending in{" "}
                                        <span className="text-white font-semibold">
                                            {new Date(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]) - 1, 1)
                                                .toLocaleString("en", { month: "long", year: "numeric" })}
                                        </span>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ── QUICK FILTERS BAR ── */}
                        <div className="rounded-2xl border border-white/8 bg-[#0f0f1e] p-4 flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2 text-slate-400 flex-shrink-0">
                                <Filter className="w-4 h-4" />
                                <span className="text-xs font-semibold uppercase tracking-widest">Filters</span>
                            </div>
                            {/* Delivery status */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Delivery:</span>
                                {(["all", "active", "not_delivering"] as const).map((val) => {
                                    const label = val === "all" ? "All" : val === "active" ? "Active" : "Ended";
                                    return (
                                        <button key={val} onClick={() => setDeliveryFilter(val)}
                                            className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border",
                                                deliveryFilter === val
                                                    ? "bg-violet-600 text-white border-violet-500"
                                                    : "border-white/10 text-slate-400 hover:text-white bg-white/5")}>
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            {/* Result type */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Result Type:</span>
                                {(["all", "conversations", "interactions", "clicks"] as const).map((val) => {
                                    const label = val === "all" ? "All" : val === "conversations" ? "Conversations" : val === "interactions" ? "Post Interactions" : "Link Clicks";
                                    return (
                                        <button key={val} onClick={() => setResultTypeFilter(val)}
                                            className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border",
                                                resultTypeFilter === val
                                                    ? "bg-cyan-600 text-white border-cyan-500"
                                                    : "border-white/10 text-slate-400 hover:text-white bg-white/5")}>
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            {(deliveryFilter !== "all" || resultTypeFilter !== "all") && (
                                <button onClick={() => { setDeliveryFilter("all"); setResultTypeFilter("all"); }}
                                    className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors">
                                    <X className="w-3.5 h-3.5" /> Clear
                                </button>
                            )}
                        </div>

                        {/* ── KPI CARDS ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KpiCard label="Total Ad Spend" value={fmtUsd(totalSpend)}
                                sub="across all campaigns" icon={DollarSign} iconColor="text-emerald-400" iconBg="bg-emerald-500/15" />
                            <KpiCard label="Total Reach" value={fmt(totalReach)}
                                sub="unique people reached" icon={Users} iconColor="text-blue-400" iconBg="bg-blue-500/15" />
                            <KpiCard label="Impressions" value={fmt(totalImpressions)}
                                sub="total ad views" icon={Eye} iconColor="text-violet-400" iconBg="bg-violet-500/15" />
                            <KpiCard label="Conversions" value={fmt(totalResults)}
                                sub="total results" icon={TrendingUp} iconColor="text-pink-400" iconBg="bg-pink-500/15" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KpiCard label="Avg CTR (Link)" value={`${avgCtr.toFixed(3)}%`}
                                sub="click-through rate" icon={MousePointerClick} iconColor="text-cyan-400" iconBg="bg-cyan-500/15" />
                            <KpiCard label="Avg CPM" value={fmtUsd(avgCpm)}
                                sub="cost per 1K impressions" icon={BarChart2} iconColor="text-orange-400" iconBg="bg-orange-500/15" />
                            <KpiCard label="Avg Cost/Result" value={fmtUsd(avgCpr)}
                                sub="conversion efficiency" icon={DollarSign} iconColor="text-rose-400" iconBg="bg-rose-500/15" />
                            <KpiCard label="Link Clicks" value={fmt(totalLinkClicks)}
                                sub="total link clicks" icon={MousePointerClick} iconColor="text-lime-400" iconBg="bg-lime-500/15" />
                        </div>

                        {/* ── CHARTS ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Spend vs Reach */}
                            <ChartCard title="Ad Spend vs Reach (K) per Campaign">
                                <div className="h-60">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={spendReachData} margin={{ left: 0, right: 8 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
                                            <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                            <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}K`} />
                                            <Tooltip {...ChartTooltipStyle} formatter={((v: unknown, name: unknown) => { const n = Number(v); return [name === "Spend" ? `$${n.toFixed(2)}` : `${n.toFixed(1)}K`, name]; }) as any} />
                                            <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                                            <Bar yAxisId="left" dataKey="Spend" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                            <Bar yAxisId="right" dataKey="Reach" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>

                            {/* CTR comparison */}
                            <ChartCard title="Click-Through Rate per Campaign (%)">
                                <div className="h-60">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={ctrData} margin={{ left: 0, right: 8 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
                                            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                            <Tooltip {...ChartTooltipStyle} formatter={((v: unknown) => [`${Number(v)}%`, ""]) as any} />
                                            <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                                            <Line type="monotone" dataKey="CTR%" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: "#10b981" }} activeDot={{ r: 6 }} />
                                            <Line type="monotone" dataKey="CTR All%" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: "#f59e0b" }} activeDot={{ r: 6 }} strokeDasharray="4 2" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>

                            {/* Results & Cost per Result */}
                            <ChartCard title="Conversions & Cost per Result">
                                <div className="h-60">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={conversionData} margin={{ left: 0, right: 8 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
                                            <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                            <Tooltip {...ChartTooltipStyle} formatter={((v: unknown, name: unknown) => { const n = Number(v); return [name === "Cost/Result" ? `$${n.toFixed(2)}` : n, name]; }) as any} />
                                            <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                                            <Bar yAxisId="left" dataKey="Results" fill="#ec4899" radius={[4, 4, 0, 0]} />
                                            <Bar yAxisId="right" dataKey="Cost/Result" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>

                            {/* Spend breakdown pie */}
                            <ChartCard title="Spend Distribution by Ad">
                                <div className="h-60">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                                outerRadius={95} innerRadius={45} paddingAngle={2}
                                                label={(props: { name?: string; percent?: number }) => `${((props.percent ?? 0) * 100).toFixed(0)}%`}
                                                labelLine={false}>
                                                {pieData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip {...ChartTooltipStyle} formatter={((v: unknown) => [`$${Number(v).toFixed(2)}`, "Spend"]) as any} />
                                            <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>
                        </div>

                        {/* ── CPC vs CPR CHART (full width) ── */}
                        <ChartCard title="CPC (Link Click) vs Cost per Result per Campaign ($)">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={cpcCprData} margin={{ left: 0, right: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
                                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                        <Tooltip {...ChartTooltipStyle} formatter={((v: unknown) => [`$${Number(v).toFixed(2)}`, ""]) as any} />
                                        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                                        <Bar dataKey="CPC (Link)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="CPR" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        {/* ── SEARCH + VIEW TOGGLE ── */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative flex-1 min-w-48">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search ad campaigns…"
                                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500" />
                                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>}
                            </div>
                            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                                <button onClick={() => setViewMode("cards")}
                                    className={cn("p-1.5 rounded-lg transition-colors", viewMode === "cards" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white")}>
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button onClick={() => setViewMode("table")}
                                    className={cn("p-1.5 rounded-lg transition-colors", viewMode === "table" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white")}>
                                    <ListIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <span className="text-xs text-slate-500">
                                {filtered.length} ad{filtered.length !== 1 ? "s" : ""}
                                {selectedMonth !== "all" && (
                                    <span className="ml-1 text-violet-400">
                                        · {new Date(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]) - 1, 1)
                                            .toLocaleString("en", { month: "short", year: "numeric" })}
                                    </span>
                                )}
                            </span>
                        </div>

                        {/* ── CARD VIEW ── */}
                        {viewMode === "cards" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filtered.map((ad) => (
                                    <AdCard key={ad.id} ad={ad}
                                        onClick={() => setSelectedAd(ad)}
                                        onDelete={() => handleDeleteAd(ad.id)}
                                        onExport={() => exportAdToXlsx(ad)}
                                        onAddToPackage={() => handleAddToCategory(ad.id, "package")}
                                        onAddToOffer={() => handleAddToCategory(ad.id, "seasonal_offer")}
                                        isPromoting={promotingAdId === ad.id} />
                                ))}
                            </div>
                        )}

                        {/* ── TABLE VIEW ── */}
                        {viewMode === "table" && (
                            <div className="rounded-2xl border border-white/8 bg-[#0f0f1e] overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/8">
                                            {(
                                                [
                                                    { key: "ad_name" as keyof AdCampaign, label: "Ad Name" },
                                                    { key: "objective" as keyof AdCampaign, label: "Objective" },
                                                    { key: "reporting_starts" as keyof AdCampaign, label: "Start" },
                                                    { key: "reporting_ends" as keyof AdCampaign, label: "End" },
                                                    { key: "cost_per_result" as keyof AdCampaign, label: "CPR ($)" },
                                                    { key: "amount_spent_usd" as keyof AdCampaign, label: "Spend ($)" },
                                                    { key: "impressions" as keyof AdCampaign, label: "Impr." },
                                                    { key: "reach" as keyof AdCampaign, label: "Reach" },
                                                    { key: "views" as keyof AdCampaign, label: "Views" },
                                                    { key: "link_clicks" as keyof AdCampaign, label: "Clicks" },
                                                    { key: "engagements" as keyof AdCampaign, label: "Engagements" },
                                                ] as { key: keyof AdCampaign; label: string }[]
                                            ).map(({ key, label }) => (
                                                <th key={key}
                                                    className="px-4 py-3 text-left text-xs font-semibold text-slate-400 cursor-pointer hover:text-white whitespace-nowrap"
                                                    onClick={() => toggleSort(key)}>
                                                    <div className="flex items-center gap-1">
                                                        {label}
                                                        {sortKey === key
                                                            ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                                                            : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((ad, idx) => (
                                            <tr key={ad.id}
                                                className={cn("border-b border-white/5 hover:bg-white/4 transition-colors cursor-pointer",
                                                    idx % 2 === 0 ? "" : "bg-white/[0.02]")}
                                                onClick={() => setSelectedAd(ad)}>
                                                <td className="px-4 py-3 max-w-[200px]">
                                                    <p className="text-white text-xs font-medium truncate">{ad.ad_name}</p>
                                                    <p className="text-slate-500 text-[10px] mt-0.5">{deliveryBadge(ad.ad_delivery)}</p>
                                                </td>
                                                <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{objectiveLabel(ad)}</td>
                                                <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{formatAdDateTimeSL(ad.reporting_starts)}</td>
                                                <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{formatAdDateTimeSL(ad.reporting_ends || ad.ends)}</td>
                                                <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{fmtUsd(Number(ad.cost_per_result))}</td>
                                                <td className="px-4 py-3 text-emerald-400 font-semibold text-xs whitespace-nowrap">{fmtUsd(Number(ad.amount_spent_usd))}</td>
                                                <td className="px-4 py-3 text-slate-300 text-xs">{fmt(Number(ad.impressions))}</td>
                                                <td className="px-4 py-3 text-slate-300 text-xs">{fmt(Number(ad.reach))}</td>
                                                <td className="px-4 py-3 text-slate-300 text-xs">{fmt(viewsValue(ad))}</td>
                                                <td className="px-4 py-3 text-slate-300 text-xs">{fmt(Number(ad.link_clicks))}</td>
                                                <td className="px-4 py-3 text-slate-300 text-xs">{fmt(engagementsValue(ad))}</td>
                                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <button
                                                            onClick={() => handleAddToCategory(ad.id, "package")}
                                                            disabled={promotingAdId === ad.id}
                                                            className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                                                            title="Add to Packages"
                                                        >
                                                            Package
                                                        </button>
                                                        <button
                                                            onClick={() => handleAddToCategory(ad.id, "seasonal_offer")}
                                                            disabled={promotingAdId === ad.id}
                                                            className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                                                            title="Add to Offers"
                                                        >
                                                            Offer
                                                        </button>
                                                        <button onClick={() => exportAdToXlsx(ad)}
                                                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Export XLSX">
                                                            <Download className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => handleDeleteAd(ad.id)}
                                                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Ad detail modal */}
            {selectedAd && (
                <AdDetailModal
                    key={selectedAd.id}
                    ad={selectedAd}
                    onClose={() => setSelectedAd(null)}
                    onSave={(payload) => handleSaveAd(selectedAd.id, payload)}
                    saving={savingAdId === selectedAd.id}
                />
            )}
        </div>
    );
}

// ─── Ad card subcomponent ──────────────────────────────────────────────────────
function AdCard({
    ad, onClick, onDelete, onExport, onAddToPackage, onAddToOffer, isPromoting,
}: {
    ad: AdCampaign;
    onClick: () => void;
    onDelete: () => void;
    onExport: () => void;
    onAddToPackage: () => void;
    onAddToOffer: () => void;
    isPromoting: boolean;
}) {
    const efficiency = ad.cost_per_result > 0
        ? ad.cost_per_result < 0.5 ? "Excellent" : ad.cost_per_result < 1 ? "Good" : "High Cost"
        : null;
    const effColor = efficiency === "Excellent" ? "text-emerald-400" : efficiency === "Good" ? "text-cyan-400" : "text-orange-400";
    const dateSummary = dateRangeSummary(ad);
    const bookingTotal = fmt(Number(ad.booking_count));

    return (
        <div
            className="group rounded-2xl border border-white/8 bg-[#0f0f1e] hover:border-violet-500/30 hover:bg-violet-500/5 transition-all duration-200 cursor-pointer overflow-hidden"
            onClick={onClick}
        >
            {ad.product_image_url && (
                <div className="relative h-40 border-b border-white/5 bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ad.product_image_url} alt={ad.ad_name} className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white">
                        <Images className="w-3 h-3" />
                        {(ad.product_image_urls.length || 1).toLocaleString()} image{(ad.product_image_urls.length || 1) !== 1 ? "s" : ""}
                    </div>
                </div>
            )}

            {/* Header bar */}
            <div className="px-4 pt-4 pb-3 border-b border-white/5">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                            <Megaphone className="w-3.5 h-3.5 text-violet-400" />
                        </div>
                        <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{ad.ad_name}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button onClick={onExport}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all" title="Export XLSX">
                            <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={onDelete}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {deliveryBadge(ad.ad_delivery)}
                    {efficiency && (
                        <span className={`text-[10px] font-semibold ${effColor}`}>{efficiency} CPR</span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                        <BookOpen className="w-3 h-3" />
                        {bookingTotal} bookings
                    </span>
                    {(ad.reporting_starts || ad.reporting_ends || ad.ends) && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">
                            {dateSummary.durationLabel}
                        </span>
                    )}
                    {false && ad.reporting_starts && (
                        <span className="text-[10px] text-slate-600">{ad.reporting_starts} → {ad.reporting_ends}</span>
                    )}
                </div>
            </div>

            {/* Metrics grid */}
            <div className="p-4 grid grid-cols-3 gap-2">
                {[
                    { label: "Cost Per Result", value: fmtUsd(Number(ad.cost_per_result)), color: "text-orange-400" },
                    { label: "Amount Spent", value: fmtUsd(Number(ad.amount_spent_usd)), color: "text-emerald-400" },
                    { label: "Impressions", value: fmt(Number(ad.impressions)), color: "text-violet-400" },
                    { label: "Reach", value: fmt(Number(ad.reach)), color: "text-blue-400" },
                    { label: "Views", value: fmt(viewsValue(ad)), color: "text-cyan-400" },
                    { label: "Clicks", value: fmt(Number(ad.link_clicks)), color: "text-yellow-400" },
                    { label: "Engagements", value: fmt(engagementsValue(ad)), color: "text-pink-400" },
                    { label: resultLabel(ad.result_indicator), value: fmt(Number(ad.results)), color: "text-fuchsia-400" },
                    { label: "CTR", value: fmtPct(Number(ad.ctr_link_click)), color: "text-lime-400" },
                ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg bg-white/3 p-2">
                        <p className={`text-xs font-bold ${color}`}>{value}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-4 pb-4">
                <div className="flex items-center gap-2 flex-wrap mb-3" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={onAddToPackage}
                        disabled={isPromoting}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                        Add to Package
                    </button>
                    <button
                        onClick={onAddToOffer}
                        disabled={isPromoting}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                        Add to Offer
                    </button>
                    {isPromoting && (
                        <span className="text-[10px] text-slate-400">Saving...</span>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                        <p className="text-emerald-200/80">Bookings</p>
                        <p className="mt-1 text-lg font-bold text-white">{bookingTotal}</p>
                        <p className="mt-1 text-[10px] text-emerald-200/70">Tracked from this ad campaign</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-slate-400">Schedule</p>
                        <p className="mt-1 text-sm font-semibold text-white">{dateSummary.durationLabel}</p>
                        <p className="mt-1 text-[10px] text-slate-400">Sri Lanka time</p>
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-lg bg-white/3 p-2">
                        <p className="text-slate-500">Objective</p>
                        <p className="text-white font-semibold mt-0.5">{objectiveLabel(ad)}</p>
                    </div>
                    <div className="rounded-lg bg-white/3 p-2.5">
                        <p className="text-slate-500">Cost Per Result</p>
                        <p className="text-white font-semibold mt-0.5">{fmtUsd(Number(ad.cost_per_result))}</p>
                    </div>
                    <div className="rounded-lg bg-white/3 p-2.5">
                        <p className="text-slate-500">Start Time</p>
                        <p className="text-white font-semibold mt-0.5">{dateSummary.startLabel}</p>
                    </div>
                    <div className="rounded-lg bg-white/3 p-2.5">
                        <p className="text-slate-500">End Time</p>
                        <p className="text-white font-semibold mt-0.5">{dateSummary.endLabel}</p>
                    </div>
                    <div className="hidden rounded-lg bg-white/3 p-2">
                        <p className="text-slate-500">Date Range</p>
                        <p className="text-white font-semibold mt-0.5">{ad.reporting_starts || "â€”"} to {ad.reporting_ends || ad.ends || "â€”"}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
