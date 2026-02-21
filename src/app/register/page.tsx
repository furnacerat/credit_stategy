"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, ArrowRight, Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export default function RegisterPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const r = await fetch(`${API_BASE}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await r.json();

            if (!data.ok) {
                throw new Error(data.error || "Registration failed");
            }

            login(data.token, data.user);
        } catch (err: any) {
            setError(err.message === "email_exists" ? "Email already registered" : err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#05060a] p-4 text-white selection:bg-purple-500/30">
            {/* Background Vibe */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div
                    className="absolute -right-[10%] -top-[10%] h-[60%] w-[60%] rounded-full blur-[120px] opacity-40"
                    style={{ background: "radial-gradient(circle, rgba(0,255,170,0.4) 0%, transparent 70%)" }}
                />
                <div
                    className="absolute -left-[10%] -bottom-[10%] h-[60%] w-[60%] rounded-full blur-[120px] opacity-30"
                    style={{ background: "radial-gradient(circle, rgba(120,80,255,0.3) 0%, transparent 70%)" }}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative w-full max-w-[1000px]"
            >
                <div className="grid overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.02] shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:grid-cols-2">

                    {/* Left Side: Vibe */}
                    <div className="relative hidden flex-col justify-between p-12 md:flex">
                        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-600/5" />

                        <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 border border-white/10">
                                <Sparkles className="h-5 w-5 text-emerald-400" />
                            </div>
                            <span className="text-xl font-bold tracking-tight">Credit Strategy <span className="text-white/60">AI</span></span>
                        </div>

                        <div className="space-y-6">
                            <h2 className="text-4xl font-black leading-tight tracking-tight">
                                Start Your <br />
                                <span className="bg-gradient-to-r from-emerald-400 to-purple-400 bg-clip-text text-transparent">Credit Evolution.</span>
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-white/70">
                                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                                    <span>AI Analysis within seconds</span>
                                </div>
                                <div className="flex items-center gap-3 text-white/70">
                                    <div className="h-2 w-2 rounded-full bg-purple-400" />
                                    <span>Automated dispute letter generation</span>
                                </div>
                                <div className="flex items-center gap-3 text-white/70">
                                    <div className="h-2 w-2 rounded-full bg-cyan-400" />
                                    <span>Military-grade data encryption</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/5 p-4 backdrop-blur-md">
                            <ShieldCheck className="h-5 w-5 text-emerald-400" />
                            <span className="text-sm font-medium text-white/60">Your data is never sold. Ever.</span>
                        </div>
                    </div>

                    {/* Right Side: Form */}
                    <div className="flex flex-col justify-center border-l border-white/10 p-8 md:p-12">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold tracking-tight">Create Account</h1>
                            <p className="mt-2 text-white/50">Join the future of credit intelligence</p>
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

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-widest text-white/40">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-emerald-400" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full rounded-2xl border border-white/5 bg-white/5 py-3 pl-11 pr-4 outline-none transition-all placeholder:text-white/20 focus:border-emerald-500/30 focus:bg-white/10"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-widest text-white/40">Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-emerald-400" />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full rounded-2xl border border-white/5 bg-white/5 py-3 pl-11 pr-4 outline-none transition-all placeholder:text-white/20 focus:border-emerald-500/30 focus:bg-white/10"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-widest text-white/40">Confirm</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-emerald-400" />
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full rounded-2xl border border-white/5 bg-white/5 py-3 pl-11 pr-4 outline-none transition-all placeholder:text-white/20 focus:border-emerald-500/30 focus:bg-white/10"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="py-2">
                                <p className="text-[10px] uppercase tracking-widest text-white/30 leading-relaxed">
                                    By clicking register, you agree to our <span className="text-white/50 underline">Terms of Service</span> and <span className="text-white/50 underline">Privacy Policy</span>.
                                </p>
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
                                        Create Account
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </button>
                        </form>

                        <p className="mt-8 text-center text-sm text-white/30">
                            Already have an account?{" "}
                            <Link href="/login" className="font-semibold text-white/80 hover:text-white">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
