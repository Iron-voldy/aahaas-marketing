"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Users, TrendingUp, Presentation, Loader2, ArrowRight, ExternalLink } from "lucide-react";
import { FacebookLogo, InstagramLogo } from "@/components/icons/SocialLogos";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { KpiCard as KpiCardType } from "@/lib/types";
import { KpiCards, KpiCardsSkeleton } from "@/components/dashboard/KpiCards";
import { cn } from "@/lib/utils";

export function DashboardClient() {
    const [stats, setStats] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchDashboardData() {
            setLoading(true);
            try {
                // Fetch high-level page insights
                const insightsRes = await fetch("/api/facebook/account-insights");
                const insightsData = await insightsRes.json();

                // Fetch recent posts
                const postsRes = await fetch("/api/facebook/posts");
                const postsData = await postsRes.json();

                if (!insightsRes.ok || insightsData.error) {
                    throw new Error(insightsData.error || "Failed to load account insights");
                }

                setStats(insightsData.data);
                if (postsRes.ok && postsData.posts) {
                    setPosts(postsData.posts);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchDashboardData();
    }, []);

    // Format KPIs for the KpiCards component
    const kpis: KpiCardType[] = stats ? [
        {
            label: "Total Audience (FB + IG)",
            value: (stats.facebook.followers + stats.instagram.followers).toLocaleString(),
            icon: "users",
        },
        {
            label: "Combined 28-Day Reach",
            value: (stats.facebook.reach28d + stats.instagram.reach28d).toLocaleString(),
            icon: "trending-up",
        },
        {
            label: "Facebook Followers",
            value: stats.facebook.followers.toLocaleString(),
            icon: "facebook",
        },
        {
            label: "Instagram Followers",
            value: stats.instagram.followers.toLocaleString(),
            icon: "instagram",
        },
        {
            label: "FB 28-Day Engagement",
            value: stats.facebook.engagement28d.toLocaleString(),
            icon: "message-circle",
        },
        {
            label: "IG 28-Day Profile Views",
            value: stats.instagram.profileViews28d.toLocaleString(),
            icon: "presentation",
        }
    ] : [];

    return (
        <div className="flex flex-col gap-6 p-4 lg:p-6">
            <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    Social Media Overview
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Live global marketing performance for Aahaas across Facebook and Instagram
                </p>
            </div>

            {loading && (
                <div className="space-y-6">
                    <KpiCardsSkeleton />
                    <Card className="h-64 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                    </Card>
                </div>
            )}

            {error && !loading && (
                <div className="p-8 text-center bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400">
                    <h2 className="text-lg font-bold mb-2">Could Not Load Live Stats</h2>
                    <p className="max-w-md mx-auto text-sm">{error}</p>
                    <p className="max-w-md mx-auto text-sm mt-4 opacity-75">
                        Ensure you have followed the Meta Setup Guide and updated the <code>.env.local</code> file with valid API credentials.
                    </p>
                </div>
            )}

            {!loading && !error && stats && (
                <>
                    {/* Top KPI row */}
                    <KpiCards cards={kpis} />

                    {/* Content Section */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                        {/* Recent Posts Feed (Takes up 2 columns) */}
                        <Card className="xl:col-span-2 shadow-sm rounded-2xl border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118]">
                            <CardHeader className="pb-4 border-b border-slate-100 dark:border-white/5">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    Recent Published Content
                                </CardTitle>
                                <CardDescription>Your latest posts directly from the Meta API</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[500px] overflow-y-auto">
                                    {posts.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500">No recent posts found.</div>
                                    ) : (
                                        posts.map((post) => (
                                            <div key={post.id} className="p-5 flex gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                                <div className="w-24 h-24 rounded-bl-xl rounded-tr-xl rounded-tl-sm rounded-br-sm overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-white/5 relative border border-slate-200 dark:border-white/10">
                                                    {post.picture ? (
                                                        <Image src={post.picture} alt="Post thumbnail" fill className="object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                                            {post.platform === "facebook" ? <FacebookLogo className="w-6 h-6" /> : <InstagramLogo className="w-6 h-6" />}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {post.platform === "facebook" ? (
                                                            <Badge className="bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 border-0 text-[10px] px-2 py-0">Facebook</Badge>
                                                        ) : (
                                                            <Badge className="bg-pink-500/10 text-pink-500 hover:bg-pink-500/20 border-0 text-[10px] px-2 py-0">Instagram</Badge>
                                                        )}
                                                        <span className="text-xs text-slate-400">
                                                            {new Date(post.created_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed mb-auto">
                                                        {post.message || <span className="italic opacity-50">No caption provided</span>}
                                                    </p>

                                                    {post.url && (
                                                        <a
                                                            href={post.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 mt-3 w-fit"
                                                        >
                                                            View original post <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Audience summary sidebar */}
                        <Card className="shadow-sm rounded-2xl border-slate-200 dark:border-white/5 bg-gradient-to-br from-violet-500 to-purple-700 text-white border-0">
                            <CardContent className="p-8 flex flex-col items-center justify-center h-full text-center">
                                <Users className="w-16 h-16 text-white/20 mb-6" />
                                <h3 className="text-4xl font-bold mb-2">
                                    {(stats.facebook.followers + stats.instagram.followers).toLocaleString()}
                                </h3>
                                <p className="text-white/80 font-medium tracking-wide">Total Combined Audience</p>

                                <div className="w-full h-px bg-white/10 my-8"></div>

                                <div className="w-full flex justify-between items-center">
                                    <div className="flex flex-col items-center">
                                        <FacebookLogo className="w-6 h-6 mb-2 grayscale brightness-200" />
                                        <span className="text-lg font-bold">{stats.facebook.followers.toLocaleString()}</span>
                                        <span className="text-[10px] text-white/60 uppercase tracking-widest">Followers</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <InstagramLogo className="w-6 h-6 mb-2 grayscale brightness-200" />
                                        <span className="text-lg font-bold">{stats.instagram.followers.toLocaleString()}</span>
                                        <span className="text-[10px] text-white/60 uppercase tracking-widest">Followers</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                </>
            )}
        </div>
    );
}
