"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
    LayoutDashboard,
    Package,
    Lightbulb,
    Settings,
    Menu,
    TrendingUp,
    LogOut,
    Database,
    Gift,
    PhoneCall,
    FileSpreadsheet,
    Bell,
    Search,
    ChevronRight,
    Activity,
    Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Overview & KPIs" },
    { href: "/packages", label: "Packages", icon: Package, desc: "Travel packages" },
    { href: "/ads", label: "Ads Campaigns", icon: Megaphone, desc: "FB & IG ad analytics" },
    { href: "/offers", label: "Seasonal Offers", icon: Gift, desc: "Promotions" },
    { href: "/reports", label: "Excel Reports", icon: FileSpreadsheet, desc: "Analytics data" },
    { href: "/inquiries", label: "Bookings & Inquiries", icon: PhoneCall, desc: "Customer requests" },
    { href: "/insights", label: "Insights", icon: Lightbulb, desc: "AI insights" },
    { href: "/data-entry", label: "Data Entry", icon: Database, desc: "Manage data" },
    { href: "/logs", label: "Access Logs", icon: Settings, desc: "Activity logs" },
];

function NavLink({
    href,
    label,
    icon: Icon,
    desc,
    onClick,
}: {
    href: string;
    label: string;
    icon: React.ElementType;
    desc: string;
    onClick?: () => void;
}) {
    const pathname = usePathname();
    const isActive = pathname === href || pathname.startsWith(href + "/");
    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative",
                isActive
                    ? "bg-white/15 text-white shadow-lg backdrop-blur-sm"
                    : "text-white/60 hover:text-white hover:bg-white/10"
            )}
        >
            {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-violet-400 rounded-r-full shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
            )}
            <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200",
                isActive
                    ? "bg-violet-500 shadow-lg shadow-violet-500/40"
                    : "bg-white/10 group-hover:bg-white/20"
            )}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <div className="truncate leading-tight">{label}</div>
                {isActive && <div className="text-[10px] text-white/50 font-normal truncate">{desc}</div>}
            </div>
            {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto flex-shrink-0 text-violet-300" />}
        </Link>
    );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
    const { logout } = useAuth();

    return (
        <aside className="flex flex-col h-full w-64 relative overflow-hidden">
            {/* Background image */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/images/sidebar-bg.png"
                    alt=""
                    fill
                    className="object-cover"
                    priority
                />
                {/* Overlay gradient for readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d2b]/90 via-[#1a0a3c]/85 to-[#0d0d2b]/95" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full px-4 py-5 min-h-0">
                {/* Logo */}
                <div className="flex items-center gap-3 px-2 mb-7">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
                        <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1">
                            <Image
                                src="/images/logo/aahaas-logo-white.png"
                                alt="Aahaas"
                                width={70}
                                height={22}
                                style={{ width: "auto", height: "1.25rem" }}
                                className="object-contain"
                            />
                        </div>
                        <p className="text-[10px] text-white/40 font-medium tracking-widest uppercase mt-0.5">Analytics</p>
                    </div>
                </div>

                {/* Status chip */}
                <div className="mx-2 mb-5 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[11px] text-white/60 font-medium">Live Analytics</span>
                    <span className="ml-auto text-[10px] text-emerald-400 font-semibold">ACTIVE</span>
                </div>

                {/* Nav label */}
                <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest px-3 mb-2">Main Menu</p>

                {/* Navigation */}
                <nav className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 scrollbar-none pb-1">
                    {navItems.map((item) => (
                        <NavLink key={item.href} {...item} onClick={onClose} />
                    ))}
                </nav>

                {/* Bottom section */}
                <div className="pt-4 border-t border-white/10 mt-4">
                    {/* Social media badges */}
                    <div className="flex items-center gap-2 mb-4 px-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1877F2]/20 border border-[#1877F2]/30">
                            <span className="text-[10px] font-bold text-[#1877F2]">f</span>
                            <span className="text-[10px] text-white/50">Facebook</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-pink-500/20 border border-pink-500/30">
                            <span className="text-[10px] font-bold text-pink-400">IG</span>
                            <span className="text-[10px] text-white/50">Instagram</span>
                        </div>
                    </div>
                    <button
                        suppressHydrationWarning
                        onClick={logout}
                        className="flex items-center gap-3 text-sm font-medium text-white/40 hover:text-red-400 transition-colors w-full text-left px-3 py-2 rounded-xl hover:bg-red-500/10"
                    >
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                            <LogOut className="w-4 h-4" />
                        </div>
                        Sign Out
                    </button>
                </div>
            </div>
        </aside>
    );
}

export function AppShell({ children }: { children: React.ReactNode }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();

    if (pathname === "/login") {
        return <>{children}</>;
    }

    const currentPage = navItems.find(n => pathname === n.href || pathname.startsWith(n.href + "/"));

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-[#07070f] overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden lg:flex flex-col flex-shrink-0 shadow-2xl shadow-black/40" style={{ width: 256 }}>
                <Sidebar />
            </div>

            {/* Main content area */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d0d1a] flex-shrink-0 shadow-sm">
                    {/* Mobile logo + hamburger */}
                    <div className="flex items-center gap-3 lg:hidden">
                        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-8 h-8">
                                    <Menu className="w-4 h-4" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-64 border-0">
                                <Sidebar onClose={() => setMobileOpen(false)} />
                            </SheetContent>
                        </Sheet>
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                                <TrendingUp className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                                Aahaas<span className="text-violet-600 dark:text-violet-400">Analytics</span>
                            </span>
                        </div>
                    </div>

                    {/* Desktop breadcrumb */}
                    <div className="hidden lg:flex items-center gap-2">
                        <span className="text-xs text-slate-400">Aahaas Analytics</span>
                        {currentPage && (
                            <>
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                <span className="text-xs font-semibold text-slate-700 dark:text-white">
                                    {currentPage.label}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Search bar (desktop) */}
                    <div className="hidden md:flex items-center gap-2 mx-4 flex-1 max-w-sm">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                suppressHydrationWarning
                                type="text"
                                placeholder="Quick search..."
                                className="w-full pl-9 pr-4 py-1.5 rounded-xl text-sm border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                            />
                        </div>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-2">
                        <button suppressHydrationWarning className="relative w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                            <Bell className="w-4 h-4" />
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-500" />
                        </button>
                        <ThemeToggle />
                        {/* User avatar */}
                        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-white/10 ml-1">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shadow">
                                A
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-xs font-semibold text-slate-800 dark:text-white leading-tight">Admin</p>
                                <p className="text-[10px] text-slate-400 leading-tight">Aahaas</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#09090f]">
                    {children}
                </main>
            </div>
        </div>
    );
}
