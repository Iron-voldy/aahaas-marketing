"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import {
    FileSpreadsheet, Download, Upload, Search, Filter, Calendar,
    Eye, MousePointerClick, Heart, MessageCircle, Share2, Bookmark,
    TrendingUp, Users, ChevronDown, ChevronUp, ExternalLink, X,
    BarChart3, RefreshCw, Loader2, Play, Image as ImageIcon, Grid3X3, List,
    GitCompare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { shouldBypassNextImageOptimization } from "@/lib/image";
import { cn } from "@/lib/utils";
import { BulkImportModal } from "@/components/packages/BulkImportModal";
import { getPackages } from "@/lib/db";
import type { Row } from "@/lib/types";
import { exportRecordToXlsx } from "@/lib/exporters";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, CartesianGrid,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PostRow {
    id: number;
    source_type: string;
    post_id: string;
    title: string;
    description: string;
    publish_time: string;
    permalink: string;
    post_type: string;
    reach: number;
    views: number;
    reactions: number;
    comments: number;
    shares: number;
    saves: number;
    total_clicks: number;
    link_clicks: number;
    other_clicks: number;
    three_sec_views: number;
    one_min_views: number;
    seconds_viewed: number;
    avg_seconds_viewed: number;
    profile_visits: number;
    follows: number;
    detected_category: string;
    detected_country: string | null;
    target_type: string | null;
    target_firebase_id: string | null;
    match_method: string | null;
    confidence: number | null;
    package_image_url: string | null;
}

interface Summary {
    totalPosts: number;
    totalReach: number;
    totalReactions: number;
    totalComments: number;
    totalShares: number;
    totalSaves: number;
    totalClicks: number;
    totalLinkClicks: number;
    totalViews: number;
    totalFollows: number;
    fbPosts: number;
    fbVideos: number;
    igPosts: number;
    igStories: number;
    packagePosts: number;
    offerPosts: number;
    generalPosts: number;
}

/** A grouped post: FB+IG same content merged together */
interface GroupedPost {
    groupKey: string;
    primaryPost: PostRow;
    platforms: PostRow[];
    fbPost: PostRow | null;
    igPost: PostRow | null;
    combinedReach: number;
    combinedReactions: number;
    combinedComments: number;
    combinedShares: number;
    combinedClicks: number;
    combinedSaves: number;
    combinedViews: number;
    combinedFollows: number;
    displayTitle: string;
    displayDate: string;
    category: string;
    country: string | null;
    imageUrl: string | null;
}

type SortKey = "date" | "reach" | "reactions" | "comments" | "shares" | "clicks";
type SortDir = "asc" | "desc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toLocaleString();
}

/** Extract a price mention from post text (PKR, LKR, USD, Rs, etc.) */
function extractPrice(text: string): string | null {
    if (!text) return null;
    // Match: "PKR 85,000" / "Rs. 5,000" / "LKR 1,25,000" / "From PKR 45,000" / "$500"
    const m = text.match(
        /(?:from\s+)?(?:pkr|lkr|usd|inr|myr|sgd|aed|bdt|rs\.?)\s*[\d][\d,]*/i
    );
    if (m) return m[0].trim().replace(/\s{2,}/g, " ");
    // "85,000 PKR" / "1,25,000 LKR"
    const m2 = text.match(/[\d][\d,]+\s*(?:pkr|lkr|usd|sgd)/i);
    if (m2) return m2[0].trim();
    return null;
}

function fmtDate(d: string): string {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getEmbeddablePostUrl(group: GroupedPost): string | null {
    return group.fbPost?.permalink || group.igPost?.permalink || group.primaryPost.permalink || null;
}

function toEmbedUrl(permalink: string | null): string | null {
    if (!permalink) return null;
    const url = permalink.trim();
    if (!url) return null;

    if (url.includes("instagram.com")) {
        const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
        if (!match?.[1]) return null;
        return `https://www.instagram.com/p/${match[1]}/embed/`;
    }

    if (url.includes("facebook.com") || url.includes("fb.watch")) {
        return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=false&width=500`;
    }

    return null;
}

function getMonthOptions(): { label: string; from: string; to: string }[] {
    const months: { label: string; from: string; to: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const from = d.toISOString().slice(0, 10);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const to = last.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        months.push({ label, from, to });
    }
    return months;
}

function aggregateMonthStats(posts: PostRow[]) {
    const fb = posts.filter(p => p.source_type === "fb_post" || p.source_type === "fb_video");
    const ig = posts.filter(p => p.source_type === "ig_post" || p.source_type === "ig_story");
    return {
        fbReach: fb.reduce((s, p) => s + (p.reach || 0), 0),
        igReach: ig.reduce((s, p) => s + (p.reach || 0), 0),
        fbReactions: fb.reduce((s, p) => s + (p.reactions || 0), 0),
        igReactions: ig.reduce((s, p) => s + (p.reactions || 0), 0),
        fbComments: fb.reduce((s, p) => s + (p.comments || 0), 0),
        igComments: ig.reduce((s, p) => s + (p.comments || 0), 0),
        fbShares: fb.reduce((s, p) => s + (p.shares || 0), 0),
        igShares: ig.reduce((s, p) => s + (p.shares || 0), 0),
        fbClicks: fb.reduce((s, p) => s + (p.total_clicks || 0), 0),
        igSaves: ig.reduce((s, p) => s + (p.saves || 0), 0),
        fbViews: fb.reduce((s, p) => s + (p.views || 0), 0),
        igViews: ig.reduce((s, p) => s + (p.views || 0), 0),
        posts: posts.length, fbPosts: fb.length, igPosts: ig.length,
    };
}

// Destination color themes for card thumbnails
const DEST_THEMES: Record<string, { gradient: string; emoji: string }> = {
    singapore: { gradient: "from-[#667eea] via-[#764ba2] to-[#f093fb]", emoji: "🦁" },
    malaysia: { gradient: "from-[#11998e] via-[#38ef7d] to-[#11998e]", emoji: "🏙️" },
    maldives: { gradient: "from-[#2af598] via-[#009efd] to-[#15aabf]", emoji: "🏝️" },
    kerala: { gradient: "from-[#f7971e] via-[#ffd200] to-[#f7971e]", emoji: "🌴" },
    india: { gradient: "from-[#f7971e] via-[#ffd200] to-[#f7971e]", emoji: "🇮🇳" },
    bali: { gradient: "from-[#fc4a1a] via-[#f7b733] to-[#fc4a1a]", emoji: "🌺" },
    dubai: { gradient: "from-[#c6a962] via-[#d4a843] to-[#8b6914]", emoji: "🏜️" },
    vietnam: { gradient: "from-[#56ab2f] via-[#a8e063] to-[#56ab2f]", emoji: "🇻🇳" },
    thailand: { gradient: "from-[#f953c6] via-[#b91d73] to-[#f953c6]", emoji: "🇹🇭" },
    turkey: { gradient: "from-[#e52d27] via-[#b31217] to-[#e52d27]", emoji: "🇹🇷" },
    japan: { gradient: "from-[#ff6b6b] via-[#ee5a6f] to-[#c44569]", emoji: "🇯🇵" },
};

function getDestTheme(country: string | null) {
    if (!country) return { gradient: "from-[#8b5cf6] via-[#6d28d9] to-[#4c1d95]", emoji: "✈️" };
    const key = country.toLowerCase().trim();
    for (const [k, v] of Object.entries(DEST_THEMES)) {
        if (key.includes(k) || k.includes(key)) return v;
    }
    return { gradient: "from-[#8b5cf6] via-[#6d28d9] to-[#4c1d95]", emoji: "✈️" };
}

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
    fb_post: { label: "FB Post", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    fb_video: { label: "FB Video", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
    ig_post: { label: "IG Post", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300" },
    ig_story: { label: "IG Story", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
    package: { label: "Package", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    seasonal_offer: { label: "Offer", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    general: { label: "General", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

function normalizeForGrouping(text: string): string {
    return text
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
        .replace(/[⭕️❤️🔥🎉✨💥😱🇱🇰🇲🇻🇸🇬🇲🇾🇮🇳]/g, "")
        .replace(/[#@]/g, "")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim()
        .slice(0, 80);
}

function isSameDay(d1: string, d2: string, toleranceDays = 2): boolean {
    if (!d1 || !d2) return false;
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    return Math.abs(t1 - t2) <= toleranceDays * 86400000;
}

function computeWordOverlap(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let overlap = 0;
    for (const w of wordsA) if (wordsB.has(w)) overlap++;
    return overlap / Math.min(wordsA.size, wordsB.size);
}

function groupPosts(posts: PostRow[]): GroupedPost[] {
    const groups: GroupedPost[] = [];
    const used = new Set<number>();
    const sorted = [...posts].sort((a, b) =>
        new Date(b.publish_time).getTime() - new Date(a.publish_time).getTime()
    );

    for (const post of sorted) {
        if (used.has(post.id)) continue;
        const matches: PostRow[] = [post];
        used.add(post.id);

        const normalizedText = normalizeForGrouping(post.title || post.description || "");

        for (const candidate of sorted) {
            if (used.has(candidate.id)) continue;
            if (candidate.source_type === post.source_type) continue;
            const candidateText = normalizeForGrouping(candidate.title || candidate.description || "");

            // Signal 1: both matched to the same Firebase package/offer
            const sameTarget =
                !!post.target_firebase_id &&
                post.target_firebase_id === candidate.target_firebase_id;

            // Signal 2: text similarity (existing check, loosened threshold)
            const textMatch = !!(normalizedText && candidateText) && (
                normalizedText.startsWith(candidateText.slice(0, 40)) ||
                candidateText.startsWith(normalizedText.slice(0, 40)) ||
                computeWordOverlap(normalizedText, candidateText) > 0.45
            );

            // Signal 3: same country + same non-general category (cross-post fallback)
            const sameCountryCategory =
                !!post.detected_country &&
                post.detected_country === candidate.detected_country &&
                post.detected_category !== "general" &&
                candidate.detected_category !== "general";

            if ((sameTarget || textMatch || sameCountryCategory) &&
                isSameDay(post.publish_time, candidate.publish_time, 2)) {
                matches.push(candidate);
                used.add(candidate.id);
            }
        }

        const fbPost = matches.find(p => p.source_type === "fb_post" || p.source_type === "fb_video") || null;
        const igPost = matches.find(p => p.source_type === "ig_post" || p.source_type === "ig_story") || null;
        const primary = fbPost || igPost || post;
        const title = primary.title || primary.description || "";
        const displayTitle = title || (primary.source_type.includes("video") ? "Video Post" : "Post");
        const imageUrl = primary.package_image_url || matches.find(p => p.package_image_url)?.package_image_url || null;

        groups.push({
            groupKey: `g-${post.id}`,
            primaryPost: primary,
            platforms: matches,
            fbPost, igPost,
            combinedReach: matches.reduce((s, p) => s + (p.reach || 0), 0),
            combinedReactions: matches.reduce((s, p) => s + (p.reactions || 0), 0),
            combinedComments: matches.reduce((s, p) => s + (p.comments || 0), 0),
            combinedShares: matches.reduce((s, p) => s + (p.shares || 0), 0),
            combinedClicks: matches.reduce((s, p) => s + (p.total_clicks || 0), 0),
            combinedSaves: matches.reduce((s, p) => s + (p.saves || 0), 0),
            combinedViews: matches.reduce((s, p) => s + (p.views || 0), 0),
            combinedFollows: matches.reduce((s, p) => s + (p.follows || 0), 0),
            displayTitle,
            displayDate: primary.publish_time,
            category: primary.detected_category,
            country: primary.detected_country,
            imageUrl,
        });
    }

    return groups;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportsClient() {
    const router = useRouter();
    const [posts, setPosts] = useState<PostRow[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [sourceFilter, setSourceFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
    const [sortKey, setSortKey] = useState<SortKey>("date");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [showUpload, setShowUpload] = useState(false);
    const [packages, setPackages] = useState<Row[]>([]);
    const [detailGroup, setDetailGroup] = useState<GroupedPost | null>(null);
    const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
    const [categorizingKey, setCategorizingKey] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: "package" | "offer" } | null>(null);

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.set("from", dateFrom);
            if (dateTo) params.set("to", dateTo);
            if (sourceFilter) params.set("source", sourceFilter);
            if (categoryFilter) params.set("category", categoryFilter);
            const resp = await fetch(`/api/reports/posts?${params.toString()}`, { credentials: "include" });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            setPosts(data.posts || []);
            setSummary(data.summary || null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, sourceFilter, categoryFilter]);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);
    useEffect(() => { getPackages().then(setPackages).catch(() => {}); }, []);

    const filteredPosts = useMemo(() => {
        if (!searchTerm.trim()) return posts;
        const q = searchTerm.toLowerCase();
        return posts.filter((p) =>
            (p.title || "").toLowerCase().includes(q) ||
            (p.description || "").toLowerCase().includes(q) ||
            (p.detected_country || "").toLowerCase().includes(q)
        );
    }, [posts, searchTerm]);

    const groupedPosts = useMemo(() => groupPosts(filteredPosts), [filteredPosts]);

    const sortedGroups = useMemo(() => {
        const sorted = [...groupedPosts];
        sorted.sort((a, b) => {
            let av: number, bv: number;
            switch (sortKey) {
                case "date": av = new Date(a.displayDate).getTime(); bv = new Date(b.displayDate).getTime(); break;
                case "reach": av = a.combinedReach; bv = b.combinedReach; break;
                case "reactions": av = a.combinedReactions; bv = b.combinedReactions; break;
                case "comments": av = a.combinedComments; bv = b.combinedComments; break;
                case "shares": av = a.combinedShares; bv = b.combinedShares; break;
                case "clicks": av = a.combinedClicks; bv = b.combinedClicks; break;
                default: av = 0; bv = 0;
            }
            return sortDir === "asc" ? av - bv : bv - av;
        });
        return sorted;
    }, [groupedPosts, sortKey, sortDir]);

    const visibleGroups = useMemo(
        () => sortedGroups.filter(g => !dismissedKeys.has(g.groupKey)),
        [sortedGroups, dismissedKeys]
    );

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("desc"); }
    };

    const handleCategorize = useCallback(async (
        group: GroupedPost,
        category: "package" | "seasonal_offer" | "ignore"
    ) => {
        setCategorizingKey(group.groupKey);
        try {
            const postIds = group.platforms.map(p => p.id);
            const primary = group.primaryPost;
            const payload: Record<string, unknown> = { postIds, category };

            if (category !== "ignore") {
                // Build post data payload so categorize API can pre-fill stats
                payload.postData = {
                    title: group.displayTitle,
                    description: primary.description || primary.title || "",
                    country: group.country || "",
                    imageUrl: group.imageUrl || "",
                    permalink: group.fbPost?.permalink || group.igPost?.permalink || "",
                    publishTime: group.displayDate,
                    fbReach: group.fbPost?.reach || 0,
                    fbReactions: group.fbPost?.reactions || 0,
                    fbComments: group.fbPost?.comments || 0,
                    fbShares: group.fbPost?.shares || 0,
                    igReach: group.igPost?.reach || 0,
                    igReactions: group.igPost?.reactions || 0,
                    igComments: group.igPost?.comments || 0,
                    igShares: group.igPost?.shares || 0,
                    igSaves: group.igPost?.saves || 0,
                };
            }

            const resp = await fetch("/api/reports/categorize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            const result = await resp.json().catch(() => null) as { error?: string } | null;
            if (!resp.ok) {
                throw new Error(result?.error || `HTTP ${resp.status}`);
            }

            setDismissedKeys(prev => {
                const next = new Set(prev);
                next.add(group.groupKey);
                return next;
            });
            setPosts(prev => prev.filter(post => !postIds.includes(post.id)));
            setDetailGroup(prev => prev?.groupKey === group.groupKey ? null : prev);

            if (category === "ignore") {
                await fetchPosts();
                return;
            }

            const msg = category === "package" ? "Added to Packages ✓" : "Added to Offers ✓";
            setToast({ msg, type: category === "package" ? "package" : "offer" });
            setTimeout(() => setToast(null), 3000);
            router.push(category === "package" ? "/packages" : "/offers");
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setCategorizingKey(null);
        }
    }, [fetchPosts, router]);

    const monthOptions = useMemo(() => getMonthOptions(), []);

    const setPresetRange = (days: number) => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days);
        setDateFrom(from.toISOString().slice(0, 10));
        setDateTo(to.toISOString().slice(0, 10));
    };

    const handleExport = () => {
        if (sortedGroups.length === 0) return;
        const headers = ["Date", "Platforms", "Category", "Country", "Title", "Combined Reach", "FB Reach", "IG Reach", "Reactions", "Comments", "Shares", "Saves", "Clicks", "Follows", "FB Permalink", "IG Permalink"];
        const csvRows = [headers.join(",")];
        for (const g of sortedGroups) {
            const row = [
                fmtDate(g.displayDate), g.platforms.map(p => p.source_type).join("+"), g.category, g.country || "",
                `"${g.displayTitle.slice(0, 80).replace(/"/g, '""')}"`,
                g.combinedReach, g.fbPost?.reach || 0, g.igPost?.reach || 0,
                g.combinedReactions, g.combinedComments, g.combinedShares, g.combinedSaves, g.combinedClicks, g.combinedFollows,
                g.fbPost?.permalink || "", g.igPost?.permalink || "",
            ];
            csvRows.push(row.join(","));
        }
        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `aahaas-report-${dateFrom || "all"}-to-${dateTo || "all"}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const kpis = summary ? [
        { label: "Total Reach", value: summary.totalReach, icon: Eye, color: "from-blue-500 to-cyan-500" },
        { label: "Reactions", value: summary.totalReactions, icon: Heart, color: "from-pink-500 to-rose-500" },
        { label: "Comments", value: summary.totalComments, icon: MessageCircle, color: "from-amber-500 to-orange-500" },
        { label: "Shares", value: summary.totalShares, icon: Share2, color: "from-emerald-500 to-teal-500" },
        { label: "Total Clicks", value: summary.totalClicks, icon: MousePointerClick, color: "from-violet-500 to-purple-500" },
        { label: "Saves", value: summary.totalSaves, icon: Bookmark, color: "from-indigo-500 to-blue-500" },
        { label: "Views", value: summary.totalViews, icon: BarChart3, color: "from-sky-500 to-blue-500" },
        { label: "Follows", value: summary.totalFollows, icon: Users, color: "from-green-500 to-emerald-500" },
    ] : [];

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Toast notification */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-semibold animate-in slide-in-from-right-4 duration-300 ${toast.type === "package" ? "bg-emerald-600 shadow-emerald-500/30" : "bg-amber-500 shadow-amber-500/30"}`}>
                    <span className="text-lg">{toast.type === "package" ? "📦" : "🌟"}</span>
                    {toast.msg}
                    <span className="text-[10px] font-normal opacity-75 ml-1">{toast.type === "package" ? "→ /packages" : "→ /offers"}</span>
                </div>
            )}
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <FileSpreadsheet className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Excel Reports</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Analyze all social media post performance</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden">
                        <button onClick={() => setViewMode("cards")} className={cn("p-2 transition-colors", viewMode === "cards" ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" : "text-slate-400 hover:text-slate-600")}>
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewMode("table")} className={cn("p-2 transition-colors", viewMode === "table" ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" : "text-slate-400 hover:text-slate-600")}>
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowUpload(true)} className="gap-2"><Upload className="w-4 h-4" /> Upload Sheets</Button>
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={sortedGroups.length === 0} className="gap-2"><Download className="w-4 h-4" /> Export CSV</Button>
                    <Button variant="outline" size="sm" onClick={fetchPosts} disabled={loading} className="gap-2"><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh</Button>
                </div>
            </div>

            {/* KPI Cards */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13131d] p-3 space-y-1">
                            <div className={cn("w-7 h-7 rounded-lg bg-linear-to-br flex items-center justify-center", kpi.color)}>
                                <kpi.icon className="w-3.5 h-3.5 text-white" />
                            </div>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{fmt(kpi.value)}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">{kpi.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Platform breakdown */}
            {summary && summary.totalPosts > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13131d] p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Posts by Platform & Category</span>
                        <span className="text-xs text-slate-400">{summary.totalPosts} total &middot; {sortedGroups.length} grouped</span>
                    </div>
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex items-center gap-6">
                            {[
                                { label: "FB Posts", val: summary.fbPosts, color: "bg-blue-500" },
                                { label: "FB Videos", val: summary.fbVideos, color: "bg-indigo-500" },
                                { label: "IG Posts", val: summary.igPosts, color: "bg-pink-500" },
                                { label: "IG Stories", val: summary.igStories, color: "bg-purple-500" },
                            ].map((s) => (
                                <div key={s.label} className="flex items-center gap-2">
                                    <div className={cn("w-2.5 h-2.5 rounded-full", s.color)} />
                                    <span className="text-xs text-slate-600 dark:text-slate-300">{s.label}: <strong>{s.val}</strong></span>
                                </div>
                            ))}
                        </div>
                        <div className="border-l border-slate-200 dark:border-white/10 pl-4 flex items-center gap-6">
                            {[
                                { label: "Packages", val: summary.packagePosts, color: "bg-emerald-500" },
                                { label: "Offers", val: summary.offerPosts, color: "bg-amber-500" },
                                { label: "General", val: summary.generalPosts, color: "bg-slate-400" },
                            ].map((s) => (
                                <div key={s.label} className="flex items-center gap-2">
                                    <div className={cn("w-2.5 h-2.5 rounded-full", s.color)} />
                                    <span className="text-xs text-slate-600 dark:text-slate-300">{s.label}: <strong>{s.val}</strong></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13131d] p-4 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Search posts by title, description, country..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={`${sortKey}-${sortDir}`} onChange={(e) => { const [k, d] = e.target.value.split("-") as [SortKey, SortDir]; setSortKey(k); setSortDir(d); }}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30">
                            <option value="date-desc">Latest First</option>
                            <option value="date-asc">Oldest First</option>
                            <option value="reach-desc">Highest Reach</option>
                            <option value="reactions-desc">Most Reactions</option>
                            <option value="comments-desc">Most Comments</option>
                            <option value="shares-desc">Most Shares</option>
                            <option value="clicks-desc">Most Clicks</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
                            <Filter className="w-4 h-4" /> Filters
                            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </Button>
                    </div>
                </div>

                {showFilters && (
                    <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-white/5">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date Range</label>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => setPresetRange(7)} className="text-xs">Last 7 Days</Button>
                                <Button variant="outline" size="sm" onClick={() => setPresetRange(30)} className="text-xs">Last 30 Days</Button>
                                <Button variant="outline" size="sm" onClick={() => setPresetRange(90)} className="text-xs">Last 90 Days</Button>
                                <Button variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs">All Time</Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
                                <span className="text-xs text-slate-400">to</span>
                                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Month</label>
                            <div className="flex flex-wrap gap-1.5">
                                {monthOptions.slice(0, 6).map((m) => (
                                    <Button key={m.from} variant="outline" size="sm" onClick={() => { setDateFrom(m.from); setDateTo(m.to); }}
                                        className={cn("text-xs", dateFrom === m.from && dateTo === m.to && "bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300")}>
                                        {m.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Platform</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {[{ value: "", label: "All" }, { value: "fb_post", label: "FB Posts" }, { value: "fb_video", label: "FB Videos" }, { value: "ig_post", label: "IG Posts" }, { value: "ig_story", label: "IG Stories" }].map((o) => (
                                        <Button key={o.value} variant="outline" size="sm" onClick={() => setSourceFilter(o.value)} className={cn("text-xs", sourceFilter === o.value && "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300")}>{o.label}</Button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {[{ value: "", label: "All" }, { value: "package", label: "Packages" }, { value: "seasonal_offer", label: "Offers" }, { value: "general", label: "General" }].map((o) => (
                                        <Button key={o.value} variant="outline" size="sm" onClick={() => setCategoryFilter(o.value)} className={cn("text-xs", categoryFilter === o.value && "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300")}>{o.label}</Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {(dateFrom || dateTo || sourceFilter || categoryFilter) && (
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                <span className="text-xs text-slate-400">Active:</span>
                                {dateFrom && <FilterChip label={`From: ${dateFrom}`} onClear={() => setDateFrom("")} />}
                                {dateTo && <FilterChip label={`To: ${dateTo}`} onClear={() => setDateTo("")} />}
                                {sourceFilter && <FilterChip label={SOURCE_BADGE[sourceFilter]?.label || sourceFilter} onClear={() => setSourceFilter("")} color="blue" />}
                                {categoryFilter && <FilterChip label={CATEGORY_BADGE[categoryFilter]?.label || categoryFilter} onClear={() => setCategoryFilter("")} color="emerald" />}
                                <button className="text-xs text-red-500 hover:text-red-600 ml-auto" onClick={() => { setDateFrom(""); setDateTo(""); setSourceFilter(""); setCategoryFilter(""); }}>Clear All</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {error && <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}
            {loading && <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /><span className="ml-3 text-sm text-slate-500">Loading posts...</span></div>}

            {/* Dismissed notification */}
            {dismissedKeys.size > 0 && (
                <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-3 flex items-center justify-between">
                    <span className="text-xs text-violet-700 dark:text-violet-300">
                        {dismissedKeys.size} post{dismissedKeys.size > 1 ? "s" : ""} categorized this session
                    </span>
                    <button
                        onClick={() => { setDismissedKeys(new Set()); fetchPosts(); }}
                        className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium"
                    >
                        Undo All &amp; Refresh
                    </button>
                </div>
            )}

            {/* ═══ CARD VIEW ═══ */}
            {!loading && visibleGroups.length > 0 && viewMode === "cards" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {visibleGroups.map((group) => (
                        <PostCard
                            key={group.groupKey}
                            group={group}
                            onClick={() => setDetailGroup(group)}
                            onCategorize={handleCategorize}
                            categorizing={categorizingKey === group.groupKey}
                        />
                    ))}
                </div>
            )}

            {/* ═══ TABLE VIEW ═══ */}
            {!loading && visibleGroups.length > 0 && viewMode === "table" && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13131d] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">
                                        <SortBtn label="Date" sortKey="date" current={sortKey} onSort={handleSort} />
                                    </th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Platforms</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-48">Post</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"><SortBtn label="Reach" sortKey="reach" current={sortKey} onSort={handleSort} /></th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"><SortBtn label="Reactions" sortKey="reactions" current={sortKey} onSort={handleSort} /></th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"><SortBtn label="Comments" sortKey="comments" current={sortKey} onSort={handleSort} /></th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"><SortBtn label="Shares" sortKey="shares" current={sortKey} onSort={handleSort} /></th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-14">Links</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-50">Categorize</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleGroups.map((g) => {
                                    const cat = CATEGORY_BADGE[g.category] || CATEGORY_BADGE.general;
                                    const isCategorizing = categorizingKey === g.groupKey;
                                    return (
                                        <tr key={g.groupKey} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/2 transition-colors cursor-pointer" onClick={() => setDetailGroup(g)}>
                                            <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{fmtDate(g.displayDate)}</td>
                                            <td className="px-4 py-3"><div className="flex gap-1">{g.platforms.map(p => { const src = SOURCE_BADGE[p.source_type]; return <span key={p.id} className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", src?.color || "bg-slate-100 text-slate-600")}>{src?.label || p.source_type}</span>; })}</div></td>
                                            <td className="px-4 py-3"><p className="text-xs font-medium text-slate-900 dark:text-white truncate max-w-72">{g.displayTitle.slice(0, 60)}</p>{g.country && <p className="text-[10px] text-slate-400 mt-0.5">{g.country}</p>}</td>
                                            <td className="px-4 py-3"><span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", cat.color)}>{cat.label}</span></td>
                                            <td className="px-4 py-3 text-right text-xs font-semibold text-slate-900 dark:text-white tabular-nums">{fmt(g.combinedReach)}</td>
                                            <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{fmt(g.combinedReactions)}</td>
                                            <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{fmt(g.combinedComments)}</td>
                                            <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{fmt(g.combinedShares)}</td>
                                            <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1">
                                                {g.fbPost?.permalink && <a href={g.fbPost.permalink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-700"><ExternalLink className="w-3 h-3" /></a>}
                                                {g.igPost?.permalink && <a href={g.igPost.permalink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-pink-500 hover:text-pink-700"><ExternalLink className="w-3 h-3" /></a>}
                                            </div></td>
                                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        disabled={isCategorizing}
                                                        onClick={() => handleCategorize(g, "package")}
                                                        className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 transition-colors disabled:opacity-40 whitespace-nowrap"
                                                    >
                                                        📦 Package
                                                    </button>
                                                    <button
                                                        disabled={isCategorizing}
                                                        onClick={() => handleCategorize(g, "seasonal_offer")}
                                                        className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 transition-colors disabled:opacity-40 whitespace-nowrap"
                                                    >
                                                        🌟 Offer
                                                    </button>
                                                    <button
                                                        disabled={isCategorizing}
                                                        onClick={() => handleCategorize(g, "ignore")}
                                                        className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-white/5 transition-colors disabled:opacity-40"
                                                    >
                                                        ✕ Ignore
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-white/5">
                        <span className="text-xs text-slate-400">Showing {visibleGroups.length} posts ({posts.length} raw){searchTerm && ` filtered by "${searchTerm}"`}</span>
                    </div>
                </div>
            )}

            {/* Empty */}
            {!loading && visibleGroups.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                        <FileSpreadsheet className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div className="text-center"><p className="font-semibold text-slate-700 dark:text-slate-200">No posts found</p><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Upload your Facebook & Instagram insight CSVs to get started.</p></div>
                    <Button onClick={() => setShowUpload(true)} className="gap-2"><Upload className="w-4 h-4" /> Upload Sheets</Button>
                </div>
            )}

            <BulkImportModal open={showUpload} onClose={() => setShowUpload(false)} packages={packages} onUpdateSuccess={() => { setShowUpload(false); fetchPosts(); getPackages().then(setPackages).catch(() => {}); }} />
            {detailGroup && <PostDetailModal group={detailGroup} allPosts={posts} onClose={() => setDetailGroup(null)} />}
        </div>
    );
}

// ─── Post Card ───────────────────────────────────────────────────────────────

function PostCard({ group, onClick, onCategorize, categorizing }: {
    group: GroupedPost;
    onClick: () => void;
    onCategorize: (group: GroupedPost, cat: "package" | "seasonal_offer" | "ignore") => void;
    categorizing: boolean;
}) {
    const [imgError, setImgError] = useState(false);
    const [embedError, setEmbedError] = useState(false);
    const theme = getDestTheme(group.country);
    const cat = CATEGORY_BADGE[group.category] || CATEGORY_BADGE.general;
    const isVideo = group.platforms.some(p => p.source_type === "fb_video");
    const hasMulti = group.platforms.length > 1;
    const hasImage = !!group.imageUrl && !imgError;
    const embedUrl = toEmbedUrl(getEmbeddablePostUrl(group));
    const hasEmbed = !hasImage && !!embedUrl && !embedError;

    const handleExportPostXlsx = () => {
        const exportData: Record<string, unknown> = {
            title: group.displayTitle,
            date: group.displayDate,
            category: group.category,
            country: group.country,
            imageUrl: group.imageUrl,
            combinedReach: group.combinedReach,
            combinedReactions: group.combinedReactions,
            combinedComments: group.combinedComments,
            combinedShares: group.combinedShares,
            combinedClicks: group.combinedClicks,
            combinedSaves: group.combinedSaves,
            combinedViews: group.combinedViews,
            combinedFollows: group.combinedFollows,
            fbPermalink: group.fbPost?.permalink,
            igPermalink: group.igPost?.permalink,
            platforms: group.platforms.map((p) => ({
                source: p.source_type,
                publishTime: p.publish_time,
                permalink: p.permalink,
                reach: p.reach,
                reactions: p.reactions,
                comments: p.comments,
                shares: p.shares,
                clicks: p.total_clicks,
                saves: p.saves,
                views: p.views,
            })),
        };
        exportRecordToXlsx(`post-${group.displayTitle.slice(0, 40)}`, exportData, "Post");
    };

    // Extract price from post text to show in the no-image placeholder
    const postText = group.primaryPost.title || group.primaryPost.description || "";
    const priceText = extractPrice(postText);

    return (
        <div className="group rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13131d] overflow-hidden hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/30 transition-all cursor-pointer hover:-translate-y-0.5" onClick={onClick}>
            <div className={cn("relative h-44 overflow-hidden", !hasImage && `bg-linear-to-br ${theme.gradient}`)}>
                {hasImage ? (
                    <NextImage
                        src={group.imageUrl!}
                        alt={group.displayTitle}
                        fill
                        unoptimized={shouldBypassNextImageOptimization(group.imageUrl)}
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        onError={() => setImgError(true)}
                    />
                ) : hasEmbed ? (
                    <iframe
                        src={embedUrl!}
                        title={group.displayTitle}
                        className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                        loading="lazy"
                        sandbox="allow-scripts allow-same-origin allow-popups"
                        referrerPolicy="no-referrer-when-downgrade"
                        onError={() => setEmbedError(true)}
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col justify-center items-start p-4 gap-2">
                        <span className="text-4xl opacity-40 select-none">{theme.emoji}</span>
                        {priceText && (
                            <span className="text-sm font-bold text-white bg-black/40 backdrop-blur-sm px-2.5 py-0.5 rounded-full">
                                {priceText}
                            </span>
                        )}
                        {postText && (
                            <p className="text-xs text-white/80 line-clamp-2 leading-snug drop-shadow">
                                {postText.replace(/\n+/g, " ").slice(0, 100)}
                            </p>
                        )}
                    </div>
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleExportPostXlsx();
                    }}
                    className="absolute top-3 left-3 z-20 px-2.5 h-7 rounded-lg bg-slate-900/85 text-white border border-white/20 text-[11px] font-semibold hover:bg-slate-800 transition-colors"
                    title="Export post details to Excel"
                >
                    Export
                </button>
                <div className="absolute top-3 left-24 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    {isVideo ? <Play className="w-4 h-4 text-white fill-white" /> : <ImageIcon className="w-4 h-4 text-white" />}
                </div>
                <div className="absolute top-3 right-3 flex gap-1">
                    {group.platforms.map(p => {
                        const isFb = p.source_type.startsWith("fb");
                        return <div key={p.id} className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg", isFb ? "bg-blue-600" : "bg-linear-to-br from-purple-600 to-pink-500")}>{isFb ? "f" : "IG"}</div>;
                    })}
                </div>
                <div className="absolute bottom-3 left-3">
                    <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm", cat.color)}>{cat.label}</span>
                </div>
                {hasMulti && <div className="absolute bottom-3 right-3"><span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white">FB + IG</span></div>}
            </div>
            <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">{fmtDate(group.displayDate)}</span>
                    {group.country && <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">{group.country}</span>}
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug line-clamp-2 min-h-[2.5rem]">{group.displayTitle.slice(0, 100)}</p>
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <MetricPill icon={Eye} value={group.combinedReach} label="Reach" />
                    <MetricPill icon={Heart} value={group.combinedReactions} label="React" />
                    <MetricPill icon={MessageCircle} value={group.combinedComments} label="Comments" />
                    <MetricPill icon={Share2} value={group.combinedShares} label="Shares" />
                </div>
                {(group.combinedClicks > 0 || group.combinedSaves > 0 || group.combinedViews > 0) && (
                    <div className="flex gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        {group.combinedClicks > 0 && <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> {fmt(group.combinedClicks)} clicks</span>}
                        {group.combinedSaves > 0 && <span className="flex items-center gap-1"><Bookmark className="w-3 h-3" /> {fmt(group.combinedSaves)} saves</span>}
                        {group.combinedViews > 0 && <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {fmt(group.combinedViews)} views</span>}
                    </div>
                )}
                {/* Categorize actions */}
                <div className="flex gap-1.5 pt-2 border-t border-slate-100 dark:border-white/5" onClick={e => e.stopPropagation()}>
                    <button
                        disabled={categorizing}
                        onClick={() => onCategorize(group, "package")}
                        title="Move to Packages"
                        className="flex-1 text-[10px] font-semibold py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 transition-colors disabled:opacity-40"
                    >
                        📦 Package
                    </button>
                    <button
                        disabled={categorizing}
                        onClick={() => onCategorize(group, "seasonal_offer")}
                        title="Move to Seasonal Offers"
                        className="flex-1 text-[10px] font-semibold py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 transition-colors disabled:opacity-40"
                    >
                        🌟 Offer
                    </button>
                    <button
                        disabled={categorizing}
                        onClick={() => onCategorize(group, "ignore")}
                        title="Ignore this post"
                        className="flex-1 text-[10px] font-semibold py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-white/5 transition-colors disabled:opacity-40"
                    >
                        ✕ Ignore
                    </button>
                </div>
            </div>
        </div>
    );
}

function MetricPill({ icon: Icon, value, label }: { icon: typeof Eye; value: number; label: string }) {
    return (
        <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5"><Icon className="w-3 h-3" /></div>
            <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">{fmt(value)}</p>
            <p className="text-[9px] text-slate-400 uppercase">{label}</p>
        </div>
    );
}

// ─── Detail Modal (Big 3-Pane) ───────────────────────────────────────────────

function PostDetailModal({ group, allPosts, onClose }: {
    group: GroupedPost;
    allPosts: PostRow[];
    onClose: () => void;
}) {
    const theme = getDestTheme(group.country);
    const cat = CATEGORY_BADGE[group.category] || CATEGORY_BADGE.general;
    const monthOptions = useMemo(() => getMonthOptions(), []);
    const [monthA, setMonthA] = useState(monthOptions[1]?.from || "");
    const [monthB, setMonthB] = useState(monthOptions[0]?.from || "");
    const [imgError, setImgError] = useState(false);
    const [embedError, setEmbedError] = useState(false);

    const getMonthPosts = useCallback((from: string) => {
        const opt = monthOptions.find(m => m.from === from);
        if (!opt) return [];
        return allPosts.filter(p => p.publish_time >= opt.from && p.publish_time <= opt.to);
    }, [allPosts, monthOptions]);

    const statsA = useMemo(() => aggregateMonthStats(getMonthPosts(monthA)), [getMonthPosts, monthA]);
    const statsB = useMemo(() => aggregateMonthStats(getMonthPosts(monthB)), [getMonthPosts, monthB]);
    const labelA = monthOptions.find(m => m.from === monthA)?.label || "Month A";
    const labelB = monthOptions.find(m => m.from === monthB)?.label || "Month B";

    // Current post FB vs IG chart data
    const postChartData = [
        { metric: "Reach", FB: group.fbPost?.reach || 0, IG: group.igPost?.reach || 0 },
        { metric: "React.", FB: group.fbPost?.reactions || 0, IG: group.igPost?.reactions || 0 },
        { metric: "Comments", FB: group.fbPost?.comments || 0, IG: group.igPost?.comments || 0 },
        { metric: "Shares", FB: group.fbPost?.shares || 0, IG: group.igPost?.shares || 0 },
        { metric: "Clicks", FB: group.fbPost?.total_clicks || 0, IG: group.igPost?.total_clicks || 0 },
        { metric: "Saves", FB: 0, IG: group.igPost?.saves || 0 },
    ];

    // Month comparison chart data
    const monthChartData = [
        { metric: "Reach", [labelA]: statsA.fbReach + statsA.igReach, [labelB]: statsB.fbReach + statsB.igReach },
        { metric: "React.", [labelA]: statsA.fbReactions + statsA.igReactions, [labelB]: statsB.fbReactions + statsB.igReactions },
        { metric: "Comments", [labelA]: statsA.fbComments + statsA.igComments, [labelB]: statsB.fbComments + statsB.igComments },
        { metric: "Shares", [labelA]: statsA.fbShares + statsA.igShares, [labelB]: statsB.fbShares + statsB.igShares },
    ];

    const compRows = [
        { label: "Reach", icon: Eye, fb: group.fbPost?.reach || 0, ig: group.igPost?.reach || 0 },
        { label: "Reactions", icon: Heart, fb: group.fbPost?.reactions || 0, ig: group.igPost?.reactions || 0 },
        { label: "Comments", icon: MessageCircle, fb: group.fbPost?.comments || 0, ig: group.igPost?.comments || 0 },
        { label: "Shares", icon: Share2, fb: group.fbPost?.shares || 0, ig: group.igPost?.shares || 0 },
        { label: "Clicks", icon: MousePointerClick, fb: group.fbPost?.total_clicks || 0, ig: group.igPost?.total_clicks || 0 },
        { label: "Saves", icon: Bookmark, fb: 0, ig: group.igPost?.saves || 0 },
        { label: "Views", icon: BarChart3, fb: group.fbPost?.views || 0, ig: group.igPost?.views || 0 },
        { label: "Follows", icon: Users, fb: group.fbPost?.follows || 0, ig: group.igPost?.follows || 0 },
    ];

    const hasImage = !!group.imageUrl && !imgError;
    const embedUrl = toEmbedUrl(getEmbeddablePostUrl(group));
    const hasEmbed = !hasImage && !!embedUrl && !embedError;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-[#0f0f1e] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden"
                style={{ width: "80vw", height: "70vh", maxWidth: "1400px" }}
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-white/8 bg-gradient-to-r from-violet-950/40 to-purple-900/20 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                            <GitCompare className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Post Analytics & Comparison</h2>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{fmtDate(group.displayDate)} &bull; {group.country || "All regions"}</p>
                        </div>
                        <div className="flex gap-1.5 ml-2">
                            {group.platforms.map(p => { const src = SOURCE_BADGE[p.source_type]; return <span key={p.id} className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", src?.color)}>{src?.label}</span>; })}
                            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", cat.color)}>{cat.label}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 3-Column Body */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── LEFT: Post Details ── */}
                    <div className="w-[26%] flex flex-col overflow-y-auto border-r border-slate-100 dark:border-white/8 flex-shrink-0">
                        {/* Image / Fallback */}
                        <div className={cn("relative w-full aspect-video flex-shrink-0", !hasImage && `bg-gradient-to-br ${theme.gradient}`)}>
                            {hasImage ? (
                                <NextImage src={group.imageUrl!} alt={group.displayTitle} fill unoptimized={shouldBypassNextImageOptimization(group.imageUrl)} className="object-cover" sizes="400px" onError={() => setImgError(true)} />
                            ) : hasEmbed ? (
                                <iframe
                                    src={embedUrl!}
                                    title={group.displayTitle}
                                    className="absolute inset-0 w-full h-full border-0"
                                    loading="lazy"
                                    sandbox="allow-scripts allow-same-origin allow-popups"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    onError={() => setEmbedError(true)}
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                    <span className="text-5xl opacity-40">{theme.emoji}</span>
                                    <span className="text-xs text-white/60 font-medium px-3 text-center line-clamp-2">{group.displayTitle.slice(0, 60)}</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        </div>
                        {/* Post info */}
                        <div className="p-4 flex flex-col gap-3 flex-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{group.displayTitle.slice(0, 120)}</p>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span>{fmtDate(group.displayDate)}</span>
                                </div>
                                {group.country && <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><Users className="w-3.5 h-3.5" /><span>{group.country}</span></div>}
                            </div>
                            {/* Platform links */}
                            <div className="flex flex-col gap-1.5">
                                {group.fbPost?.permalink && <a href={group.fbPost.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">f</span> View Facebook Post <ExternalLink className="w-3 h-3" />
                                </a>}
                                {group.igPost?.permalink && <a href={group.igPost.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-pink-600 dark:text-pink-400 hover:underline">
                                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-[9px] font-bold flex items-center justify-center">IG</span> View Instagram Post <ExternalLink className="w-3 h-3" />
                                </a>}
                            </div>
                            {/* Description */}
                            {(group.primaryPost.description || group.primaryPost.title) && (
                                <div className="mt-1 rounded-xl bg-slate-50 dark:bg-white/5 p-3">
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-6">{group.primaryPost.description || group.primaryPost.title}</p>
                                </div>
                            )}
                            {/* Combined summary chips */}
                            <div className="grid grid-cols-2 gap-1.5 mt-auto">
                                {[{l:"Reach",v:group.combinedReach},{l:"React.",v:group.combinedReactions},{l:"Comments",v:group.combinedComments},{l:"Shares",v:group.combinedShares}].map(s=>(
                                    <div key={s.l} className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/30 p-2 text-center">
                                        <p className="text-xs font-bold text-violet-700 dark:text-violet-300">{fmt(s.v)}</p>
                                        <p className="text-[9px] text-slate-400 uppercase">{s.l}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── MIDDLE: Comparison Table ── */}
                    <div className="flex-1 flex flex-col overflow-y-auto border-r border-slate-100 dark:border-white/8">
                        {/* Post FB vs IG Table */}
                        <div className="p-4 border-b border-slate-100 dark:border-white/8">
                            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-4 rounded-full bg-gradient-to-b from-blue-500 to-pink-500 inline-block" />
                                Facebook vs Instagram — This Post
                            </h3>
                            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-white/5">
                                            <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 w-24">Metric</th>
                                            <th className="text-center px-3 py-2.5 font-semibold text-[#1877F2] bg-blue-50/50 dark:bg-blue-900/10">Facebook</th>
                                            <th className="text-center px-3 py-2.5 font-semibold text-pink-500 bg-pink-50/50 dark:bg-pink-900/10">Instagram</th>
                                            <th className="text-center px-3 py-2.5 font-semibold text-violet-600 dark:text-violet-400">Combined</th>
                                            <th className="text-center px-3 py-2.5 font-semibold text-slate-400">Winner</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {compRows.map((row, i) => {
                                            const total = row.fb + row.ig;
                                            const fbPct = total > 0 ? Math.round(row.fb / total * 100) : 50;
                                            const winner = row.fb > row.ig ? "FB" : row.ig > row.fb ? "IG" : "Tie";
                                            return (
                                                <tr key={row.label} className={cn("border-t border-slate-100 dark:border-white/5", i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-white/[0.02]")}>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                            <row.icon className="w-3 h-3 text-slate-400" />{row.label}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <div className="font-bold text-blue-700 dark:text-blue-300">{fmt(row.fb)}</div>
                                                        <div className="w-full bg-blue-100 dark:bg-blue-900/20 rounded-full h-1 mt-1"><div className="bg-blue-500 h-1 rounded-full transition-all" style={{width:`${fbPct}%`}} /></div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <div className="font-bold text-pink-600 dark:text-pink-300">{fmt(row.ig)}</div>
                                                        <div className="w-full bg-pink-100 dark:bg-pink-900/20 rounded-full h-1 mt-1"><div className="bg-pink-500 h-1 rounded-full transition-all" style={{width:`${100-fbPct}%`}} /></div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center font-bold text-slate-900 dark:text-white">{fmt(total)}</td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", winner==="FB" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : winner==="IG" ? "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" : "bg-slate-100 text-slate-500")}>{winner}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Month Comparison */}
                        <div className="p-4">
                            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-4 rounded-full bg-gradient-to-b from-amber-400 to-violet-500 inline-block" />
                                Month-Wise Comparison
                            </h3>
                            <div className="flex gap-2 mb-4">
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Month A</label>
                                    <select value={monthA} onChange={e => setMonthA(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30">
                                        {monthOptions.map(m => <option key={m.from} value={m.from}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-end pb-1.5 text-slate-400 text-xs font-bold">vs</div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Month B</label>
                                    <select value={monthB} onChange={e => setMonthB(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30">
                                        {monthOptions.map(m => <option key={m.from} value={m.from}>{m.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-white/5">
                                            <th className="text-left px-3 py-2 font-semibold text-slate-500">Metric</th>
                                            <th className="text-center px-3 py-2 font-semibold text-amber-600 dark:text-amber-400">{labelA}</th>
                                            <th className="text-center px-3 py-2 font-semibold text-violet-600 dark:text-violet-400">{labelB}</th>
                                            <th className="text-center px-3 py-2 font-semibold text-slate-400">Change</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            {l:"FB Reach",a:statsA.fbReach,b:statsB.fbReach},
                                            {l:"IG Reach",a:statsA.igReach,b:statsB.igReach},
                                            {l:"FB Reactions",a:statsA.fbReactions,b:statsB.fbReactions},
                                            {l:"IG Reactions",a:statsA.igReactions,b:statsB.igReactions},
                                            {l:"FB Comments",a:statsA.fbComments,b:statsB.fbComments},
                                            {l:"IG Comments",a:statsA.igComments,b:statsB.igComments},
                                            {l:"FB Shares",a:statsA.fbShares,b:statsB.fbShares},
                                            {l:"IG Saves",a:statsA.igSaves,b:statsB.igSaves},
                                            {l:"Posts",a:statsA.posts,b:statsB.posts},
                                        ].map((row,i) => {
                                            const diff = row.a > 0 ? ((row.b - row.a) / row.a * 100) : 0;
                                            const isPos = diff >= 0;
                                            return (
                                                <tr key={row.l} className={cn("border-t border-slate-100 dark:border-white/5",i%2===0?"":"bg-slate-50/50 dark:bg-white/[0.02]")}>
                                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.l}</td>
                                                    <td className="px-3 py-2 text-center font-semibold text-amber-700 dark:text-amber-300">{fmt(row.a)}</td>
                                                    <td className="px-3 py-2 text-center font-semibold text-violet-700 dark:text-violet-300">{fmt(row.b)}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",isPos?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300":"bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400")}>{row.a===0?"+N/A":`${isPos?"+":""}${diff.toFixed(0)}%`}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT: Charts ── */}
                    <div className="w-[32%] flex flex-col overflow-y-auto p-4 gap-5 flex-shrink-0">
                        {/* Post FB vs IG Bar Chart */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">This Post — Platform Split</h3>
                            <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3">
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={postChartData} margin={{top:4,right:8,left:-16,bottom:0}}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                                        <XAxis dataKey="metric" tick={{fontSize:9,fill:"#94a3b8"}} />
                                        <YAxis tick={{fontSize:9,fill:"#94a3b8"}} />
                                        <Tooltip contentStyle={{background:"#1e1e2e",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:11}} />
                                        <Legend wrapperStyle={{fontSize:10}} />
                                        <Bar dataKey="FB" fill="#1877F2" radius={[3,3,0,0]} />
                                        <Bar dataKey="IG" fill="#E1306C" radius={[3,3,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Month Comparison Chart */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">Month Comparison Chart</h3>
                            <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3">
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={monthChartData} margin={{top:4,right:8,left:-16,bottom:0}}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                                        <XAxis dataKey="metric" tick={{fontSize:9,fill:"#94a3b8"}} />
                                        <YAxis tick={{fontSize:9,fill:"#94a3b8"}} />
                                        <Tooltip contentStyle={{background:"#1e1e2e",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:11}} />
                                        <Legend wrapperStyle={{fontSize:10}} />
                                        <Bar dataKey={labelA} fill="#f59e0b" radius={[3,3,0,0]} />
                                        <Bar dataKey={labelB} fill="#8b5cf6" radius={[3,3,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Month summary pills */}
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-2.5">
                                    <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase truncate">{labelA}</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{fmt(statsA.fbReach+statsA.igReach)}</p>
                                    <p className="text-[10px] text-slate-400">{statsA.posts} posts</p>
                                </div>
                                <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/30 p-2.5">
                                    <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase truncate">{labelB}</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{fmt(statsB.fbReach+statsB.igReach)}</p>
                                    <p className="text-[10px] text-slate-400">{statsB.posts} posts</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FilterChip({ label, onClear, color = "violet" }: { label: string; onClear: () => void; color?: string }) {
    const colors: Record<string, string> = {
        violet: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
        blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
        emerald: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    };
    return (
        <span className={cn("text-xs px-2 py-0.5 rounded-full flex items-center gap-1", colors[color] || colors.violet)}>
            {label}<button onClick={onClear}><X className="w-3 h-3" /></button>
        </span>
    );
}

function SortBtn({ label, sortKey: key, current, onSort }: { label: string; sortKey: SortKey; current: SortKey; onSort: (k: SortKey) => void }) {
    return (
        <button className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200" onClick={(e) => { e.stopPropagation(); onSort(key); }}>
            {label}<TrendingUp className={cn("w-3 h-3", current === key ? "text-violet-500" : "text-slate-300")} />
        </button>
    );
}
