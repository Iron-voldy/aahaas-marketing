"use client";

import { useState, useEffect } from "react";
import { getPackages, addPackage, updatePackage, deletePackage } from "@/lib/firebase/db";
import { storage } from "@/lib/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Row } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, DatabaseBackup, Upload, Image as ImageIcon, Edit2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const GENERAL_FIELDS = [
    { name: "Package", type: "text", label: "Package Name (e.g. S24/W24 - 101)" },
    { name: "Destination", type: "text", label: "Destination (e.g. Singapore)" },
    { name: "Validity Period", type: "text", label: "Validity Period" },
    { name: "Date Published", type: "date", label: "Date Published" },
];

const FB_FIELDS = [
    { name: "FB Reach", type: "number", label: "FB Reach" },
    { name: "FB Interactions (Reactions)", type: "number", label: "FB Reactions" },
    { name: "FB Interactions (Comments)", type: "number", label: "FB Comments" },
    { name: "FB Interactions (Shares)", type: "number", label: "FB Shares" },
    { name: "FB Interactions (Saves)", type: "number", label: "FB Saves" },
    { name: "FB Total Clicks", type: "number", label: "FB Total Clicks" },
    { name: "FB Link Clicks", type: "number", label: "FB Link Clicks" },
];

const IG_FIELDS = [
    { name: "IG Reach", type: "number", label: "IG Reach" },
    { name: "IG Interactions (Reactions)", type: "number", label: "IG Reactions" },
    { name: "IG Interactions (Comments)", type: "number", label: "IG Comments" },
    { name: "IG Interactions (Shares)", type: "number", label: "IG Shares" },
    { name: "IG Interactions (Saves)", type: "number", label: "IG Saves" },
];

const COMBINED_FIELDS = [
    { name: "Combined Reach", type: "number", label: "Combined Reach (Auto-Calculated)", readOnly: true },
    { name: "Combined Total Interactions", type: "number", label: "Combined Interactions (Auto-Calculated)", readOnly: true },
];

const BOOSTED_FIELDS = [
    { name: "Ads Objective", type: "text", label: "Objective" },
    { name: "Start Date", type: "date", label: "Start Date" },
    { name: "End Date", type: "date", label: "End Date" },
    { name: "FB + IG Messaging Conversations Started", type: "number", label: "Messaging conversations" },
    { name: "CPR (Cost Per Result)", type: "number", label: "CPR $" },
    { name: "Amount Spent (USD)", type: "number", label: "Spend $" },
    { name: "Impressions", type: "number", label: "Impressions" },
    { name: "Ads Total Reach", type: "number", label: "Reach" },
];

export default function DataEntryPage() {
    const [packages, setPackages] = useState<Row[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formData, setFormData] = useState<Record<string, string | number>>({});
    const [isBoosted, setIsBoosted] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split("T")[0]);

    // Auto-calculate combined metrics whenever FB or IG inputs change
    useEffect(() => {
        const fbReach = Number(formData["FB Reach"]) || 0;
        const igReach = Number(formData["IG Reach"]) || 0;

        const fbInteractions =
            (Number(formData["FB Interactions (Reactions)"]) || 0) +
            (Number(formData["FB Interactions (Comments)"]) || 0) +
            (Number(formData["FB Interactions (Shares)"]) || 0) +
            (Number(formData["FB Interactions (Saves)"]) || 0);

        const igInteractions =
            (Number(formData["IG Interactions (Reactions)"]) || 0) +
            (Number(formData["IG Interactions (Comments)"]) || 0) +
            (Number(formData["IG Interactions (Shares)"]) || 0) +
            (Number(formData["IG Interactions (Saves)"]) || 0);

        setFormData(prev => {
            // Only strictly update if values actually changed to avoid infinite loop
            const newReach = fbReach + igReach;
            const newInteractions = fbInteractions + igInteractions;

            if (prev["Combined Reach"] !== newReach || prev["Combined Total Interactions"] !== newInteractions) {
                return {
                    ...prev,
                    "Combined Reach": newReach,
                    "Combined Total Interactions": newInteractions
                };
            }
            return prev;
        });
    }, [
        formData["FB Reach"], formData["IG Reach"],
        formData["FB Interactions (Reactions)"], formData["FB Interactions (Comments)"],
        formData["FB Interactions (Shares)"], formData["FB Interactions (Saves)"],
        formData["IG Interactions (Reactions)"], formData["IG Interactions (Comments)"],
        formData["IG Interactions (Shares)"], formData["IG Interactions (Saves)"]
    ]);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setIsLoading(true);
        try {
            const data = await getPackages();
            setPackages(data);
        } catch (error) {
            console.error("Failed to load packages", error);
        } finally {
            setIsLoading(false);
        }
    }

    const handleInputChange = (name: string, value: string, type: string) => {
        setFormData(prev => ({
            ...prev,
            [name]: type === "number" ? (value === "" ? "" : Number(value)) : value
        }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const handleEdit = (pkg: Row) => {
        const { id, imageUrl, isBoosted, ...rest } = pkg;

        // Clean up undefined/null values for the formData state
        const cleanedRest: Record<string, string | number> = {};
        Object.entries(rest).forEach(([k, v]) => {
            if (v !== undefined && v !== null) {
                cleanedRest[k] = v as string | number;
            }
        });

        setFormData(cleanedRest);
        setIsBoosted(!!isBoosted);
        setEditingId(id || null);
        setEntryDate(new Date().toISOString().split("T")[0]); // Default to today even when editing
        setImageFile(null); // Keep existing image unless they pick a new one
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData["Package"]) {
            alert("Package Name is required.");
            return;
        }

        setIsSubmitting(true);
        try {
            let imageUrl = null;
            if (imageFile) {
                // Upload image to Firebase Storage
                const fileRef = ref(storage, `packages/${Date.now()}_${imageFile.name}`);
                await uploadBytes(fileRef, imageFile);
                imageUrl = await getDownloadURL(fileRef);
            }

            const packageToSave: Record<string, any> = { ...formData };
            if (imageUrl) {
                packageToSave.imageUrl = imageUrl;
            }
            if (isBoosted) {
                packageToSave.isBoosted = true;
            } else {
                packageToSave.isBoosted = false;
                // Clear out boost fields if they were entered then toggled off
                BOOSTED_FIELDS.forEach(f => {
                    delete packageToSave[f.name];
                });
            }

            // Clean up empty strings and NaN from numbers so they don't break Firestore or charts
            Object.keys(packageToSave).forEach(key => {
                const val = packageToSave[key];
                if (val === "" || val === undefined || Number.isNaN(val)) {
                    delete packageToSave[key];
                }
            });

            if (editingId) {
                await updatePackage(editingId, packageToSave, entryDate);
            } else {
                await addPackage(packageToSave as Row, entryDate);
            }

            // Reset and reload
            setFormData({});
            setImageFile(null);
            setIsBoosted(false);
            setEditingId(null);
            setShowForm(false);
            await loadData();
        } catch (error: any) {
            console.error("Error saving package", error);
            alert(`Failed to save data. Error: ${error?.message || String(error)}\nPlease check your inputs or Firebase permissions.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this package? This cannot be undone.")) return;
        try {
            await deletePackage(id);
            setPackages(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error("Error deleting package", error);
        }
    };

    const handleMigration = async () => {
        if (!confirm("This will import all data from the local CSV file into the database. Make sure you are logged in. Continue?")) return;
        setIsMigrating(true);
        try {
            const res = await fetch("/api/csv");
            if (!res.ok) throw new Error("Failed to fetch CSV");
            const { rows } = await res.json();

            let count = 0;
            for (const row of rows) {
                const { id, ...cleanRow } = row;
                await addPackage(cleanRow as Row);
                count++;
            }
            alert(`Migration successful! Added ${count} packages to the database.`);
            await loadData();
        } catch (error) {
            console.error("Migration failed", error);
            alert("Migration failed. Please make sure your Firestore Security Rules allow writes (e.g., request.auth != null) and you are logged in.");
        } finally {
            setIsMigrating(false);
        }
    };

    const renderFields = (fields: { name: string, type: string, label: string, readOnly?: boolean }[], title: string) => (
        <div className="space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 pb-2">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {fields.map((field) => (
                    <div key={field.name} className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {field.label} {field.name === "Package" && <span className="text-red-500">*</span>}
                        </label>
                        <Input
                            type={field.type === "date" ? "text" : field.type}
                            placeholder={field.type === "date" ? "DD-MMM-YY" : ""}
                            value={formData[field.name] ?? ""}
                            onChange={(e) => handleInputChange(field.name, e.target.value, field.type)}
                            step={field.type === "number" ? "any" : undefined}
                            className={`h-9 text-sm border-slate-200 dark:border-white/10 ${field.readOnly ? "bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-white dark:bg-black/40"}`}
                            required={field.name === "Package"}
                            disabled={field.readOnly}
                            readOnly={field.readOnly}
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    if (isLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-6 h-6 text-indigo-500" /></div>;
    }

    return (
        <div className="flex flex-col gap-6 p-4 lg:p-6 pb-24">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Data Entry</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Manage package analytics data manually in Firestore.
                    </p>
                </div>
                {!showForm && (
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={handleMigration}
                            disabled={isMigrating}
                            className="bg-white dark:bg-transparent border-slate-200 dark:border-white/10 hidden sm:flex"
                        >
                            {isMigrating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DatabaseBackup className="w-4 h-4 mr-2" />}
                            Migrate CSV
                        </Button>
                        <Button onClick={() => {
                            setEditingId(null);
                            setFormData({});
                            setImageFile(null);
                            setIsBoosted(false);
                            setShowForm(true);
                        }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Plus className="w-4 h-4 mr-2" /> Add Package
                        </Button>
                    </div>
                )}
            </div>

            {showForm && (
                <Card className="border-indigo-200 dark:border-indigo-500/20 shadow-md">
                    <CardHeader className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 pb-4">
                        <CardTitle>{editingId ? "Update Stats" : "Add New Package"}</CardTitle>
                        <CardDescription>
                            {editingId ? "Update the analytics data for this package." : "Fill in the analytics data for a new package."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={handleSubmit} className="space-y-8">

                            {/* General Fields */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 pb-2">Record Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="space-y-1.5 p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/5 transition-colors border border-indigo-100 dark:border-indigo-500/10">
                                        <label className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                                            STATS FOR DATE
                                        </label>
                                        <Input
                                            type="date"
                                            value={entryDate}
                                            onChange={(e) => setEntryDate(e.target.value)}
                                            className="h-9 text-sm bg-white dark:bg-black/40 border-indigo-200 dark:border-indigo-500/20"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {renderFields(GENERAL_FIELDS, "Package Details")}

                            {/* Image Upload */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 pb-2">Package Image</h3>
                                <div className="flex items-center gap-4 p-2">
                                    <div className="w-24 h-24 rounded-lg bg-slate-100 dark:bg-white/5 border-2 border-dashed border-slate-300 dark:border-white/20 flex flex-col items-center justify-center text-slate-500 overflow-hidden relative">
                                        {imageFile ? (
                                            <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                                                <span className="text-[10px]">No Image</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            title="Click to upload image"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Upload Package Flyer</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Click the box to browse for an image. JPG, PNG supported.</p>
                                        {imageFile && <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-2">{imageFile.name}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* FB & IG Metrics */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {renderFields(FB_FIELDS, "Facebook Metrics")}
                                {renderFields(IG_FIELDS, "Instagram Metrics")}
                            </div>

                            {/* Combined Metrics */}
                            {renderFields(COMBINED_FIELDS, "Combined Platform Metrics")}

                            {/* Boost Results */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Boost Results</h3>
                                    <div className="flex items-center gap-2">
                                        <label htmlFor="boosted" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">Was this package boosted?</label>
                                        <Switch
                                            id="boosted"
                                            checked={isBoosted}
                                            onCheckedChange={setIsBoosted}
                                        />
                                    </div>
                                </div>
                                {isBoosted ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
                                        {BOOSTED_FIELDS.map((field) => (
                                            <div key={field.name} className="space-y-1.5 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 transition-colors">
                                                <label className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                                                    {field.label}
                                                </label>
                                                <Input
                                                    type={field.type === "date" ? "text" : field.type}
                                                    value={formData[field.name] ?? ""}
                                                    onChange={(e) => handleInputChange(field.name, e.target.value, field.type)}
                                                    step={field.type === "number" ? "any" : undefined}
                                                    className="h-9 text-sm bg-white dark:bg-black/40 border-indigo-200 dark:border-indigo-500/20"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 text-center text-sm text-slate-500">
                                        Toggle switch above to enter boost metrics (Ad Spend, Impressions, CPR, etc.)
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-white/5">
                                <Button type="button" variant="outline" onClick={() => {
                                    setShowForm(false);
                                    setEditingId(null);
                                }}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]">
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 mr-2" />
                                            {editingId ? "Update Package" : "Save Package"}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* List of existing packages */}
            <div className="flex flex-col gap-3 mt-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                    Existing Packages ({packages.length})
                </h3>
                {packages.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                        No packages found in database.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {packages.map((pkg) => (
                            <Card key={pkg.id} className="border-slate-200 dark:border-white/10 overflow-hidden flex flex-col">
                                {pkg.imageUrl && (
                                    <div className="h-32 w-full overflow-hidden border-b border-slate-200 dark:border-white/10">
                                        <img src={pkg.imageUrl as string} alt={pkg["Package"] as string} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <CardContent className="p-4 flex flex-col gap-2 flex-grow">
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-slate-900 dark:text-white line-clamp-2">
                                            {pkg["Package"] as any}
                                        </span>
                                        <div className="flex bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 -mr-2 -mt-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 w-8 h-8 rounded-none rounded-l-lg border-r border-slate-200 dark:border-white/10"
                                                onClick={() => handleEdit(pkg)}
                                                title="Update Stats"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 w-8 h-8 rounded-none rounded-r-lg"
                                                onClick={() => handleDelete(pkg.id!)}
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 flex flex-col gap-1 mt-auto pt-2">
                                        <span>Published: {pkg["Date Published"] as any || "N/A"}</span>
                                        {pkg.isBoosted && <Badge className="w-fit text-[10px] px-1.5 py-0 h-4 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">Boosted</Badge>}
                                        <span>Ad Spend: ${pkg["Amount Spent (USD)"] as any || "0"}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
