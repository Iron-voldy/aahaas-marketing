"use client";

import { useState, useMemo, useEffect } from "react";
import { LayoutGrid, Table2, GitCompare, X, Search, RefreshCw, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PackageCard } from "@/components/packages/PackageCard";
import { PackageDetailModal } from "@/components/packages/PackageDetailModal";
import { PackageComparisonPanel } from "@/components/packages/PackageComparisonPanel";
import { PackagesTable } from "@/components/table/PackagesTable";
import { PostLinkModal } from "@/components/packages/PostLinkModal";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";
import type { Row, InferredSchema } from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewMode = "cards" | "table";

interface PackagesClientProps {
    rows: Row[];
    schema: InferredSchema;
}

// Map row number (1-indexed, zero-padded to 2 digits) → /images/packages/01.jpg
function getFlyerImage(rowIndex: number): string {
    const n = String(rowIndex + 1).padStart(2, "0");
    return `/images/packages/${n}.jpg`;
}

export function PackagesClient({ rows: initialRows, schema }: PackagesClientProps) {
    const [viewMode, setViewMode] = useState<ViewMode>("cards");
    const [search, setSearch] = useState("");
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [detailRow, setDetailRow] = useState<Row | null>(null);
    const [showComparison, setShowComparison] = useState(false);

    // Social Sync State
    const [links, setLinks] = useState<Record<number, any>>({});
    const [linkingIndex, setLinkingIndex] = useState<number | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Fetch saved links on mount
    useEffect(() => {
        fetch("/api/packages/sync")
            .then(res => res.json())
            .then(data => {
                if (data.links) setLinks(data.links);
            })
            .catch(console.error);
    }, []);

    // Merge CSV rows with active live stats from links
    const rows = useMemo(() => {
        return initialRows.map((tr, i) => {
            const link = links[i];
            if (!link || !link.latest_stats) return tr;

            // Merge social stats keeping original schema format
            const row = { ...tr };
            const s = link.latest_stats;

            // Update FB
            if (s.facebook) {
                const fbReachKey = Object.keys(row).find(k => k.startsWith("fb_") && k.includes("reach"));
                const fbReactKey = Object.keys(row).find(k => k.startsWith("fb_") && k.includes("react"));
                const fbCommentKey = Object.keys(row).find(k => k.startsWith("fb_") && k.includes("comment"));
                const fbShareKey = Object.keys(row).find(k => k.startsWith("fb_") && k.includes("share"));
                const fbClicksKey = Object.keys(row).find(k => k.startsWith("fb_") && k.includes("click") && !k.includes("link"));

                if (fbReachKey && s.facebook.reach !== undefined) row[fbReachKey] = s.facebook.reach;
                if (fbReactKey && s.facebook.reactions !== undefined) row[fbReactKey] = s.facebook.reactions;
                if (fbCommentKey && s.facebook.comments !== undefined) row[fbCommentKey] = s.facebook.comments;
                if (fbShareKey && s.facebook.shares !== undefined) row[fbShareKey] = s.facebook.shares;
                if (fbClicksKey && s.facebook.clicks !== undefined) row[fbClicksKey] = s.facebook.clicks;
            }

            // Update IG
            if (s.instagram) {
                const igReachKey = Object.keys(row).find(k => k.startsWith("ig_") && k.includes("reach"));
                const igReactKey = Object.keys(row).find(k => k.startsWith("ig_") && k.includes("react"));
                const igCommentKey = Object.keys(row).find(k => k.startsWith("ig_") && k.includes("comment"));
                const igSaveKey = Object.keys(row).find(k => k.startsWith("ig_") && k.includes("save"));

                if (igReachKey && s.instagram.reach !== undefined) row[igReachKey] = s.instagram.reach;
                if (igReactKey && s.instagram.reactions !== undefined) row[igReactKey] = s.instagram.reactions;
                if (igCommentKey && s.instagram.comments !== undefined) row[igCommentKey] = s.instagram.comments;
                if (igSaveKey && s.instagram.saves !== undefined) row[igSaveKey] = s.instagram.saves;
            }

            // Update Total Reach
            const totalReachKey = Object.keys(row).find(k => k.includes("total") && k.includes("reach"));
            if (totalReachKey) {
                const fbR = s.facebook?.reach || 0;
                const igR = s.instagram?.reach || 0;
                if (fbR || igR) row[totalReachKey] = fbR + igR;
            }

            return row;
        });
    }, [initialRows, links]);

    // Filter rows preserving original CSV indices (for correct image mapping)
    const filteredRows = useMemo(() => {
        const term = search.trim().toLowerCase();
        return rows
            .map((row, originalIndex) => ({ row, originalIndex }))
            .filter(({ row }) =>
                !term || Object.values(row).some((v) =>
                    String(v ?? "").toLowerCase().includes(term)
                )
            );
    }, [rows, search]);

    const selectedRows = selectedIndices
        .map((origIdx) => rows[origIdx])
        .filter(Boolean);

    const toggleSelect = (originalIndex: number) => {
        setSelectedIndices((prev) => {
            if (prev.includes(originalIndex)) return prev.filter((i) => i !== originalIndex);
            if (prev.length >= 4) return prev;
            return [...prev, originalIndex];
        });
    };

    const clearSelection = () => setSelectedIndices([]);
    const removeFromComparison = (i: number) => {
        setSelectedIndices((prev) => prev.filter((_, idx) => idx !== i));
    };

    // Calculate totals
    const sum = (col?: string) => col ? rows.reduce((s, r) => s + (typeof r[col] === "number" ? (r[col] as number) : 0), 0) : 0;
    const fbReachCol = schema.numericColumns.find(c => c.startsWith("fb_") && c.includes("reach"));
    const igReachCol = schema.numericColumns.find(c => c.startsWith("ig_") && c.includes("reach"));
    const totalReachCol = schema.numericColumns.find(c => c.includes("total") && c.includes("reach"));

    const fbTotal = sum(fbReachCol);
    const igTotal = sum(igReachCol);
    const combinedTotal = sum(totalReachCol) || (fbTotal + igTotal);

    // --- Action Handlers --- 

    const handleLinkPost = async (fbId: string, igId: string) => {
        if (linkingIndex === null) return;

        try {
            const updatePayload = {
                rowIndex: linkingIndex,
                fb_post_id: fbId,
                ig_post_id: igId,
            };

            const res = await fetch("/api/packages/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates: [updatePayload] }),
            });
            const data = await res.json();
            if (data.links) setLinks(data.links);
        } catch (e: any) {
            console.error(e);
            alert("Failed to link post: " + e.message);
        }
    };

    const handleSyncAll = async () => {
        const linkedIndices = Object.keys(links).map(Number).filter(i => links[i].fb_post_id || links[i].ig_post_id);
        if (linkedIndices.length === 0) {
            alert("No packages have been linked to social posts yet. Click 'Link Post' on a package first.");
            return;
        }

        setIsSyncing(true);
        try {
            const updates = [];

            for (const idx of linkedIndices) {
                const link = links[idx];
                const stats: any = {};

                if (link.fb_post_id) {
                    const res = await fetch(`/api/facebook/insights?platform=facebook&postId=${link.fb_post_id}`);
                    const fbData = await res.json();
                    if (fbData.success) stats.facebook = fbData.data;
                }

                if (link.ig_post_id) {
                    const res = await fetch(`/api/facebook/insights?platform=instagram&postId=${link.ig_post_id}`);
                    const igData = await res.json();
                    if (igData.success) stats.instagram = igData.data;
                }

                if (Object.keys(stats).length > 0) {
                    updates.push({ rowIndex: idx, stats });
                }
            }

            if (updates.length > 0) {
                const res = await fetch("/api/packages/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ updates }),
                });
                const data = await res.json();
                if (data.links) setLinks(data.links);
            }
        } catch (e: any) {
            alert("Error syncing posts: " + e.message);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex flex-col min-h-full pb-8">
            <div className="sticky top-0 z-20 bg-slate-50 dark:bg-[#0a0a0f] border-b border-slate-200 dark:border-white/5 px-4 lg:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                            Packages
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {filteredRows.length} packages — click flyers to explore stats
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* New Sync Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl gap-2 font-semibold text-emerald-600 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                            onClick={handleSyncAll}
                            disabled={isSyncing}
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                            {isSyncing ? "Syncing API..." : "Auto-Sync Stats"}
                        </Button>

                        <div className="flex rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden ml-2">
                            <button
                                onClick={() => setViewMode("cards")}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                                    viewMode === "cards" ? "bg-violet-600 text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                                )}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                Cards
                            </button>
                            <button
                                onClick={() => setViewMode("table")}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-slate-200 dark:border-white/10",
                                    viewMode === "table" ? "bg-violet-600 text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                                )}
                            >
                                <Table2 className="w-3.5 h-3.5" />
                                Table
                            </button>
                        </div>

                        {selectedIndices.length > 0 && (
                            <Button size="sm" className="h-9 rounded-xl gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 ml-2" onClick={() => setShowComparison(!showComparison)}>
                                <GitCompare className="w-3.5 h-3.5" />
                                Compare ({selectedIndices.length})
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                    <div className="flex items-center gap-2 bg-[#1877F2]/10 dark:bg-[#1877F2]/15 rounded-full px-3 py-1">
                        <FacebookLogo className="w-4 h-4" />
                        <span className="text-xs font-semibold text-[#1877F2]">{fbTotal.toLocaleString()} total reach</span>
                    </div>
                    <div className="flex items-center gap-2 bg-pink-500/10 dark:bg-pink-500/15 rounded-full px-3 py-1">
                        <InstagramLogo className="w-4 h-4" />
                        <span className="text-xs font-semibold text-pink-500">{igTotal.toLocaleString()} total reach</span>
                    </div>
                    <div className="flex items-center gap-2 bg-violet-500/10 dark:bg-violet-500/15 rounded-full px-3 py-1">
                        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">{combinedTotal.toLocaleString()} combined</span>
                    </div>
                </div>
            </div>

            <div className="px-4 lg:px-6 pt-5 space-y-5">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                        placeholder="Search packages by country, date..."
                        className="pl-9 h-9 rounded-xl text-sm bg-white dark:bg-[#111118] border-slate-200 dark:border-white/10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setSearch("")}>
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {showComparison && selectedRows.length > 0 && (
                    <PackageComparisonPanel rows={selectedRows} onRemove={removeFromComparison} onClear={() => { clearSelection(); setShowComparison(false); }} />
                )}

                {selectedIndices.length > 0 && !showComparison && (
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">
                        <Badge className="bg-violet-600 text-white border-0 rounded-full text-xs">{selectedIndices.length} selected</Badge>
                        <span className="text-xs text-violet-700 dark:text-violet-300">Select up to 4 packages to compare side-by-side</span>
                        <button onClick={clearSelection} className="ml-auto text-xs text-violet-500 hover:text-violet-700">Clear</button>
                    </div>
                )}

                {viewMode === "cards" && (
                    <>
                        {filteredRows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <Search className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm">No packages match your search.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
                                {filteredRows.map(({ row, originalIndex }) => (
                                    <PackageCard
                                        key={originalIndex}
                                        row={row}
                                        index={originalIndex}
                                        isSelected={selectedIndices.includes(originalIndex)}
                                        onToggleSelect={() => toggleSelect(originalIndex)}
                                        onViewDetail={() => setDetailRow(row)}
                                        onLinkPost={() => setLinkingIndex(originalIndex)}
                                        imagePath={getFlyerImage(originalIndex)}
                                        isLinked={!!links[originalIndex]?.fb_post_id || !!links[originalIndex]?.ig_post_id}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {viewMode === "table" && (
                    <PackagesTable rows={filteredRows.map(f => f.row)} globalFilter={search} />
                )}
            </div>

            <PackageDetailModal row={detailRow} open={!!detailRow} onClose={() => setDetailRow(null)} />

            <PostLinkModal
                open={linkingIndex !== null}
                onClose={() => setLinkingIndex(null)}
                currentFbId={linkingIndex !== null ? links[linkingIndex]?.fb_post_id : undefined}
                currentIgId={linkingIndex !== null ? links[linkingIndex]?.ig_post_id : undefined}
                onLink={handleLinkPost}
            />
        </div>
    );
}
