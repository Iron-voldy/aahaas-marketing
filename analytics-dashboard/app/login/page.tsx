"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail, Eye, EyeOff, TrendingUp, User, Megaphone, BarChart2, FileSpreadsheet, MousePointerClick } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LoginPage() {
    const { user, loading: authLoading, setUser } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [mode, setMode] = useState<"login" | "register">("login");
    const [name, setName] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [carouselIndex, setCarouselIndex] = useState(0);
    const router = useRouter();

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => {
        const t = setInterval(() => setCarouselIndex(i => (i + 1) % 3), 4500);
        return () => clearInterval(t);
    }, []);

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
            // Update auth context first — the AuthProvider redirect effect
            // will navigate to /dashboard once user state is set.
            setUser(data.user);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to login. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) { setError("Passwords do not match."); return; }
        setIsLoading(true);
        setError("");
        try {
            const resp = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name, email, password }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || "Registration failed");
            setUser(data.user);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const stats = [
        {
            icon: Megaphone,
            label: "Ad Campaigns",
            value: "FB + IG",
            sub: "Multi-platform tracking",
            iconColor: "text-blue-400",
            iconBg: "bg-blue-500/20",
            hoverBorder: "hover:border-blue-500/30",
            hoverBg: "hover:bg-blue-500/10",
        },
        {
            icon: BarChart2,
            label: "Performance Metrics",
            value: "Real-time",
            sub: "CTR · CPM · Reach · Spend",
            iconColor: "text-violet-400",
            iconBg: "bg-violet-500/20",
            hoverBorder: "hover:border-violet-500/30",
            hoverBg: "hover:bg-violet-500/10",
        },
        {
            icon: FileSpreadsheet,
            label: "Export Reports",
            value: "XLSX · PDF",
            sub: "One-click per campaign",
            iconColor: "text-emerald-400",
            iconBg: "bg-emerald-500/20",
            hoverBorder: "hover:border-emerald-500/30",
            hoverBg: "hover:bg-emerald-500/10",
        },
        {
            icon: MousePointerClick,
            label: "Conversion Insights",
            value: "Spend vs ROI",
            sub: "Cost-per-result analysis",
            iconColor: "text-pink-400",
            iconBg: "bg-pink-500/20",
            hoverBorder: "hover:border-pink-500/30",
            hoverBg: "hover:bg-pink-500/10",
        },
    ];

    return (
        <div className="min-h-screen flex bg-[#06060f]">
            {/* ── LEFT PANEL ── */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-[58%] relative overflow-hidden flex-col">
                {/* Carousel Images */}
                {["/images/carousel-1.jpg", "/images/carousel-2.jpg", "/images/carousel-3.jpg"].map((src, i) => (
                    <div
                        key={src}
                        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${i === carouselIndex ? "opacity-100" : "opacity-0"}`}
                        style={{ backgroundImage: `url('${src}')` }}
                    />
                ))}
                {/* Carousel dots */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                    {[0, 1, 2].map(i => (
                        <button key={i} type="button" onClick={() => setCarouselIndex(i)} suppressHydrationWarning
                            className={`h-2 rounded-full transition-all duration-300 ${i === carouselIndex ? "w-6 bg-white" : "w-2 bg-white/40"}`}
                        />
                    ))}
                </div>
                {/* Gradient overlays — light touch so the photo shows through */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#06060f]/55 via-indigo-950/15 to-[#06060f]/45" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#06060f]/85 via-[#06060f]/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#06060f]/60" />

                {/* Subtle accent orbs — small so they don't mask the image */}
                <div className={`absolute bottom-1/4 left-1/4 w-40 h-40 rounded-full blur-[60px] bg-indigo-600/20 transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`} />
                <div className={`absolute top-1/4 right-1/4 w-32 h-32 rounded-full blur-[50px] bg-violet-500/15 transition-opacity duration-1000 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`} />

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
                            <span className="text-indigo-300 text-xs font-medium tracking-widest uppercase">Marketing Analytics Platform</span>
                        </div>
                        <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-3">
                            Smarter Ads,
                            <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400">
                                Clearer Results
                            </span>
                        </h1>
                        <p className="text-slate-300 text-base xl:text-lg leading-relaxed max-w-md mb-5">
                            Track Facebook &amp; Instagram ad campaigns, measure spend vs conversions, and export reports — all in one dashboard built for Aahaas.
                        </p>
                        {/* Platform badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1877F2]/20 border border-[#1877F2]/30 text-[#74a9f5] text-xs font-semibold">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                Facebook Ads
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#833ab4]/20 via-[#fd1d1d]/20 to-[#fcb045]/20 border border-pink-500/30 text-pink-300 text-xs font-semibold">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                                Instagram Ads
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-semibold">
                                <TrendingUp className="w-3 h-3" />
                                Export &amp; Analysis
                            </span>
                        </div>
                    </div>

                    {/* Stats grid */}
                    <div className={`grid grid-cols-2 gap-3 transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        {stats.map(({ icon: Icon, label, value, sub, iconColor, iconBg, hoverBorder, hoverBg }) => (
                            <div key={label} className={`flex items-start gap-3 p-3.5 rounded-xl border border-white/8 bg-black/30 backdrop-blur-md ${hoverBorder} ${hoverBg} transition-all duration-300 group`}>
                                <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                    <Icon className={`w-4 h-4 ${iconColor}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white font-bold text-sm leading-tight">{value}</p>
                                    <p className="text-slate-300 text-xs font-medium">{label}</p>
                                    <p className="text-slate-500 text-[10px] mt-0.5 truncate">{sub}</p>
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
                        <h2 className="text-3xl font-black text-white mb-2">
                            {mode === "login" ? "Welcome back" : "Create account"}
                        </h2>
                        <p className="text-slate-500 text-sm">
                            {mode === "login" ? "Sign in to your analytics workspace" : "Join the Aahaas analytics workspace"}
                        </p>
                    </div>

                    {/* Register Form */}
                    {mode === "register" && (
                        <form onSubmit={handleRegister} className="space-y-4">
                            {/* Name */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Full Name</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                                    <input type="text" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} required suppressHydrationWarning
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200" />
                                </div>
                            </div>
                            {/* Email */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                                    <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required suppressHydrationWarning
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200" />
                                </div>
                            </div>
                            {/* Password */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                                    <input type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required suppressHydrationWarning
                                        className="w-full pl-11 pr-12 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} suppressHydrationWarning className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {/* Confirm Password */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Confirm Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                                    <input type={showConfirmPassword ? "text" : "password"} placeholder="Re-enter your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required suppressHydrationWarning
                                        className="w-full pl-11 pr-12 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200" />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} suppressHydrationWarning className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {error && (
                                <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
                                    <div className="w-4 h-4 rounded-full border border-red-500/40 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-xs font-bold">!</span></div>
                                    {error}
                                </div>
                            )}
                            <button type="submit" disabled={isLoading} suppressHydrationWarning
                                className="relative w-full py-3.5 rounded-xl font-semibold text-white text-sm overflow-hidden group mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                                <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <span className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" />
                                <span className="relative flex items-center justify-center gap-2">
                                    {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : <><User className="w-4 h-4" /> Create account</>}
                                </span>
                            </button>
                        </form>
                    )}

                    {/* Login Form */}
                    {mode === "login" && (
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
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-px bg-white/5" />
                        <span className="text-slate-600 text-xs">OR</span>
                        <div className="flex-1 h-px bg-white/5" />
                    </div>

                    {/* Mode toggle */}
                    <p className="text-center text-slate-500 text-sm">
                        {mode === "login" ? (
                            <>Need an account?{" "}
                                <button type="button" onClick={() => { setMode("register"); setError(""); }} suppressHydrationWarning
                                    className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors hover:underline underline-offset-2">
                                    Create account
                                </button>
                            </>
                        ) : (
                            <>Already have an account?{" "}
                                <button type="button" onClick={() => { setMode("login"); setError(""); }} suppressHydrationWarning
                                    className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors hover:underline underline-offset-2">
                                    Sign in
                                </button>
                            </>
                        )}
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
