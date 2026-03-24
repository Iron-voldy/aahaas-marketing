"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Lock, Mail, Eye, EyeOff, Zap, TrendingUp, BarChart3, Globe } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LoginPage() {
    const { user, loading: authLoading } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => { setMounted(true); }, []);

    // Already authenticated — redirect immediately
    useEffect(() => {
        if (!authLoading && user) router.replace("/dashboard");
    }, [authLoading, user, router]);

    // Show spinner while checking auth or redirecting
    if (authLoading || user) {
        return (
            <div className="min-h-screen bg-[#06060f] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
        );
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        try {
            const resp = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, password }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || "Login failed");
            router.push("/dashboard");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to login. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    const stats = [
        { icon: TrendingUp, label: "Revenue Tracked", value: "₹2.4M+" },
        { icon: BarChart3, label: "Campaigns", value: "150+" },
        { icon: Globe, label: "Reach", value: "50K+" },
        { icon: Zap, label: "Insights/Day", value: "1000+" },
    ];

    return (
        <div className="min-h-screen flex bg-[#06060f]">
            {/* ── LEFT PANEL ── */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-[58%] relative overflow-hidden flex-col">
                {/* Hero Image */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: "url('/images/login-hero.png')" }}
                />
                {/* Gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#06060f]/80 via-indigo-950/40 to-[#06060f]/70" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#06060f] via-transparent to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#06060f]" />

                {/* Animated grid */}
                <div className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: `linear-gradient(rgba(99,102,241,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.4) 1px, transparent 1px)`,
                        backgroundSize: "60px 60px"
                    }}
                />

                {/* Glowing orbs */}
                <div className={`absolute top-1/4 left-1/3 w-72 h-72 rounded-full blur-[120px] bg-indigo-600/30 transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`} />
                <div className={`absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full blur-[100px] bg-violet-500/25 transition-opacity duration-1000 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`} />
                <div className={`absolute top-1/2 left-1/2 w-40 h-40 rounded-full blur-[80px] bg-cyan-500/20 transition-opacity duration-1000 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`} />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">
                    {/* Brand */}
                    <div className={`flex items-center gap-3 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <span className="text-white font-bold text-lg tracking-wide">Aahaas Analytics</span>
                    </div>

                    {/* Main hero text */}
                    <div className={`transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 mb-6">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                            <span className="text-indigo-300 text-xs font-medium tracking-widest uppercase">Live Intelligence Platform</span>
                        </div>
                        <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
                            Data-Driven
                            <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400">
                                Marketing Intelligence
                            </span>
                        </h1>
                        <p className="text-slate-400 text-base xl:text-lg leading-relaxed max-w-md">
                            Monitor campaigns, track conversions, and uncover insights — all in one powerful analytics hub built for Aahaas.
                        </p>
                    </div>

                    {/* Stats grid */}
                    <div className={`grid grid-cols-2 gap-3 transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        {stats.map(({ icon: Icon, label, value }) => (
                            <div key={label} className="flex items-center gap-3 p-3.5 rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm hover:border-indigo-500/30 hover:bg-indigo-500/10 transition-all duration-300 group">
                                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                                    <Icon className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm">{value}</p>
                                    <p className="text-slate-500 text-xs">{label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── RIGHT PANEL – Login Form ── */}
            <div className="w-full lg:w-1/2 xl:w-[42%] flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
                {/* bg glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#06060f] via-[#0a0a18] to-[#06060f]" />
                <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-[120px] bg-indigo-900/20 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full blur-[100px] bg-violet-900/15 pointer-events-none" />

                <div className={`relative z-10 w-full max-w-md transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    {/* Mobile brand */}
                    <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <span className="text-white font-bold text-lg">Aahaas Analytics</span>
                    </div>

                    {/* Heading */}
                    <div className="mb-8">
                        <h2 className="text-3xl font-black text-white mb-2">Welcome back</h2>
                        <p className="text-slate-500 text-sm">Sign in to your analytics workspace</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                                Email Address
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type="email"
                                    placeholder="admin@aahaas.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    suppressHydrationWarning
                                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                                Password
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    suppressHydrationWarning
                                    className="w-full pl-11 pr-12 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    suppressHydrationWarning
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
                                <div className="w-4 h-4 rounded-full border border-red-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-bold">!</span>
                                </div>
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            suppressHydrationWarning
                            className="relative w-full py-3.5 rounded-xl font-semibold text-white text-sm overflow-hidden group mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                        >
                            <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <span className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" />
                            <span className="relative flex items-center justify-center gap-2">
                                {isLoading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating...</>
                                ) : (
                                    <><Lock className="w-4 h-4" /> Sign In to Dashboard</>
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-px bg-white/5" />
                        <span className="text-slate-600 text-xs">OR</span>
                        <div className="flex-1 h-px bg-white/5" />
                    </div>

                    {/* Register link */}
                    <p className="text-center text-slate-500 text-sm">
                        Need an account?{" "}
                        <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors hover:underline underline-offset-2">
                            Create account
                        </Link>
                    </p>
                </div>

                {/* Footer */}
                <p className="absolute bottom-6 text-xs text-slate-700 z-10">
                    © 2025 Aahaas Marketing · All rights reserved
                </p>
            </div>
        </div>
    );
}
