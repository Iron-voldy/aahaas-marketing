"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { logAccess } from "@/lib/firebase/db";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            await signInWithEmailAndPassword(auth, email, password);
            await logAccess(email, "User logged into the admin dashboard.");
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message || "Failed to login. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0f] flex flex-col items-center justify-center p-4">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-md">
                <div className="flex flex-col items-center mb-8 gap-3">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                        AahaasAnalytics
                    </span>
                </div>

                <Card className="border-slate-200 dark:border-white/5 bg-white dark:bg-[#111118] shadow-sm">
                    <CardHeader className="space-y-1 pb-4">
                        <CardTitle className="text-2xl font-bold text-center text-slate-900 dark:text-white">
                            Welcome back
                        </CardTitle>
                        <CardDescription className="text-center text-slate-500 dark:text-slate-400">
                            Enter your admin credentials to access the dashboard
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Email Address
                                </label>
                                <Input
                                    type="email"
                                    placeholder="admin@aahaas.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Password
                                </label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10"
                                />
                            </div>

                            {error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-md">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all mt-2 h-11"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                ) : (
                                    <Lock className="w-4 h-4 mr-2" />
                                )}
                                Sign In
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
