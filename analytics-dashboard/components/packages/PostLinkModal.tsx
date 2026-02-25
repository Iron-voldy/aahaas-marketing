"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, Search, Link2, RefreshCw, AlertCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";
import { cn } from "@/lib/utils";

interface Post {
    id: string;
    platform: "facebook" | "instagram";
    message: string;
    created_time: string;
    picture: string | null;
    url: string | null;
}

interface PostLinkModalProps {
    open: boolean;
    onClose: () => void;
    currentFbId?: string;
    currentIgId?: string;
    onLink: (platform: "facebook" | "instagram", postId: string) => void;
}

export function PostLinkModal({ open, onClose, currentFbId, currentIgId, onLink }: PostLinkModalProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;

        const fetchPosts = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/facebook/posts");
                const data = await res.json();

                if (!res.ok) throw new Error(data.error || "Failed to fetch posts");
                setPosts(data.posts || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPosts();
    }, [open]);

    const fbPosts = posts.filter(p => p.platform === "facebook");
    const igPosts = posts.filter(p => p.platform === "instagram");

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 bg-white dark:bg-[#111118] border-0 rounded-2xl shadow-2xl [&>button]:hidden">
                <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-black/20">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Link2 className="w-5 h-5 text-violet-500" />
                            Link Social Post
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Select a recent post to auto-sync engagement stats.</p>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                            <p>Connecting to Meta Graph API...</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex flex-col items-center justify-center py-20 text-red-500 max-w-md mx-auto text-center">
                            <AlertCircle className="w-10 h-10 mb-4 opacity-50" />
                            <h3 className="font-bold mb-2">API Connection Failed</h3>
                            <p className="text-sm opacity-80 mb-4">{error}</p>
                            <p className="text-xs bg-red-50 dark:bg-red-500/10 p-3 rounded-lg border border-red-200 dark:border-red-500/20">
                                Check that your <code>.env.local</code> file contains valid <code>FB_ACCESS_TOKEN</code> and Page IDs.
                            </p>
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="grid grid-cols-2 gap-6">
                            {/* Facebook Column */}
                            <div>
                                <h3 className="flex items-center gap-2 font-bold mb-4 px-2 tracking-wide text-[#1877F2]">
                                    <FacebookLogo className="w-5 h-5" /> Facebook Page
                                </h3>
                                <div className="space-y-4">
                                    {fbPosts.map(post => (
                                        <div key={post.id} className={cn(
                                            "flex gap-4 p-3 rounded-xl border transition-all",
                                            currentFbId === post.id
                                                ? "border-[#1877F2] bg-[#1877F2]/5 ring-1 ring-[#1877F2]"
                                                : "border-slate-200 dark:border-white/10 hover:border-[#1877F2]/40"
                                        )}>
                                            <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-white/5 relative">
                                                {post.picture ? (
                                                    <Image src={post.picture} alt="FB Post" fill className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                        <Search className="w-5 h-5" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <p className="text-xs text-slate-500 mb-1">
                                                    {new Date(post.created_time).toLocaleDateString()}
                                                </p>
                                                <p className="text-sm font-medium line-clamp-2 leading-relaxed flex-1 mb-2">
                                                    {post.message || <span className="italic opacity-50">No caption</span>}
                                                </p>
                                                <Button
                                                    size="sm"
                                                    variant={currentFbId === post.id ? "default" : "outline"}
                                                    className={cn("h-7 text-xs self-start rounded-lg", currentFbId === post.id ? "bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" : "")}
                                                    onClick={() => onLink("facebook", post.id)}
                                                >
                                                    {currentFbId === post.id ? "Linked" : "Link FBI"}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {fbPosts.length === 0 && <p className="text-sm text-slate-500 p-4text-center">No recent Facebook posts found.</p>}
                                </div>
                            </div>

                            {/* Instagram Column */}
                            <div>
                                <h3 className="flex items-center gap-2 font-bold mb-4 px-2 tracking-wide text-pink-500">
                                    <InstagramLogo className="w-5 h-5" /> Instagram Account
                                </h3>
                                <div className="space-y-4">
                                    {igPosts.map(post => (
                                        <div key={post.id} className={cn(
                                            "flex gap-4 p-3 rounded-xl border transition-all",
                                            currentIgId === post.id
                                                ? "border-pink-500 bg-pink-500/5 ring-1 ring-pink-500"
                                                : "border-slate-200 dark:border-white/10 hover:border-pink-500/40"
                                        )}>
                                            <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-white/5 relative">
                                                {post.picture ? (
                                                    <Image src={post.picture} alt="IG Post" fill className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                        <Search className="w-5 h-5" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <p className="text-xs text-slate-500 mb-1">
                                                    {new Date(post.created_time).toLocaleDateString()}
                                                </p>
                                                <p className="text-sm font-medium line-clamp-2 leading-relaxed flex-1 mb-2">
                                                    {post.message || <span className="italic opacity-50">No caption</span>}
                                                </p>
                                                <Button
                                                    size="sm"
                                                    variant={currentIgId === post.id ? "default" : "outline"}
                                                    className={cn("h-7 text-xs self-start rounded-lg", currentIgId === post.id ? "bg-pink-600 hover:bg-pink-700 text-white" : "")}
                                                    onClick={() => onLink("instagram", post.id)}
                                                >
                                                    {currentIgId === post.id ? "Linked" : "Link IG"}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {igPosts.length === 0 && <p className="text-sm text-slate-500 p-4 text-center">No recent Instagram posts found.</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
