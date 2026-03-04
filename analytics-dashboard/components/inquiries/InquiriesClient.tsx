"use client";

import { useState, useEffect, useMemo } from "react";
import {
    PhoneCall, Package, Gift, Search, X, Loader2, Edit2, CheckCircle2,
    Calendar, TrendingUp, Users, Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getPackages, getOffers, updatePackage, updateOffer } from "@/lib/firebase/db";
import type { Row } from "@/lib/types";
import type { SeasonalOffer } from "@/lib/firebase/db";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type CombinedItem = {
    id: string;
    type: "package" | "offer";
    name: string;
    dateText: string;
    category: string;
    inquiries: number;
    inquiriesFb: number;
    inquiriesIg: number;
    inquiriesWa: number;
    inquiriesWeb: number;
    inquiriesOther: number;
    bookings: number;
    imageUrl?: string;
    source: Row | SeasonalOffer;
};

// --- Modal for updating ---
function UpdateModal({
    item,
    open,
    onClose,
    onSaved
}: {
    item: CombinedItem | null;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [formData, setFormData] = useState({
        inquiriesFb: 0,
        inquiriesIg: 0,
        inquiriesWa: 0,
        inquiriesWeb: 0,
        inquiriesOther: 0,
        bookings: 0
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (item) {
            setFormData({
                inquiriesFb: item.inquiriesFb || 0,
                inquiriesIg: item.inquiriesIg || 0,
                inquiriesWa: item.inquiriesWa || 0,
                inquiriesWeb: item.inquiriesWeb || 0,
                inquiriesOther: item.inquiriesOther || 0,
                bookings: item.bookings || 0
            });
        }
    }, [item]);

    // auto sum inquiries
    const totalInquiries =
        (Number(formData.inquiriesFb) || 0) +
        (Number(formData.inquiriesIg) || 0) +
        (Number(formData.inquiriesWa) || 0) +
        (Number(formData.inquiriesWeb) || 0) +
        (Number(formData.inquiriesOther) || 0);

    const handleInput = (key: keyof typeof formData, value: string) => {
        setFormData(prev => ({
            ...prev,
            [key]: value === "" ? "" : Number(value)
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!item || !item.id) return;
        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                inquiries: totalInquiries
            };
            if (item.type === "package") {
                await updatePackage(item.id, payload);
            } else {
                await updateOffer(item.id, payload);
            }
            onSaved();
            onClose();
        } catch (error) {
            console.error("Save failed", error);
            alert("Failed to save updates.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="sm:max-w-xl bg-slate-50 dark:bg-[#111118] border-slate-200 dark:border-white/10 p-0 overflow-hidden">
                <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white pb-8 relative">
                    <Badge className="bg-white/20 text-white hover:bg-white/30 border-0 mb-3 rounded-full">
                        {item.type === "package" ? "Package" : "Seasonal Offer"}
                    </Badge>
                    <DialogTitle className="text-2xl font-bold">{item.name}</DialogTitle>
                    <DialogDescription className="text-white/80 mt-1">
                        Update booking and inquiry details for this item.
                    </DialogDescription>
                </div>

                <form onSubmit={handleSave} className="p-6 pt-2 space-y-6">
                    <div className="bg-white dark:bg-white/5 rounded-2xl p-5 -mt-8 shadow-sm border border-slate-100 dark:border-white/5 relative z-10">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <PhoneCall className="w-4 h-4 text-violet-500" />
                            Inquiries by Source
                        </h4>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {[
                                { key: "inquiriesFb", label: "Facebook" },
                                { key: "inquiriesIg", label: "Instagram" },
                                { key: "inquiriesWa", label: "WhatsApp" },
                                { key: "inquiriesWeb", label: "Website" },
                                { key: "inquiriesOther", label: "Other" },
                            ].map(field => (
                                <div key={field.key} className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{field.label}</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={formData[field.key as keyof typeof formData] === 0 && !formData[field.key as keyof typeof formData].toString().includes("0") ? "" : formData[field.key as keyof typeof formData]}
                                        onChange={(e) => handleInput(field.key as keyof typeof formData, e.target.value)}
                                        className="h-9 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 text-sm"
                                    />
                                </div>
                            ))}

                            <div className="flex flex-col justify-center items-center p-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20">
                                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Total</span>
                                <span className="text-xl font-black text-violet-700 dark:text-violet-300">{totalInquiries}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-white/5 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-white/5">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Confirmed Bookings
                        </h4>
                        <div className="flex items-center gap-4">
                            <div className="w-full max-w-xs space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Total Bookings</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.bookings === 0 && !formData.bookings.toString().includes("0") ? "" : formData.bookings}
                                    onChange={(e) => handleInput("bookings", e.target.value)}
                                    className="h-10 text-lg font-bold bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                                />
                            </div>
                            {totalInquiries > 0 && (
                                <div className="mt-5 text-sm text-slate-500 dark:text-slate-400">
                                    Conversion Rate: <span className="font-bold text-slate-900 dark:text-white">
                                        {Math.round(((Number(formData.bookings) || 0) / totalInquiries) * 100)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isSaving} className="bg-violet-600 hover:bg-violet-700 text-white min-w-[120px]">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}


// --- Main Page ---
export function InquiriesClient() {
    const [items, setItems] = useState<CombinedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState<"all" | "package" | "offer">("all");

    const [editingItem, setEditingItem] = useState<CombinedItem | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [pkgs, offers] = await Promise.all([getPackages(), getOffers()]);

            const combined: CombinedItem[] = [];

            pkgs.forEach(p => {
                const name = (p["Package"] || p["Destination"] || "Unnamed Package") as string;
                const imageUrl = (p["imageUrl"] || p["image_url"] || p["thumbnail"] || p["image"] || p["Image"]) as string | undefined;
                combined.push({
                    id: p.id!,
                    type: "package",
                    name,
                    dateText: (p["Date Published"] || p["date_published"] || "N/A") as string,
                    category: "Package",
                    inquiries: Number(p.inquiries) || 0,
                    inquiriesFb: Number(p.inquiriesFb) || 0,
                    inquiriesIg: Number(p.inquiriesIg) || 0,
                    inquiriesWa: Number(p.inquiriesWa) || 0,
                    inquiriesWeb: Number(p.inquiriesWeb) || 0,
                    inquiriesOther: Number(p.inquiriesOther) || 0,
                    bookings: Number(p.bookings) || 0,
                    imageUrl,
                    source: p
                });
            });

            offers.forEach(o => {
                const imageUrl = o.imageUrl || (o.imageUrls?.[0]);
                combined.push({
                    id: o.id!,
                    type: "offer",
                    name: o.name,
                    dateText: o.datePublished || "N/A",
                    category: o.category || "Offer",
                    inquiries: Number(o.inquiries) || 0,
                    inquiriesFb: Number(o.inquiriesFb) || 0,
                    inquiriesIg: Number(o.inquiriesIg) || 0,
                    inquiriesWa: Number(o.inquiriesWa) || 0,
                    inquiriesWeb: Number(o.inquiriesWeb) || 0,
                    inquiriesOther: Number(o.inquiriesOther) || 0,
                    bookings: Number(o.bookings) || 0,
                    imageUrl,
                    source: o
                });
            });

            // Sort by recently published or name loosely
            combined.sort((a, b) => {
                // simple name sort fallback, ideally we'd parse date but keeping it simple
                if (a.bookings !== b.bookings) {
                    return b.bookings - a.bookings; // sort by most bookings first
                }
                return a.name.localeCompare(b.name);
            });

            setItems(combined);
        } catch (err) {
            console.error("Failed to load combined inquiries data", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const filteredItems = useMemo(() => {
        const term = search.trim().toLowerCase();
        return items.filter(item => {
            const matchSearch = !term || item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term);
            const matchType = filterType === "all" || item.type === filterType;
            return matchSearch && matchType;
        });
    }, [items, search, filterType]);

    // Aggregate stats for filtered items
    const totalStats = useMemo(() => {
        return filteredItems.reduce((acc, curr) => ({
            inquiries: acc.inquiries + curr.inquiries,
            bookings: acc.bookings + curr.bookings
        }), { inquiries: 0, bookings: 0 });
    }, [filteredItems]);

    return (
        <div className="flex flex-col min-h-full pb-12">
            {/* Header Sticky */}
            <div className="sticky top-0 z-20 bg-slate-50 dark:bg-[#0a0a0f] border-b border-slate-200 dark:border-white/5 px-4 lg:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <PhoneCall className="w-5 h-5 text-violet-500" />
                            Bookings & Inquiries
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Track conversion rates for packages and seasonal offers.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex bg-white dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                            <div className="px-3 py-1 flex flex-col items-center">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Inquiries</span>
                                <span className="text-sm font-black text-slate-900 dark:text-white">{totalStats.inquiries}</span>
                            </div>
                            <div className="w-px bg-slate-200 dark:bg-white/10 mx-1" />
                            <div className="px-3 py-1 flex flex-col items-center">
                                <span className="text-[10px] uppercase font-bold text-emerald-500">Bookings</span>
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{totalStats.bookings}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-4">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search names or categories…"
                            className="pl-9 h-10 rounded-xl text-sm bg-white dark:bg-[#111118]"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setSearch("")}>
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex p-1 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                        <button
                            onClick={() => setFilterType("all")}
                            className={cn("px-4 py-1.5 text-xs font-medium rounded-lg transition-colors", filterType === "all" ? "bg-white dark:bg-[#1e1e24] shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                        >
                            All Items
                        </button>
                        <button
                            onClick={() => setFilterType("package")}
                            className={cn("px-4 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5", filterType === "package" ? "bg-white dark:bg-[#1e1e24] shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                        >
                            <Package className="w-3.5 h-3.5" /> Packages
                        </button>
                        <button
                            onClick={() => setFilterType("offer")}
                            className={cn("px-4 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5", filterType === "offer" ? "bg-white dark:bg-[#1e1e24] shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                        >
                            <Gift className="w-3.5 h-3.5" /> Offers
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-4 lg:px-6 pt-5">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin w-8 h-8 text-violet-500" />
                        <p className="text-sm text-slate-500">Loading records…</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                        <Database className="w-12 h-12 opacity-20" />
                        <p className="text-sm">No items found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredItems.map(item => (
                            <Card key={item.id + item.type} className="border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow group dark:bg-[#111118] overflow-hidden">
                                <CardContent className="p-0 flex flex-row h-full">
                                    {/* Thumbnail left side */}
                                    <div className="w-[90px] sm:w-[130px] lg:w-[140px] flex-shrink-0 bg-slate-100 dark:bg-white/5 relative border-r border-slate-100 dark:border-white/5">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover absolute inset-0" />
                                        ) : (
                                            <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/5 dark:to-white/10 p-2 text-center">
                                                {item.type === "package" ? <Package className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300 dark:text-slate-600 mb-1 sm:mb-2" /> : <Gift className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300 dark:text-slate-600 mb-1 sm:mb-2" />}
                                                <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold truncate w-full px-1 hidden sm:block">No Image</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Details right side */}
                                    <div className="flex-1 p-3 sm:p-4 lg:p-5 flex flex-col min-w-0">
                                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                            <Badge variant="outline" className={cn("text-[9px] sm:text-[10px] uppercase font-bold border-0 px-1.5 sm:px-2 py-0.5", item.type === "package" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400")}>
                                                {item.type === "package" ? <Package className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 inline-block" /> : <Gift className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 inline-block" />}
                                                {item.type}
                                            </Badge>
                                        </div>
                                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug mb-3 flex-1" title={item.name}>
                                            {item.name}
                                        </h3>

                                        {/* Stats block */}
                                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mt-auto">
                                            <div className="bg-slate-50 dark:bg-white/5 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-slate-100 dark:border-white/5">
                                                <span className="text-[9px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                    <PhoneCall className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="truncate">Inquiries</span>
                                                </span>
                                                <span className="block mt-0.5 sm:mt-1 text-base sm:text-xl font-bold text-slate-800 dark:text-slate-200 leading-none">{item.inquiries}</span>
                                            </div>
                                            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-emerald-100 dark:border-emerald-500/20">
                                                <span className="text-[9px] sm:text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                                                    <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="truncate">Bookings</span>
                                                </span>
                                                <div className="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-1.5 mt-0.5 sm:mt-1">
                                                    <span className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 leading-none">{item.bookings}</span>
                                                    {item.inquiries > 0 && (
                                                        <span className="text-[9px] sm:text-[11px] font-bold text-emerald-600/60 dark:text-emerald-400/60">
                                                            ({Math.round((item.bookings / item.inquiries) * 100)}%)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant="outline"
                                            className="w-full mt-2 sm:mt-3 h-8 sm:h-9 text-[10px] sm:text-xs rounded-lg sm:rounded-xl border-slate-200 dark:border-white/10 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 dark:hover:bg-violet-500/10 dark:hover:text-violet-400 dark:hover:border-violet-500/30 transition-colors"
                                            onClick={() => setEditingItem(item)}
                                        >
                                            <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5 sm:mr-2" />
                                            Update Stats
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <UpdateModal
                item={editingItem}
                open={!!editingItem}
                onClose={() => setEditingItem(null)}
                onSaved={loadData}
            />
        </div>
    );
}
