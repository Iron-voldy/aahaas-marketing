import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import type { Row } from "@/lib/types";
import { updatePackage } from "@/lib/db";

interface QuickEditStatsModalProps {
    row: Row | null;
    open: boolean;
    onClose: () => void;
    onUpdateSuccess: () => void;
}

const STATS_FIELDS = [
    { name: "FB Reach", type: "number", label: "FB Reach", category: "Facebook" },
    { name: "FB Interactions (Reactions)", type: "number", label: "FB Reactions", category: "Facebook" },
    { name: "FB Total Clicks", type: "number", label: "FB Total Clicks", category: "Facebook" },
    { name: "IG Reach", type: "number", label: "IG Reach", category: "Instagram" },
    { name: "IG Interactions (Reactions)", type: "number", label: "IG Reactions", category: "Instagram" },
    { name: "IG Interactions (Saves)", type: "number", label: "IG Saves", category: "Instagram" },
    { name: "Amount Spent (USD)", type: "number", label: "Ad Spend ($)", category: "Ads" },
    { name: "FB + IG Messaging Conversations Started", type: "number", label: "Conversations", category: "Ads" },
];

export function QuickEditStatsModal({ row, open, onClose, onUpdateSuccess }: QuickEditStatsModalProps) {
    const [formData, setFormData] = useState<Record<string, string | number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (row && open) {
            const initialData: Record<string, string | number> = {};
            for (const field of STATS_FIELDS) {
                if (row[field.name] !== undefined && row[field.name] !== null) {
                    initialData[field.name] = row[field.name] as string | number;
                } else {
                    initialData[field.name] = "";
                }
            }
            setFormData(initialData);
        }
    }, [row, open]);

    if (!row) return null;

    const packageName = String(row["Package"] || row["package"] || row["country"] || "Unknown");

    const handleChange = (name: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [name]: value === "" ? "" : Number(value)
        }));
    };

    const handleSave = async () => {
        if (!row.id) return;
        setIsSubmitting(true);
        try {
            // Calculate combined if needed
            const fbReach = Number(formData["FB Reach"]) || 0;
            const igReach = Number(formData["IG Reach"]) || 0;
            const combinedReach = fbReach + igReach;

            // Assume other interactions stay same from row for combined total, or just don't calculate combined total interactions here, only reach.
            const updates = { ...formData, "Combined Reach": combinedReach };

            await updatePackage(row.id, updates);
            onUpdateSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to update stats", error);
            alert("Failed to update stats. See console.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-white dark:bg-[#0a0a0f] border-slate-200 dark:border-white/10 max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b border-slate-100 dark:border-white/5 pb-4 mb-4">
                    <DialogTitle className="text-xl font-bold flex flex-col gap-1 text-slate-900 dark:text-white">
                        Quick Update Stats
                        <span className="text-sm font-medium text-slate-500 uppercase tracking-widest">{packageName}</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Group by category */}
                    {["Facebook", "Instagram", "Ads"].map(category => (
                        <div key={category} className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{category}</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {STATS_FIELDS.filter(f => f.category === category).map(field => (
                                    <div key={field.name} className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            {field.label}
                                        </label>
                                        <Input
                                            type="number"
                                            value={formData[field.name] !== undefined ? formData[field.name] : ""}
                                            onChange={(e) => handleChange(field.name, e.target.value)}
                                            className="h-9 text-sm focus-visible:ring-violet-500"
                                            placeholder="0"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSubmitting}
                            className="bg-violet-600 hover:bg-violet-700 text-white min-w-[120px]"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Stats
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
