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
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    logout: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

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
        const isPublicRoute = pathname === "/login" || pathname === "/register";
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

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
