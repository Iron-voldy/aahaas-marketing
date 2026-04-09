"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Gift, Plus, Search, X, Loader2, LayoutGrid, List,
    Image as ImageIcon, Upload, Trash2, Edit2, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OfferCard } from "@/components/offers/OfferCard";
import { OfferDetailModal } from "@/components/offers/OfferDetailModal";
import { getOffers, addOffer, updateOffer, deleteOffer } from "@/lib/db";
import type { SeasonalOffer } from "@/lib/db";
import { cn } from "@/lib/utils";
import {
    getContentSourceLabel,
    getOfferSource,
    matchesContentSource,
    normalizeContentSource,
    type ContentSourceFilter,
} from "@/lib/contentSource";

// ── Category options ────────────────────────────────────────────────────────
const OFFER_CATEGORIES = [
    "Spa", "Buffet", "Happy Hour", "Weekend Getaway", "Staycation",
    "Room Offer", "Dining Offer", "Seasonal Promotion", "Other"
];

// ── Form field definitions ──────────────────────────────────────────────────
const GENERAL_FIELDS = [
    { name: "name", type: "text", label: "Offer Name *", required: true },
    { name: "description", type: "text", label: "Description" },
    { name: "validityPeriod", type: "text", label: "Validity Period (e.g. Dec 2024 – Feb 2025)" },
    { name: "datePublished", type: "text", label: "Date Published (e.g. 01-Dec-24)" },
    { name: "price", type: "text", label: "Offer Price (e.g. LKR 2,500 per person)" },
    { name: "originalPrice", type: "text", label: "Original Price (optional, for strikethrough)" },
    { name: "postUrl", type: "url", label: "Post URL (Facebook/Instagram link, optional)" },
];

const FB_FIELDS = [
    { name: "fbReach", type: "number", label: "FB Reach" },
    { name: "fbReactions", type: "number", label: "FB Reactions" },
    { name: "fbComments", type: "number", label: "FB Comments" },
    { name: "fbShares", type: "number", label: "FB Shares" },
    { name: "fbClicks", type: "number", label: "FB Total Clicks" },
];

const IG_FIELDS = [
    { name: "igReach", type: "number", label: "IG Reach" },
    { name: "igReactions", type: "number", label: "IG Reactions" },
    { name: "igComments", type: "number", label: "IG Comments" },
    { name: "igShares", type: "number", label: "IG Shares" },
    { name: "igSaves", type: "number", label: "IG Saves" },
];

const BOOST_FIELDS = [
    { name: "adSpend", type: "number", label: "Ad Spend (USD)" },
    { name: "impressions", type: "number", label: "Impressions" },
    { name: "conversations", type: "number", label: "Messaging Conversations" },
];

type FormData = Record<string, string | number>;

// ── The main client component ───────────────────────────────────────────────
export function OffersClient() {
    const [offers, setOffers] = useState<SeasonalOffer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
    const [sourceFilter, setSourceFilter] = useState<ContentSourceFilter>("all");

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormData>({});
    const [category, setCategory] = useState("Spa");
    const [postType, setPostType] = useState<"single" | "group">("single");
    const [isBoosted, setIsBoosted] = useState(false);
    const [imageUrlInputs, setImageUrlInputs] = useState<string[]>([""]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Detail modal
    const [detailOffer, setDetailOffer] = useState<SeasonalOffer | null>(null);

    // --- Data loading ---
    const loadOffers = async () => {
        setIsLoading(true);
        try {
            const data = await getOffers();
            setOffers(data);
        } catch (err) {
            console.error("Failed to load offers", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadOffers(); }, []);

    // Auto-compute combined reach
    useEffect(() => {
        const fb = Number(formData["fbReach"]) || 0;
        const ig = Number(formData["igReach"]) || 0;
        const combined = fb + ig;
        setFormData(prev => {
            if (prev["combinedReach"] !== combined) return { ...prev, combinedReach: combined };
            return prev;
        });
    }, [formData["fbReach"], formData["igReach"]]);

    // --- Filtered list ---
    const filteredOffers = useMemo(() => {
        const term = search.trim().toLowerCase();
        return offers.filter(o => {
            const matchesSearch = !term ||
                String(o.name || "").toLowerCase().includes(term) ||
                String(o.category || "").toLowerCase().includes(term) ||
                String(o.description || "").toLowerCase().includes(term);

            const offerCategory = o.category || "Other";
            const matchesCategory = activeCategory === "All" || offerCategory.toLowerCase() === activeCategory.toLowerCase();

            return matchesSearch && matchesCategory;
        });
    }, [offers, search, activeCategory]);

    const sourceFilteredOffers = useMemo(
        () => filteredOffers.filter((offer) => matchesContentSource(getOfferSource(offer), sourceFilter)),
        [filteredOffers, sourceFilter]
    );

    // Unique categories from data
    const categories = useMemo(() => {
        const cats = Array.from(
            new Set(
                offers
                    .map((o) => o.category || "Other")
                    .filter((category) => !!category && normalizeContentSource(category) !== "ads_campaign")
            )
        );
        return ["All", ...cats.sort()];
    }, [offers]);

    // --- Handlers ---
    const handleInput = (name: string, value: string, type: string) => {
        setFormData(prev => ({
            ...prev,
            [name]: type === "number" ? (value === "" ? "" : Number(value)) : value
        }));
    };

    const resetForm = () => {
        setFormData({});
        setCategory("Spa");
        setPostType("single");
        setIsBoosted(false);
        setImageUrlInputs([""]);
        setEditingId(null);
        setShowForm(false);
    };

    const handleEdit = (offer: SeasonalOffer) => {
        const { id, category: cat, postType: pType, isBoosted: boosted, imageUrl, imageUrls, ...rest } = offer;
        const cleaned: FormData = {};
        Object.entries(rest).forEach(([k, v]) => {
            if (v !== undefined && v !== null) cleaned[k] = v as string | number;
        });
        setFormData(cleaned);
        setCategory(cat || "Spa");
        setPostType(pType || "single");
        setIsBoosted(!!boosted);
        setEditingId(id || null);
        setImageUrlInputs(imageUrls && imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [""]);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id: string | undefined) => {
        if (!id) return;
        if (!confirm("Delete this offer? This cannot be undone.")) return;
        try {
            await deleteOffer(id);
            setOffers(prev => prev.filter(o => o.id !== id));
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData["name"]) { alert("Offer Name is required."); return; }
        setIsSubmitting(true);
        try {
            // Use entered image URLs directly
            const finalUrls = imageUrlInputs.map(u => u.trim()).filter(Boolean);
            const primaryImageUrl = finalUrls.length > 0 ? finalUrls[0] : undefined;

            const payload: Omit<SeasonalOffer, "id"> = {
                ...formData as any,
                category,
                postType,
                isBoosted,
                ...(primaryImageUrl ? { imageUrl: primaryImageUrl } : {}),
                ...(finalUrls.length > 0 ? { imageUrls: finalUrls } : {}),
            };

            if (!isBoosted) {
                BOOST_FIELDS.forEach(f => { delete (payload as any)[f.name]; });
            }

            if (editingId) {
                await updateOffer(editingId, payload);
            } else {
                await addOffer(payload);
            }

            resetForm();
            await loadOffers();
        } catch (err: any) {
            console.error("Save failed", err);
            alert(`Failed to save: ${err?.message || String(err)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin w-8 h-8 text-violet-500" />
                <p className="text-sm text-slate-500">Loading seasonal offers…</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full pb-12">
            {/* ── Page Header ── */}
            <div className="sticky top-0 z-20 bg-slate-50 dark:bg-[#0a0a0f] border-b border-slate-200 dark:border-white/5 px-4 lg:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Gift className="w-5 h-5 text-violet-500" />
                            Seasonal Offers
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {filteredOffers.length} offer{filteredOffers.length !== 1 ? "s" : ""} — spa, buffet, promotions & more
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View toggle */}
                        <div className="flex rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                            <button
                                onClick={() => setViewMode("cards")}
                                className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors", viewMode === "cards" ? "bg-violet-600 text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white")}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" /> Cards
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-slate-200 dark:border-white/10", viewMode === "list" ? "bg-violet-600 text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white")}
                            >
                                <List className="w-3.5 h-3.5" /> List
                            </button>
                        </div>

                        <Button
                            onClick={() => { resetForm(); setShowForm(true); }}
                            className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-9 text-sm gap-1.5"
                        >
                            <Plus className="w-4 h-4" /> Add Offer
                        </Button>
                    </div>
                </div>

                {/* Search + category filters */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-3">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                            placeholder="Search offers…"
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

                    <div className="flex items-center gap-1.5 flex-wrap">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                                    activeCategory === cat
                                        ? "bg-violet-600 text-white border-transparent"
                                        : "text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-violet-300 hover:text-violet-600"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mr-1">
                            Source
                        </span>
                        {(["all", "post", "ads_campaign"] as ContentSourceFilter[]).map(source => (
                            <button
                                key={source}
                                onClick={() => setSourceFilter(source)}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                                    sourceFilter === source
                                        ? "bg-violet-600 text-white border-transparent"
                                        : "text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-violet-300 hover:text-violet-600"
                                )}
                            >
                                {getContentSourceLabel(source)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="px-4 lg:px-6 pt-5 space-y-5">
                {/* ── Add / Edit Form ── */}
                {showForm && (
                    <Card className="border-violet-200 dark:border-violet-500/20 shadow-md">
                        <CardHeader className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 pb-4">
                            <CardTitle className="flex items-center gap-2">
                                <Gift className="w-4 h-4 text-violet-500" />
                                {editingId ? "Edit Offer" : "Add New Seasonal Offer"}
                            </CardTitle>
                            <CardDescription>
                                {editingId ? "Update the details for this offer." : "Publish a new spa, buffet, or seasonal promotion."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-8">

                                {/* Category selector */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 pb-2">
                                        Offer Category <span className="text-red-500">*</span>
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {OFFER_CATEGORIES.map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setCategory(cat)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                                                    category === cat
                                                        ? "bg-violet-600 text-white border-transparent shadow-sm"
                                                        : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-violet-300"
                                                )}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Post Type selection */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 pb-2">
                                        Post Type
                                    </h3>
                                    <Select value={postType} onValueChange={(val: "single" | "group") => setPostType(val)}>
                                        <SelectTrigger className="w-[180px] bg-white dark:bg-[#111118]">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="single">Single Layout</SelectItem>
                                            <SelectItem value="group">Group Layout (Multiple)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* General fields */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 pb-2">General Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {GENERAL_FIELDS.map(field => (
                                            <div key={field.name} className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{field.label}</label>
                                                <Input
                                                    type="text"
                                                    value={formData[field.name] ?? ""}
                                                    onChange={(e) => handleInput(field.name, e.target.value, field.type)}
                                                    className="h-9 text-sm border-slate-200 dark:border-white/10 bg-white dark:bg-black/40"
                                                    required={field.required}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Image URLs */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between">
                                        <span>Offer Image{postType === "group" ? "s" : ""}</span>
                                        {postType === "group" && (
                                            <Button type="button" variant="outline" size="sm" onClick={() => setImageUrlInputs(prev => [...prev, ""])}>
                                                <Plus className="w-3 h-3 mr-1" /> Add URL
                                            </Button>
                                        )}
                                    </h3>
                                    <div className="flex flex-col gap-3 p-2">
                                        {imageUrlInputs.map((url, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                                    {url.trim() ? (
                                                        <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                    ) : (
                                                        <ImageIcon className="w-5 h-5 opacity-30" />
                                                    )}
                                                </div>
                                                <Input
                                                    type="url"
                                                    placeholder="https://example.com/image.jpg"
                                                    value={url}
                                                    onChange={(e) => setImageUrlInputs(prev => prev.map((u, i) => i === idx ? e.target.value : u))}
                                                    className="h-9 text-sm border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 flex-1"
                                                />
                                                {imageUrlInputs.length > 1 && (
                                                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-red-400 hover:text-red-500 w-8 h-8" onClick={() => setImageUrlInputs(prev => prev.filter((_, i) => i !== idx))}>
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Paste direct image URLs (JPG, PNG, etc.)</p>
                                    </div>
                                </div>

                                {/* FB & IG Metrics */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 pb-2">Facebook Metrics</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {FB_FIELDS.map(f => (
                                                <div key={f.name} className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5">
                                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{f.label}</label>
                                                    <Input type="number" step="any" value={formData[f.name] ?? ""} onChange={(e) => handleInput(f.name, e.target.value, "number")} className="h-9 text-sm border-slate-200 dark:border-white/10 bg-white dark:bg-black/40" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 pb-2">Instagram Metrics</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {IG_FIELDS.map(f => (
                                                <div key={f.name} className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5">
                                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{f.label}</label>
                                                    <Input type="number" step="any" value={formData[f.name] ?? ""} onChange={(e) => handleInput(f.name, e.target.value, "number")} className="h-9 text-sm border-slate-200 dark:border-white/10 bg-white dark:bg-black/40" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Combined reach (read-only) */}
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-3">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Combined Reach (auto-calculated):</span>
                                    <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                                        {((Number(formData["fbReach"]) || 0) + (Number(formData["igReach"]) || 0)).toLocaleString()}
                                    </span>
                                </div>

                                {/* Boost Results */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Boost / Ad Results</h3>
                                        <div className="flex items-center gap-2">
                                            <label htmlFor="offer-boosted" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">Was this offer boosted?</label>
                                            <Switch id="offer-boosted" checked={isBoosted} onCheckedChange={setIsBoosted} />
                                        </div>
                                    </div>
                                    {isBoosted ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {BOOST_FIELDS.map(f => (
                                                <div key={f.name} className="space-y-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                                                    <label className="text-xs font-semibold text-amber-900 dark:text-amber-200">{f.label}</label>
                                                    <Input type="number" step="any" value={formData[f.name] ?? ""} onChange={(e) => handleInput(f.name, e.target.value, "number")} className="h-9 text-sm bg-white dark:bg-black/40 border-amber-200 dark:border-amber-500/20" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 text-center text-sm text-slate-500">
                                            Toggle switch to enter boost metrics (Ad Spend, Impressions, etc.)
                                        </div>
                                    )}
                                </div>

                                {/* Form actions */}
                                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-white/5">
                                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                                    <Button type="submit" disabled={isSubmitting} className="bg-violet-600 hover:bg-violet-700 text-white min-w-[140px]">
                                        {isSubmitting ? (
                                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…</>
                                        ) : (
                                            <><Upload className="w-4 h-4 mr-2" />{editingId ? "Update Offer" : "Publish Offer"}</>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* ── Offers Grid ── */}
                {sourceFilteredOffers.length === 0 && !showForm ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
                        <Gift className="w-12 h-12 opacity-20" />
                        <p className="text-sm">
                            {offers.length === 0
                                ? "No seasonal offers yet. Click \"Add Offer\" to create the first one!"
                                : "No offers match your search."}
                        </p>
                    </div>
                ) : viewMode === "cards" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
                        {sourceFilteredOffers.map(offer => (
                            <OfferCard
                                key={offer.id}
                                offer={offer}
                                onViewDetail={() => setDetailOffer(offer)}
                                onEdit={() => handleEdit(offer)}
                                onDelete={() => handleDelete(offer.id)}
                            />
                        ))}
                    </div>
                ) : (
                    /* ── List View ── */
                    <div className="flex flex-col gap-2">
                        {sourceFilteredOffers.map(offer => (
                            <div
                                key={offer.id}
                                className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#111118] border border-slate-200 dark:border-white/5 hover:border-violet-300 dark:hover:border-violet-500/30 transition-all"
                            >
                                {offer.imageUrl ? (
                                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                                        <img src={offer.imageUrl} alt={offer.name} className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center flex-shrink-0 text-2xl">
                                        🎁
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-900 dark:text-white truncate">{offer.name}</span>
                                        <Badge className="text-[10px] h-4 px-1.5 py-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 shrink-0">
                                            {offer.category}
                                        </Badge>
                                    </div>
                                    {offer.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{offer.description}</p>}
                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                        {offer.datePublished && <span>{offer.datePublished}</span>}
                                        {offer.price && <span className="font-medium text-violet-600 dark:text-violet-400">{offer.price}</span>}
                                        {(offer.fbReach || offer.igReach) && (
                                            <span>Reach: {((offer.fbReach ?? 0) + (offer.igReach ?? 0)).toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setDetailOffer(offer)} title="View Stats"><Tag className="w-3.5 h-3.5" /></Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-slate-500 hover:text-slate-900" onClick={() => handleEdit(offer)} title="Edit"><Edit2 className="w-3.5 h-3.5" /></Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => handleDelete(offer.id)} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail modal */}
            <OfferDetailModal
                offer={detailOffer}
                open={!!detailOffer}
                onClose={() => setDetailOffer(null)}
            />
        </div>
    );
}
