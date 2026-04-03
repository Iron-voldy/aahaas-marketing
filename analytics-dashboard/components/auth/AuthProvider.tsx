"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface SessionUser {
    id: number;
    email: string;
    name: string;
}

interface AuthContextType {
    user: SessionUser | null;
    loading: boolean;
    setUser: (user: SessionUser | null) => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    setUser: () => { },
    logout: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const isPublicRoute = pathname === "/login" || pathname === "/register";

    useEffect(() => {
        fetch("/api/auth/me", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : { user: null }))
            .then((data) => {
                setUser(data.user ?? null);
                setLoading(false);
            })
            .catch(() => {
                setUser(null);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (loading) return;
        if (!user && !isPublicRoute) router.push("/login");
        else if (user && isPublicRoute) router.push("/dashboard");
    }, [user, loading, pathname, router]);

    const logout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            setUser(null);
            router.push("/login");
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    // Avoid rendering protected children before auth state settles,
    // which prevents eager client fetches from hitting protected APIs unauthenticated.
    if (loading) {
        return null;
    }

    if (!user && !isPublicRoute) {
        return null;
    }

    if (user && isPublicRoute) {
        return null;
    }

    return (
        <AuthContext.Provider value={{ user, loading, setUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
