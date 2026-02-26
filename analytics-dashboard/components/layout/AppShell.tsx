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
    X,
    TrendingUp,
    LogOut,
    Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/packages", label: "Packages", icon: Package },
    { href: "/insights", label: "Insights", icon: Lightbulb },
    { href: "/data-entry", label: "Data Entry", icon: Database },
    { href: "/settings", label: "Settings", icon: Settings },
];

function NavLink({
    href,
    label,
    icon: Icon,
    onClick,
}: {
    href: string;
    label: string;
    icon: React.ElementType;
    onClick?: () => void;
}) {
    const pathname = usePathname();
    const isActive = pathname === href || pathname.startsWith(href + "/");
    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            )}
        >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
        </Link>
    );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
    const { logout } = useAuth();

    return (
        <aside className="flex flex-col h-full w-64 px-4 py-6">
            <div className="flex items-center gap-2 px-3 mb-8">
                {/* Light mode logo (red) */}
                <Image
                    src="/images/logo/aahaas-logo-red.png"
                    alt="Aahaas Logo"
                    width={100}
                    height={32}
                    className="h-8 w-auto object-contain dark:hidden"
                />
                {/* Dark mode logo (white) */}
                <Image
                    src="/images/logo/aahaas-logo-white.png"
                    alt="Aahaas Logo"
                    width={100}
                    height={32}
                    className="h-8 w-auto object-contain hidden dark:block"
                />
                <span className="text-violet-600 dark:text-violet-400 font-bold tracking-tight mt-1">
                    Analytics
                </span>
            </div>
            <nav className="flex flex-col gap-1 flex-1">
                {navItems.map((item) => (
                    <NavLink key={item.href} {...item} onClick={onClose} />
                ))}
            </nav>
            <div className="pt-4 border-t border-slate-100 dark:border-white/5 px-3 flex flex-col gap-4">
                <button
                    onClick={logout}
                    className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors w-full text-left"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                    Social Media Analytics
                </p>
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

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-[#0a0a0f] overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden lg:flex flex-col border-r border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d0d14] flex-shrink-0">
                <Sidebar />
            </div>

            {/* Main content area */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d0d14] flex-shrink-0">
                    {/* Mobile logo + hamburger */}
                    <div className="flex items-center gap-3 lg:hidden">
                        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-8 h-8">
                                    <Menu className="w-4 h-4" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-64">
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

                    {/* Desktop breadcrumb area */}
                    <div className="hidden lg:block" />

                    {/* Right side actions */}
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="h-full">{children}</div>
                </main>
            </div>
        </div>
    );
}
