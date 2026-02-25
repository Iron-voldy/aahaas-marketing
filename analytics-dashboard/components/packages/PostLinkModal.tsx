"use client";

import { useState, useEffect } from "react";
import { X, Link2, Save } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";

interface PostLinkModalProps {
    open: boolean;
    onClose: () => void;
    currentFbId?: string;
    currentIgId?: string;
    onLink: (fbId: string, igId: string) => void;
}

// Basic helper to extract ID from URL if they passed a URL
function extractId(input: string): string {
    const trimmed = input.trim();
    if (!trimmed.startsWith("http")) return trimmed;

    try {
        const url = new URL(trimmed);

        // Example: https://www.facebook.com/pageName/posts/123456789
        if (url.hostname.includes("facebook.com")) {
            const postMatch = url.pathname.match(/\/posts\/([a-zA-Z0-9_]+)/);
            if (postMatch) return postMatch[1];

            const fbid = url.searchParams.get("fbid");
            if (fbid) return fbid;
        }

        // Example: https://www.instagram.com/p/ABCDEFG/
        if (url.hostname.includes("instagram.com")) {
            const pMatch = url.pathname.match(/\/p\/([a-zA-Z0-9_-]+)/);
            if (pMatch) return pMatch[1];
        }

        // Fallback: just return the last path segment
        const segments = url.pathname.split("/").filter(Boolean);
        return segments[segments.length - 1] || trimmed;
    } catch {
        return trimmed;
    }
}

export function PostLinkModal({ open, onClose, currentFbId, currentIgId, onLink }: PostLinkModalProps) {
    const [fbInput, setFbInput] = useState("");
    const [igInput, setIgInput] = useState("");

    // Reset inputs when opened
    useEffect(() => {
        if (open) {
            setFbInput(currentFbId || "");
            setIgInput(currentIgId || "");
        }
    }, [open, currentFbId, currentIgId]);

    const handleSave = () => {
        const finalFbId = extractId(fbInput);
        const finalIgId = extractId(igInput);
        onLink(finalFbId, finalIgId);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md p-0 bg-white dark:bg-[#111118] border-0 rounded-2xl shadow-2xl [&>button]:hidden">
                <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-black/20">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Link2 className="w-5 h-5 text-violet-500" />
                            Link Social Posts
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Paste the exact Post ID or URL to link.</p>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Facebook Input */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 font-bold text-sm tracking-wide text-[#1877F2]">
                            <FacebookLogo className="w-5 h-5" /> Facebook Post ID / URL
                        </label>
                        <Input
                            placeholder="e.g. 123456789_987654321 or https://facebook.com/..."
                            value={fbInput}
                            onChange={(e) => setFbInput(e.target.value)}
                            className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 h-11"
                        />
                        <p className="text-xs text-slate-400">Find the Post ID in the URL of the Facebook post.</p>
                    </div>

                    {/* Instagram Input */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 font-bold text-sm tracking-wide text-pink-500">
                            <InstagramLogo className="w-5 h-5" /> Instagram Post ID / URL
                        </label>
                        <Input
                            placeholder="e.g. 179123456789 or https://instagram.com/p/..."
                            value={igInput}
                            onChange={(e) => setIgInput(e.target.value)}
                            className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 h-11"
                        />
                        <p className="text-xs text-slate-400">Meta Graph API requires the numeric Instagram Media ID.</p>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-white/10">
                        <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleSave} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white gap-2">
                            <Save className="w-4 h-4" /> Save Links
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
