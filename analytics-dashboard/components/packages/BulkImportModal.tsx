"use client";

import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    UploadCloud,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    Loader2,
    X,
    ChevronDown,
    ChevronUp,
    Package,
    Gift,
} from "lucide-react";
import type { Row } from "@/lib/types";
import type { SeasonalOffer } from "@/lib/db";
import { updatePackage, updateOffer, getOffers } from "@/lib/db";
import type {
    CsvPost,
    SourceType,
    PackageRef,
    OfferRef,
    PackageUpdate,
    OfferUpdate,
} from "@/lib/postIdentifier";

// ─── Props ───────────────────────────────────────────────────────────────────

interface BulkImportModalProps {
    open: boolean;
    onClose: () => void;
    packages: Row[];
    onUpdateSuccess: () => void;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = "upload" | "analyzing" | "review" | "applying" | "done";

interface DetectedFile {
    file: File;
    sourceType: SourceType;
    label: string;
    rowCount: number;
    posts: CsvPost[];
}

interface ApiResponse {
    sessionId: number;
    packageUpdates: PackageUpdate[];
    offerUpdates: OfferUpdate[];
    unmatchedPosts: Array<{
        sourceType: SourceType;
        postId: string;
        title: string;
        publishTime: string;
        detectedCategory: string;
        detectedCountry: string | null;
        reach: number;
        reactions: number;
    }>;
    stats: {
        total: number;
        fbPosts: number;
        fbVideos: number;
        igPosts: number;
        igStories: number;
        packagePosts: number;
        offerPosts: number;
        generalPosts: number;
        matched: number;
        unmatched: number;
    };
}

// ─── File Type Detection ─────────────────────────────────────────────────────

const SOURCE_LABELS: Record<SourceType, string> = {
    fb_post: "FB Posts",
    fb_video: "FB Videos",
    ig_post: "IG Posts",
    ig_story: "IG Stories",
};

const SOURCE_COLORS: Record<SourceType, string> = {
    fb_post: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    fb_video: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    ig_post: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
    ig_story: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

function detectSourceType(headers: string[]): SourceType | null {
    const h = headers.map((x) => x.toLowerCase().trim());
    if (h.includes("video asset id")) return "fb_video";
    if (h.includes("title") && h.includes("page id")) return "fb_post";
    if (h.includes("account id") && h.includes("navigation")) return "ig_story";
    if (h.includes("account id") && h.includes("follows")) return "ig_post";
    // Fallback heuristics
    if (h.includes("account id")) return "ig_post";
    if (h.includes("page id")) return "fb_post";
    return null;
}

// ─── CSV → CsvPost Extraction ────────────────────────────────────────────────

function toNum(v: unknown): number {
    if (v === undefined || v === null || v === "") return 0;
    const n = Number(String(v).replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
}

function extractPosts(
    rows: Record<string, string>[],
    sourceType: SourceType,
): CsvPost[] {
    return rows.map((r) => {
        const base: CsvPost = {
            sourceType,
            postId: r["Post ID"] || r["Video asset ID"] || "",
            pageOrAccountId: r["Page ID"] || r["Account ID"] || "",
            title: r["Title"] || "",
            description: r["Description"] || "",
            publishTime: r["Publish time"] || "",
            permalink: r["Permalink"] || "",
            postType: r["Post type"] || "",
            reach: toNum(r["Reach"]),
            views: toNum(r["Views"]),
            reactions: toNum(r["Reactions"] || r["Likes"]),
            comments: toNum(r["Comments"]),
            shares: toNum(r["Shares"]),
            saves: toNum(r["Saves"]),
            totalClicks: toNum(r["Total clicks"]),
            linkClicks: toNum(r["Link clicks"]),
            otherClicks: toNum(r["Other clicks"]),
            threeSecViews: toNum(r["3-second video views"]),
            oneMinViews: toNum(r["1-minute video views"]),
            secondsViewed: toNum(r["Seconds viewed"]),
            avgSecondsViewed: toNum(r["Average Seconds viewed"]),
            profileVisits: toNum(r["Profile visits"]),
            replies: toNum(r["Replies"]),
            navigation: toNum(r["Navigation"]),
            follows: toNum(r["Follows"]),
            adImpressions: toNum(r["Ad impressions"]),
            adCpm: toNum(r["Ad CPM (USD)"]),
            estimatedEarnings: toNum(r["Estimated earnings (USD)"]),
        };
        return base;
    });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BulkImportModal({
    open,
    onClose,
    packages,
    onUpdateSuccess,
}: BulkImportModalProps) {
    const [step, setStep] = useState<Step>("upload");
    const [detectedFiles, setDetectedFiles] = useState<DetectedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [apiResult, setApiResult] = useState<ApiResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [applyProgress, setApplyProgress] = useState(0);
    const [applyLog, setApplyLog] = useState<{ name: string; ok: boolean }[]>([]);
    const [reviewTab, setReviewTab] = useState<"packages" | "offers" | "unmatched">("packages");
    const [expandedPkg, setExpandedPkg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Reset ──
    const resetState = useCallback(() => {
        setStep("upload");
        setDetectedFiles([]);
        setApiResult(null);
        setError(null);
        setApplyProgress(0);
        setApplyLog([]);
        setReviewTab("packages");
        setExpandedPkg(null);
    }, []);

    const handleClose = useCallback(() => {
        resetState();
        onClose();
    }, [onClose, resetState]);

    // ── File Handling ──
    const processFiles = useCallback((fileList: FileList | File[]) => {
        const files = Array.from(fileList).filter(
            (f) => f.name.endsWith(".csv") || f.type === "text/csv",
        );
        if (files.length === 0) return;

        const results: DetectedFile[] = [...detectedFiles];

        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
                const headers = parsed.meta.fields || [];
                const sourceType = detectSourceType(headers);

                if (!sourceType) {
                    setError(`Could not detect file type for: ${file.name}`);
                    return;
                }

                const posts = extractPosts(
                    parsed.data as Record<string, string>[],
                    sourceType,
                );

                // Replace existing file of same type
                const existingIdx = results.findIndex((f) => f.sourceType === sourceType);
                const detected: DetectedFile = {
                    file,
                    sourceType,
                    label: SOURCE_LABELS[sourceType],
                    rowCount: posts.length,
                    posts,
                };
                if (existingIdx >= 0) {
                    results[existingIdx] = detected;
                } else {
                    results.push(detected);
                }
                setDetectedFiles([...results]);
                setError(null);
            };
            reader.readAsText(file);
        });
    }, [detectedFiles]);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            processFiles(e.dataTransfer.files);
        },
        [processFiles],
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) processFiles(e.target.files);
        },
        [processFiles],
    );

    const removeFile = useCallback(
        (sourceType: SourceType) => {
            setDetectedFiles((prev) => prev.filter((f) => f.sourceType !== sourceType));
        },
        [],
    );

    // ── Analyze ──
    const handleAnalyze = useCallback(async () => {
        setStep("analyzing");
        setError(null);

        try {
            // Prepare package refs
            const packageRefs: PackageRef[] = packages.map((pkg) => ({
                id: pkg.id || "",
                name: String(pkg["Package"] || pkg["package_name"] || ""),
                country: String(pkg["Country"] || pkg["country"] || ""),
                datePublished: String(pkg["Date Published"] || pkg["date_published"] || ""),
            }));

            // Fetch offers from MySQL
            let offerRefs: OfferRef[] = [];
            try {
                const offers: SeasonalOffer[] = await getOffers();
                offerRefs = offers.map((o) => ({
                    id: o.id || "",
                    name: o.name || "",
                    category: o.category || "",
                    datePublished: o.datePublished || "",
                }));
            } catch {
                // If offers can't be fetched, continue without them
                console.warn("Could not fetch offers, skipping offer matching");
            }

            // Build request
            const files: Record<string, CsvPost[]> = {};
            for (const df of detectedFiles) {
                files[df.sourceType === "fb_post" ? "fb_posts"
                    : df.sourceType === "fb_video" ? "fb_videos"
                    : df.sourceType === "ig_post" ? "ig_posts"
                    : "ig_stories"] = df.posts;
            }

            const resp = await fetch("/api/import-sheets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ files, packages: packageRefs, offers: offerRefs }),
            });

            if (!resp.ok) {
                const errBody = await resp.json().catch(() => ({}));
                throw new Error(errBody.error || `Server error ${resp.status}`);
            }

            const data: ApiResponse = await resp.json();
            setApiResult(data);
            setStep("review");
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setStep("upload");
        }
    }, [detectedFiles, packages]);

    // ── Apply ──
    const handleApply = useCallback(async () => {
        if (!apiResult) return;
        setStep("applying");
        setApplyLog([]);

        const totalUpdates =
            apiResult.packageUpdates.length + apiResult.offerUpdates.length;
        let done = 0;

        // Update packages
        for (const update of apiResult.packageUpdates) {
            try {
                const today = new Date().toISOString().split("T")[0];
                const extraFields: Record<string, string> = {};
                if (update.postUrls?.fb) extraFields["fb_permalink"] = update.postUrls.fb;
                if (update.postUrls?.ig) extraFields["ig_permalink"] = update.postUrls.ig;
                // Use first available permalink as the canonical postUrl
                const firstPermalink = update.postUrls?.fb || update.postUrls?.ig;
                if (firstPermalink) extraFields["postUrl"] = firstPermalink;
                await updatePackage(update.packageId, { ...update.metrics as Partial<Row>, ...extraFields }, today);
                setApplyLog((prev) => [...prev, { name: `📦 ${update.packageCountry} (${update.packageDate})`, ok: true }]);
            } catch (err) {
                console.error("Failed to update package:", update.packageId, err);
                setApplyLog((prev) => [...prev, { name: `📦 ${update.packageCountry}`, ok: false }]);
            }
            done++;
            setApplyProgress(Math.round((done / totalUpdates) * 100));
        }

        // Update offers
        for (const update of apiResult.offerUpdates) {
            try {
                const offerPermalink = update.postUrls?.fb || update.postUrls?.ig;
                await updateOffer(update.offerId, {
                    ...update.metrics,
                    ...(offerPermalink ? { postUrl: offerPermalink } : {}),
                });
                setApplyLog((prev) => [...prev, { name: `🎁 ${update.offerName}`, ok: true }]);
            } catch (err) {
                console.error("Failed to update offer:", update.offerId, err);
                setApplyLog((prev) => [...prev, { name: `🎁 ${update.offerName}`, ok: false }]);
            }
            done++;
            setApplyProgress(Math.round((done / totalUpdates) * 100));
        }

        setStep("done");
        onUpdateSuccess();
    }, [apiResult, onUpdateSuccess]);

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-[#111118] border-0 shadow-2xl rounded-2xl p-0">
                {/* Header */}
                <div className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/5">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                <UploadCloud className="h-4.5 w-4.5 text-white" />
                            </div>
                            {step === "upload" && "Import Insights"}
                            {step === "analyzing" && "Analyzing Posts..."}
                            {step === "review" && "Review Matches"}
                            {step === "applying" && "Applying Updates..."}
                            {step === "done" && "Import Complete"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {step === "upload" && "Drop your Facebook & Instagram Insights CSV exports into the slots below."}
                            {step === "analyzing" && "Using AI + keyword matching to identify and match posts to your packages & offers..."}
                            {step === "review" && "Review the matched posts and metrics before applying to your database."}
                            {step === "applying" && "Updating your database with matched metrics..."}
                            {step === "done" && "All matched metrics have been applied successfully."}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">

                {/* ── Upload Step ── */}
                {step === "upload" && (
                    <div className="space-y-5">
                        {/* 4-Slot Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {([
                                { type: "fb_post" as SourceType, label: "FB Posts", icon: "📘", color: "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20", accent: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
                                { type: "fb_video" as SourceType, label: "FB Videos", icon: "🎬", color: "border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20", accent: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" },
                                { type: "ig_post" as SourceType, label: "IG Posts", icon: "📸", color: "border-pink-200 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-950/20", accent: "text-pink-600 dark:text-pink-400", dot: "bg-pink-500" },
                                { type: "ig_story" as SourceType, label: "IG Stories", icon: "📱", color: "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20", accent: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
                            ]).map((slot) => {
                                const file = detectedFiles.find((f) => f.sourceType === slot.type);
                                return (
                                    <div
                                        key={slot.type}
                                        className={`relative rounded-xl border-2 border-dashed p-4 transition-all cursor-pointer hover:shadow-md ${
                                            file
                                                ? `border-solid ${slot.color} shadow-sm`
                                                : `border-slate-200 dark:border-white/10 hover:${slot.color}`
                                        }`}
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files); }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{slot.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-semibold ${slot.accent}`}>{slot.label}</p>
                                                {file ? (
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${slot.dot} animate-pulse`} />
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                            {file.file.name} &middot; {file.rowCount} posts
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                        Drop CSV here
                                                    </p>
                                                )}
                                            </div>
                                            {file ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeFile(slot.type); }}
                                                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            ) : (
                                                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5">
                                                    <UploadCloud className="h-3.5 w-3.5 text-slate-400" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            multiple
                            className="hidden"
                            onChange={handleFileInput}
                        />

                        {/* Or drop-all zone */}
                        <div
                            className={`rounded-xl border-2 border-dashed p-3 text-center cursor-pointer transition-colors ${
                                isDragging
                                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                                    : "border-slate-200 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/30"
                            }`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                Or drop all CSV files at once — they&apos;ll be auto-detected
                            </p>
                        </div>

                        {/* Status bar */}
                        <div className="flex items-center justify-between text-xs py-2">
                            <span className="text-slate-400">
                                {detectedFiles.length}/4 sheets loaded
                            </span>
                            <div className="flex gap-1">
                                {(["fb_post", "fb_video", "ig_post", "ig_story"] as SourceType[]).map((t) => (
                                    <div
                                        key={t}
                                        className={`w-2 h-2 rounded-full transition-colors ${
                                            detectedFiles.some((f) => f.sourceType === t)
                                                ? t.startsWith("fb") ? "bg-blue-500" : "bg-pink-500"
                                                : "bg-slate-200 dark:bg-white/10"
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <Button
                            onClick={handleAnalyze}
                            disabled={detectedFiles.length === 0}
                            className="w-full h-11 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-xl font-semibold shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:shadow-none"
                            size="lg"
                        >
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Analyze &amp; Match with AI
                        </Button>
                    </div>
                )}

                {/* ── Analyzing Step ── */}
                {step === "analyzing" && (
                    <div className="flex flex-col items-center justify-center py-16 gap-5">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-xl shadow-violet-500/20">
                                <Loader2 className="h-8 w-8 animate-spin text-white" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-white dark:border-[#111118] animate-pulse" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Processing {detectedFiles.reduce((s, f) => s + f.rowCount, 0)} posts
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                Running keyword matching + OpenAI analysis...
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Review Step ── */}
                {step === "review" && apiResult && (
                    <div className="space-y-4">
                        {/* Stats Summary */}
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { label: "Total Posts", value: apiResult.stats.total, color: "from-slate-500/10 to-slate-500/5", text: "text-slate-700 dark:text-slate-200" },
                                { label: "Packages", value: apiResult.packageUpdates.length, color: "from-blue-500/10 to-blue-500/5", text: "text-blue-700 dark:text-blue-300" },
                                { label: "Offers", value: apiResult.offerUpdates.length, color: "from-pink-500/10 to-pink-500/5", text: "text-pink-700 dark:text-pink-300" },
                                { label: "Unmatched", value: apiResult.stats.unmatched, color: "from-amber-500/10 to-amber-500/5", text: "text-amber-700 dark:text-amber-300" },
                            ].map((s) => (
                                <div key={s.label} className={`rounded-xl bg-gradient-to-br ${s.color} p-3 text-center border border-white/50 dark:border-white/5`}>
                                    <p className={`text-xl font-bold ${s.text}`}>{s.value}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Source Breakdown */}
                        <div className="flex gap-2 flex-wrap text-xs">
                            {apiResult.stats.fbPosts > 0 && (
                                <span className={`px-2 py-1 rounded-full ${SOURCE_COLORS.fb_post}`}>
                                    FB Posts: {apiResult.stats.fbPosts}
                                </span>
                            )}
                            {apiResult.stats.fbVideos > 0 && (
                                <span className={`px-2 py-1 rounded-full ${SOURCE_COLORS.fb_video}`}>
                                    FB Videos: {apiResult.stats.fbVideos}
                                </span>
                            )}
                            {apiResult.stats.igPosts > 0 && (
                                <span className={`px-2 py-1 rounded-full ${SOURCE_COLORS.ig_post}`}>
                                    IG Posts: {apiResult.stats.igPosts}
                                </span>
                            )}
                            {apiResult.stats.igStories > 0 && (
                                <span className={`px-2 py-1 rounded-full ${SOURCE_COLORS.ig_story}`}>
                                    IG Stories: {apiResult.stats.igStories}
                                </span>
                            )}
                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                General (skipped): {apiResult.stats.generalPosts}
                            </span>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 border-b">
                            {([
                                { key: "packages" as const, label: "Packages", icon: Package, count: apiResult.packageUpdates.length },
                                { key: "offers" as const, label: "Offers", icon: Gift, count: apiResult.offerUpdates.length },
                                { key: "unmatched" as const, label: "Unmatched", icon: AlertCircle, count: apiResult.unmatchedPosts.length },
                            ]).map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setReviewTab(tab.key)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors
                                        ${reviewTab === tab.key
                                            ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                            : "border-transparent text-muted-foreground hover:text-foreground"}`}
                                >
                                    <tab.icon className="h-3.5 w-3.5" />
                                    {tab.label}
                                    {tab.count > 0 && (
                                        <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="space-y-2">
                            {/* Packages Tab */}
                            {reviewTab === "packages" && (
                                apiResult.packageUpdates.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">No packages matched.</p>
                                ) : (
                                    apiResult.packageUpdates.map((update) => (
                                        <PackageUpdateCard
                                            key={update.packageId}
                                            update={update}
                                            expanded={expandedPkg === update.packageId}
                                            onToggle={() =>
                                                setExpandedPkg(
                                                    expandedPkg === update.packageId ? null : update.packageId,
                                                )
                                            }
                                        />
                                    ))
                                )
                            )}

                            {/* Offers Tab */}
                            {reviewTab === "offers" && (
                                apiResult.offerUpdates.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">No offers matched.</p>
                                ) : (
                                    apiResult.offerUpdates.map((update) => (
                                        <OfferUpdateCard key={update.offerId} update={update} />
                                    ))
                                )
                            )}

                            {/* Unmatched Tab */}
                            {reviewTab === "unmatched" && (
                                apiResult.unmatchedPosts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">All identified posts were matched!</p>
                                ) : (
                                    apiResult.unmatchedPosts.map((post, i) => (
                                        <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${SOURCE_COLORS[post.sourceType]}`}>
                                                {SOURCE_LABELS[post.sourceType]}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm truncate">{post.title || "(no title)"}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {post.publishTime} · {post.detectedCategory}{post.detectedCountry ? ` · ${post.detectedCountry}` : ""}
                                                </p>
                                            </div>
                                            <span className="text-xs text-muted-foreground shrink-0">
                                                Reach: {post.reach.toLocaleString()}
                                            </span>
                                        </div>
                                    ))
                                )
                            )}
                        </div>

                        {/* Apply Button */}
                        {(apiResult.packageUpdates.length > 0 || apiResult.offerUpdates.length > 0) && (
                            <Button onClick={handleApply} className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/20" size="lg">
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Apply {apiResult.packageUpdates.length} Packages &amp; {apiResult.offerUpdates.length} Offers
                            </Button>
                        )}
                    </div>
                )}

                {/* ── Applying Step ── */}
                {step === "applying" && (
                    <div className="space-y-4 py-4">
                        <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-3 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-violet-500 h-3 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${applyProgress}%` }}
                            />
                        </div>
                        <p className="text-sm text-center font-medium text-slate-600 dark:text-slate-300">
                            Applying updates... <span className="text-violet-600 dark:text-violet-400">{applyProgress}%</span>
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-slate-100 dark:border-white/5 p-3">
                            {applyLog.map((log, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                                    {log.ok ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                    ) : (
                                        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                    )}
                                    <span className="text-slate-600 dark:text-slate-400">{log.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Done Step ── */}
                {step === "done" && (
                    <div className="flex flex-col items-center py-10 gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/20">
                            <CheckCircle2 className="h-8 w-8 text-white" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-slate-900 dark:text-white">Import Complete!</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {applyLog.filter((l) => l.ok).length} items updated successfully
                                {applyLog.filter((l) => !l.ok).length > 0 && (
                                    <span className="text-red-500"> &middot; {applyLog.filter((l) => !l.ok).length} failed</span>
                                )}
                            </p>
                        </div>
                        <Button onClick={handleClose} variant="outline" className="rounded-xl px-6">Close</Button>
                    </div>
                )}

                </div>{/* end scrollable content */}
            </DialogContent>
        </Dialog>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PackageUpdateCard({
    update,
    expanded,
    onToggle,
}: {
    update: PackageUpdate;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="rounded-lg border overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-500" />
                    <div>
                        <span className="text-sm font-medium">{update.packageCountry}</span>
                        <span className="text-xs text-muted-foreground ml-2">{update.packageDate}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                        {update.matchedPosts.map((p, i) => (
                            <span
                                key={i}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${SOURCE_COLORS[p.sourceType]}`}
                            >
                                {SOURCE_LABELS[p.sourceType]}
                            </span>
                        ))}
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t p-3 bg-muted/30 space-y-3">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div className="font-medium text-xs text-muted-foreground col-span-2 mb-1">
                            Facebook Metrics
                        </div>
                        <MetricRow label="FB Reach" value={update.metrics["FB Reach"]} />
                        <MetricRow label="FB Reactions" value={update.metrics["FB Interactions (Reactions)"]} />
                        <MetricRow label="FB Clicks" value={update.metrics["FB Total Clicks"]} />
                        <MetricRow label="FB Link Clicks" value={update.metrics["FB Link Clicks"]} />
                        <MetricRow label="FB Comments" value={update.metrics["FB Interactions (Comments)"]} />
                        <MetricRow label="FB Shares" value={update.metrics["FB Interactions (Shares)"]} />

                        <div className="font-medium text-xs text-muted-foreground col-span-2 mt-2 mb-1">
                            Instagram Metrics
                        </div>
                        <MetricRow label="IG Reach" value={update.metrics["IG Reach"]} />
                        <MetricRow label="IG Reactions" value={update.metrics["IG Interactions (Reactions)"]} />
                        <MetricRow label="IG Comments" value={update.metrics["IG Interactions (Comments)"]} />
                        <MetricRow label="IG Shares" value={update.metrics["IG Interactions (Shares)"]} />
                        <MetricRow label="IG Saves" value={update.metrics["IG Interactions (Saves)"]} />

                        <div className="font-medium text-xs text-muted-foreground col-span-2 mt-2 mb-1">
                            Combined
                        </div>
                        <MetricRow label="Combined Reach" value={update.metrics["Combined Reach"]} highlight />
                    </div>

                    {/* Matched Posts */}
                    <div className="space-y-1 pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground">Matched Posts:</p>
                        {update.matchedPosts.map((p, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                                <span className={`px-1.5 py-0.5 rounded shrink-0 ${SOURCE_COLORS[p.sourceType]}`}>
                                    {SOURCE_LABELS[p.sourceType]}
                                </span>
                                <span className="truncate flex-1">{p.title || "(no title)"}</span>
                                <span className="text-muted-foreground shrink-0">
                                    {p.confidence}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function OfferUpdateCard({ update }: { update: OfferUpdate }) {
    return (
        <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-pink-500" />
                <span className="text-sm font-medium">{update.offerName}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                    {update.offerCategory}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
                {update.metrics.fbReach !== undefined && (
                    <MetricRow label="FB Reach" value={update.metrics.fbReach} />
                )}
                {update.metrics.igReach !== undefined && (
                    <MetricRow label="IG Reach" value={update.metrics.igReach} />
                )}
                {update.metrics.combinedReach !== undefined && (
                    <MetricRow label="Combined" value={update.metrics.combinedReach} highlight />
                )}
            </div>
        </div>
    );
}

function MetricRow({
    label,
    value,
    highlight,
}: {
    label: string;
    value: number | undefined;
    highlight?: boolean;
}) {
    if (value === undefined) return null;
    return (
        <div className="flex justify-between">
            <span className={highlight ? "font-medium" : "text-muted-foreground"}>{label}</span>
            <span className={highlight ? "font-bold text-blue-600 dark:text-blue-400" : "font-medium"}>
                {value.toLocaleString()}
            </span>
        </div>
    );
}
