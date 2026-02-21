"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, ArrowRight, Activity, AlertTriangle } from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export default function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const r = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await r.json();

            if (!data.ok) {
                throw new Error(data.error || "Login failed");
            }

            login(data.token, data.user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#05060a] p-4 text-white selection:bg-purple-500/30">
            {/* Background Vibe */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div
                    className="absolute -left-[10%] -top-[10%] h-[60%] w-[60%] rounded-full blur-[120px] opacity-40"
                    style={{ background: "radial-gradient(circle, rgba(120,80,255,0.4) 0%, transparent 70%)" }}
                />
                <div
                    className="absolute -right-[10%] -bottom-[10%] h-[60%] w-[60%] rounded-full blur-[120px] opacity-30"
                    style={{ background: "radial-gradient(circle, rgba(0,255,170,0.3) 0%, transparent 70%)" }}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative w-full max-w-[1000px]"
            >
                <div className="grid overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.02] shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:grid-cols-2">

                    {/* Left Side: Branding/Vibe */}
                    <div className="relative hidden flex-col justify-between p-12 md:flex">
                        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-600/10 via-transparent to-emerald-500/5" />

                        <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 border border-white/10">
                                <Sparkles className="h-5 w-5 text-purple-400" />
                            </div>
                            <span className="text-xl font-bold tracking-tight">Credit Strategy <span className="text-white/60">AI</span></span>
                        </div>

                        <div>
                            <h2 className="text-4xl font-black leading-tight tracking-tight">
                                Intelligence for <br />
                                <span className="bg-gradient-to-r from-purple-400 to-emerald-400 bg-clip-text text-transparent">Modern Finance.</span>
                            </h2>
                            <p className="mt-4 max-w-sm text-lg text-white/50">
                                Access AI-driven credit analysis and automated dispute orchestration in one sleek interface.
                            </p>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex flex-col">
                                <span className="text-2xl font-bold italic opacity-80">98%</span>
                                <span className="text-xs uppercase tracking-widest text-white/40">Accuracy</span>
                            </div>
                            <div className="h-8 w-px bg-white/10" />
                            <div className="flex flex-col">
                                <span className="text-2xl font-bold italic opacity-80">2.4s</span>
                                <span className="text-xs uppercase tracking-widest text-white/40">Latency</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Form */}
                    <div className="flex flex-col justify-center border-l border-white/10 p-8 md:p-12">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
                            <p className="mt-2 text-white/50">Login to your workspace</p>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300"
                            >
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                {error}
                            </motion.div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-widest text-white/40">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-purple-400" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full rounded-2xl border border-white/5 bg-white/5 py-4 pl-11 pr-4 outline-none transition-all placeholder:text-white/20 focus:border-purple-500/30 focus:bg-white/10"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold uppercase tracking-widest text-white/40">Password</label>
                                    <button type="button" className="text-xs text-white/30 hover:text-white/60">Forgot?</button>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-purple-400" />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full rounded-2xl border border-white/5 bg-white/5 py-4 pl-11 pr-4 outline-none transition-all placeholder:text-white/20 focus:border-purple-500/30 focus:bg-white/10"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white py-4 font-bold text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? (
                                    <Activity className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </button>
                        </form>

                        <p className="mt-8 text-center text-sm text-white/30">
                            Don't have an account?{" "}
                            <Link href="/register" className="font-semibold text-white/80 hover:text-white">
                                Create one free
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
