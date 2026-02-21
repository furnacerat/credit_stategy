"use client";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import { Upload, FileText, Sparkles, AlertTriangle, ShieldCheck, Activity, X, ChevronRight, ExternalLink } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

// ------------------ helpers ------------------
function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

type PresignResp =
    | { ok: true; file_key: string; upload_url: string; expires_in: number }
    | { ok: false; error: any };

type CreateReportResp =
    | {
        ok: true;
        report: { id: string; filename: string; file_key: string; created_at: string };
        job: { id: string; status: string; progress: string; created_at: string };
    }
    | { ok: false; error: any };

type JobResp =
    | { ok: true; job: { id: string; status: "queued" | "processing" | "complete" | "failed"; progress?: string | null; error?: string | null; report_id: string } }
    | { ok: false; error: any };

type ResultResp =
    | { ok: true; result: { result_json: any; created_at: string } }
    | { ok: false; error: any };

// ------------------ UI atoms ------------------
function GradientOrb({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "pointer-events-none absolute -z-10 blur-3xl opacity-70",
                className
            )}
            style={{
                background:
                    "radial-gradient(closest-side, rgba(0,255,170,.35), transparent 65%), radial-gradient(closest-side, rgba(120,80,255,.30), transparent 62%), radial-gradient(closest-side, rgba(255,80,180,.22), transparent 60%)",
            }}
        />
    );
}

function GlassCard({
    title,
    icon,
    accent,
    children,
    className,
    footer,
    onClick,
}: {
    title: string;
    icon?: React.ReactNode;
    accent?: "mint" | "violet" | "sunset" | "ice" | "amber";
    children: React.ReactNode;
    className?: string;
    footer?: React.ReactNode;
    onClick?: () => void;
}) {
    const accentMap: Record<string, string> = {
        mint: "from-emerald-400/25 via-cyan-400/20 to-fuchsia-400/15",
        violet: "from-violet-500/25 via-fuchsia-400/20 to-cyan-400/15",
        sunset: "from-rose-500/25 via-orange-400/20 to-violet-400/15",
        ice: "from-sky-400/22 via-indigo-400/18 to-emerald-400/14",
        amber: "from-amber-400/25 via-orange-400/18 to-rose-400/14",
    };

    return (
        <motion.div
            whileHover={onClick ? { y: -4, scale: 1.02 } : { y: -2, scale: 1.01 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={onClick}
            className={cn(
                "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur-xl",
                onClick && "cursor-pointer group hover:border-white/20",
                className
            )}
        >
            <div className={cn("absolute inset-0 -z-10 bg-gradient-to-br", accentMap[accent || "violet"])} />
            <div className="absolute inset-0 -z-10 opacity-40" style={{
                backgroundImage:
                    "radial-gradient(circle at 20% 10%, rgba(255,255,255,.10), transparent 35%), radial-gradient(circle at 80% 40%, rgba(255,255,255,.08), transparent 40%)",
            }} />

            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 border border-white/10 group-hover:bg-white/20 transition-colors">
                        {icon}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-white/90">{title}</div>
                        <div className="text-xs text-white/60">Live from latest report</div>
                    </div>
                </div>
                {onClick ? (
                    <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
                ) : (
                    <div className="h-2 w-2 rounded-full bg-emerald-400/90 shadow-[0_0_16px_rgba(52,211,153,.65)]" />
                )}
            </div>

            <div className="mt-4">{children}</div>

            {footer ? (
                <div className="mt-4 border-t border-white/10 pt-3 text-xs text-white/70">
                    {footer}
                </div>
            ) : null}
        </motion.div>
    );
}

function Pill({ children, color = "white" }: { children: React.ReactNode, color?: "white" | "rose" | "amber" }) {
    const colors = {
        white: "border-white/10 bg-white/5 text-white/80",
        rose: "border-rose-500/20 bg-rose-500/10 text-rose-400",
        amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    };
    return (
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs", colors[color])}>
            {children}
        </span>
    );
}

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onClose}
                className="absolute inset-0 bg-[#05060a]/80 backdrop-blur-md"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0c12] p-6 shadow-2xl"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10 transition-colors">
                        <X className="h-5 w-5 text-white/60" />
                    </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {children}
                </div>
            </motion.div>
        </div>
    );
}

function FancyButton({
    children,
    onClick,
    disabled,
    variant = "primary",
}: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: "primary" | "ghost";
}) {
    const base =
        "rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";
    const styles =
        variant === "primary"
            ? "bg-white text-black hover:bg-white/90"
            : "border border-white/12 bg-white/5 text-white hover:bg-white/10";
    return (
        <button className={cn(base, styles)} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    );
}

// ------------------ main page ------------------
export default function AppDashboard() {
    const { token, user: authUser, logout, loading: authLoading } = useAuth();
    const router = useRouter();

    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState<"Idle" | "Presigning" | "Uploading" | "Creating" | "Queued" | "Processing" | "Complete" | "Error">("Idle");
    const [jobId, setJobId] = useState<string | null>(null);
    const [reportId, setReportId] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [letters, setLetters] = useState<any[]>([]);
    const [err, setErr] = useState<string | null>(null);

    const [activeModal, setActiveModal] = useState<"utilization" | "negatives" | "inquiries" | null>(null);

    useEffect(() => {
        if (!authLoading && !token) {
            router.push("/login");
        }
    }, [token, authLoading, router]);

    const headers = useMemo(() => ({
        "Authorization": `Bearer ${token}`
    }), [token]);

    if (authLoading || !token) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#05060a]">
                <Activity className="h-8 w-8 animate-spin text-purple-400" />
            </div>
        );
    }

    // demo sparkline until you have real history
    const spark = useMemo(
        () =>
            Array.from({ length: 24 }).map((_, i) => ({
                i,
                v: 580 + Math.round(Math.sin(i / 3) * 22) + Math.round(Math.random() * 18),
            })),
        []
    );

    const score = result?.summary?.score ?? result?.score_estimate ?? null;
    const rating = result?.summary?.rating ?? null;
    const primaryIssues = result?.summary?.primary_issues ?? [];
    const scoreKillers = result?.summary?.top_score_killers ?? [];
    const impactRanking = result?.impact_ranking ?? [];
    const projectedRange = result?.summary?.projected_score_range ?? null;
    const issues = result?.summary?.issues_count ?? result?.issues_count ?? null;
    const actionPlan = result?.action_plan ?? null;
    const mia = result?.most_important_action ?? null;
    const nextAction = actionPlan?.title ?? result?.next_best_action ?? "Upload a report to get your next step.";
    const negatives = useMemo(() => {
        const items = result?.negatives ?? result?.top_issues ?? [];
        return [...items].sort((a, b) => (b.priority_scoring?.total_priority || 0) - (a.priority_scoring?.total_priority || 0));
    }, [result]);
    const inquiries = result?.inquiries ?? [];
    const util = result?.utilization ?? {};

    async function presignUpload(filename: string): Promise<PresignResp> {
        const r = await fetch(`${API_BASE}/uploads/presign`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({ filename, contentType: "application/pdf" }),
        });
        return r.json();
    }

    async function putToR2(uploadUrl: string, f: File) {
        const r = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: f,
        });
        if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
    }

    async function createReport(filename: string, file_key: string): Promise<CreateReportResp> {
        const r = await fetch(`${API_BASE}/reports`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({ filename, file_key }),
        });
        return r.json();
    }

    async function pollJob(jobId: string) {
        for (let i = 0; i < 80; i++) {
            const r = await fetch(`${API_BASE}/jobs/${jobId}`, { headers });
            const data: JobResp = await r.json();
            if (!data.ok) throw new Error("Job status check failed");

            const s = data.job.status;
            setStatus(s === "queued" ? "Queued" : s === "processing" ? "Processing" : s === "complete" ? "Complete" : "Error");
            if (s === "failed") throw new Error(data.job.error || "Job failed");
            if (s === "complete") return;
            await sleep(1100);
        }
        throw new Error("Timed out waiting for job");
    }

    async function fetchResult(rid: string) {
        try {
            const r = await fetch(`${API_BASE}/reports/${rid}/result`, { headers });
            const d = await r.json();
            if (d.ok) setResult(d.result.result_json);
        } catch (e) {
            console.error("fetchResult error", e);
        }
    }

    async function fetchLetters(rid: string) {
        try {
            const r = await fetch(`${API_BASE}/reports/${rid}/letters`, { headers });
            const d = await r.json();
            if (d.ok) setLetters(d.letters);
        } catch (e) {
            console.error("fetchLetters error", e);
        }
    }

    async function downloadLetter(fileKey: string, bureau: string) {
        try {
            const r = await fetch(`${API_BASE}/downloads/presign`, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ file_key: fileKey }),
            });
            const d = await r.json();
            if (!d.ok) throw new Error(d.error);
            window.open(d.url, "_blank");
        } catch (e: any) {
            alert("Download failed: " + e.message);
        }
    }

    // Auto-refresh when complete
    useEffect(() => {
        if (status === "Complete" && reportId) {
            fetchResult(reportId);
            fetchLetters(reportId);
        }
    }, [status, reportId]);
    async function runUploadFlow() {
        if (!file || busy) return;
        setBusy(true);
        setErr(null);
        setResult(null);
        setJobId(null);
        setReportId(null);
        setLetters([]); // Clear letters on new upload

        try {
            setStatus("Presigning");
            const p = await presignUpload(file.name);
            if (!p.ok) throw new Error("Presign failed");

            setStatus("Uploading");
            await putToR2(p.upload_url, file);

            setStatus("Creating");
            const cr = await createReport(file.name, p.file_key);
            if (!cr.ok) throw new Error("Create report failed");

            setJobId(cr.job.id);
            setReportId(cr.report.id);

            setStatus("Queued");
            await pollJob(cr.job.id);

            // fetchResult and fetchLetters are now called by useEffect when status becomes "Complete"
            // const res = await fetchResult(cr.report.id); // Removed as fetchResult now sets state directly
            // setResult(res); // Removed as fetchResult now sets state directly
            setStatus("Complete");
        } catch (e: any) {
            setErr(e?.message || "Something went wrong");
            setStatus("Error");
        } finally {
            setBusy(false);
        }
    }

    async function runRetryFlow() {
        if (!reportId || busy) return;
        setBusy(true);
        setErr(null);
        setResult(null);
        setJobId(null);
        setLetters([]);

        try {
            setStatus("Queued");
            const r = await fetch(`${API_BASE}/reports/${reportId}/retry`, {
                method: "POST",
                headers
            });
            const d = await r.json();
            if (!d.ok) throw new Error(d.error);

            await pollJob(d.job.id);
            setStatus("Complete");
        } catch (e: any) {
            setErr(e?.message || "Retry failed");
            setStatus("Error");
        } finally {
            setBusy(false);
        }
    }

    const statusColor =
        status === "Complete" ? "text-emerald-300" :
            status === "Error" ? "text-rose-300" :
                status === "Processing" ? "text-amber-200" :
                    status === "Queued" ? "text-cyan-200" :
                        "text-white/70";

    return (
        <div className="min-h-screen bg-[#05060a] text-white">
            {/* background vibes */}
            <GradientOrb className="left-[-160px] top-[-140px] h-[520px] w-[520px]" />
            <GradientOrb className="right-[-180px] top-[140px] h-[620px] w-[620px]" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.18]" style={{
                backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(255,255,255,.35) 1px, transparent 0)",
                backgroundSize: "22px 22px",
            }} />

            {/* top bar */}
            <div className="sticky top-0 z-20 border-b border-white/10 bg-black/35 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
                            <Sparkles className="h-5 w-5 text-white/90" />
                        </div>
                        <div>
                            <div className="font-semibold leading-tight">Credit Strategy AI</div>
                            <div className="text-xs text-white/60">Widget Dashboard</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Pill>
                            <span className={cn("font-semibold", statusColor)}>{status}</span>
                        </Pill>

                        <input
                            id="pdf"
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                        <label
                            htmlFor="pdf"
                            className="hidden sm:inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                        >
                            <FileText className="h-4 w-4" />
                            Choose PDF
                        </label>

                        <FancyButton variant="primary" onClick={runUploadFlow} disabled={!file || busy}>
                            <span className="inline-flex items-center gap-2">
                                <Upload className="h-4 w-4" />
                                {busy ? "Working…" : "Upload"}
                            </span>
                        </FancyButton>

                        <div className="h-8 w-px bg-white/10 mx-1" />

                        <button
                            onClick={logout}
                            className="text-white/40 hover:text-white/80 transition-colors"
                        >
                            <span className="text-sm font-medium">Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* content */}
            <div className="mx-auto max-w-6xl px-4 py-6">
                {err ? (
                    <div className="mb-4 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
                        <div className="flex items-center gap-2 font-semibold">
                            <AlertTriangle className="h-4 w-4" /> Error
                        </div>
                        <div className="mt-1 text-white/80">{err}</div>
                    </div>
                ) : null}

                {busy || (status !== "Idle" && status !== "Complete" && status !== "Error") ? (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                                <Activity className="h-5 w-5 animate-pulse text-emerald-400" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white">Analysis in Progress</div>
                                <div className="text-xs text-white/50">{status}...</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 pr-2">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={{ opacity: [0.2, 1, 0.2] }}
                                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                                    className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                                />
                            ))}
                        </div>
                    </motion.div>
                ) : null}

                {/* GRID */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    {/* BIG SCORE */}
                    <div className="lg:col-span-8">
                        <GlassCard
                            title="Score Pulse"
                            icon={<Activity className="h-5 w-5 text-white/90" />}
                            accent="ice"
                            onClick={() => {
                                // Potentially show a score history modal in the future
                                document.getElementById("sparkline-chart")?.scrollIntoView({ behavior: "smooth" });
                            }}
                            footer={
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>Report</span>
                                    <span className="text-white/70">{reportId ? reportId.slice(0, 8) + "…" : "—"}</span>
                                    <span className="text-white/50">•</span>
                                    <span>Job</span>
                                    <span className="text-white/70">{jobId ? jobId.slice(0, 8) + "…" : "—"}</span>
                                </div>
                            }
                        >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <div className="text-6xl font-black tracking-tight">
                                        {score ?? "—"}
                                        <span className="ml-2 text-base font-semibold text-white/60">est.</span>
                                        {rating && (
                                            <span className={cn(
                                                "ml-4 text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-full",
                                                rating === "Exceptional" || rating === "Good" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                                    rating === "Fair" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                                        "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                            )}>
                                                {rating}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-6">
                                        <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Impact Assessment</div>
                                        <div className="space-y-6">
                                            {impactRanking.map((item: any, i: number) => (
                                                <div key={i} className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "text-xs font-black uppercase tracking-tighter px-2 py-0.5 rounded",
                                                            item.severity === "CRITICAL" ? "bg-rose-500/20 text-rose-400" :
                                                                item.severity === "HIGH" ? "bg-amber-500/20 text-amber-400" :
                                                                    "bg-emerald-500/20 text-emerald-400"
                                                        )}>
                                                            {item.severity === "CRITICAL" ? "🔴 CRITICAL" :
                                                                item.severity === "HIGH" ? "🟠 HIGH" :
                                                                    "🟡 MEDIUM"}
                                                        </span>
                                                        <span className="text-sm font-bold text-white/90">{item.issue}</span>
                                                    </div>
                                                    <div className="pl-2 space-y-1">
                                                        {item.details.map((detail: string, j: number) => (
                                                            <div key={j} className="flex items-center gap-2 text-xs text-white/50">
                                                                <span className="text-white/30 text-[10px]">→</span>
                                                                {detail}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {projectedRange && (
                                        <div className="mt-8 rounded-2xl bg-emerald-400/5 border border-emerald-400/10 p-4 transition-all hover:bg-emerald-400/10">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest">Projected Score</div>
                                                    <div className="text-2xl font-black text-emerald-400">{projectedRange}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest italic">If fixed</div>
                                                    <Sparkles className="inline-block h-4 w-4 text-emerald-400 mt-1" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <Pill>Utilization: {util?.overall_percent ?? "—"}%</Pill>
                                        <Pill>Issues: {issues ?? "—"}</Pill>
                                        <Pill>Inquiries: {Array.isArray(inquiries) ? inquiries.length : 0}</Pill>
                                    </div>
                                </div>

                                <div className="h-28 w-full sm:w-[320px] min-w-[240px]" id="sparkline-chart">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={spark}>
                                            <Tooltip
                                                contentStyle={{
                                                    background: "rgba(10,12,18,.9)",
                                                    border: "1px solid rgba(255,255,255,.12)",
                                                    borderRadius: 16,
                                                }}
                                                labelStyle={{ color: "rgba(255,255,255,.7)" }}
                                            />
                                            <defs>
                                                <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                                                    <stop offset="0%" stopColor="rgba(56,189,248,.55)" />
                                                    <stop offset="60%" stopColor="rgba(167,139,250,.25)" />
                                                    <stop offset="100%" stopColor="rgba(244,114,182,.05)" />
                                                </linearGradient>
                                            </defs>
                                            <Area
                                                type="monotone"
                                                dataKey="v"
                                                stroke="rgba(255,255,255,.0)"
                                                fill="url(#g)"
                                                fillOpacity={1}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </GlassCard>
                    </div>

                    {/* RIGHT STACK */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        <GlassCard
                            title="Issues Found"
                            icon={<ShieldCheck className="h-5 w-5 text-white/90" />}
                            accent="mint"
                            onClick={() => setActiveModal("negatives")}
                        >
                            <div className="text-5xl font-black">{issues ?? "—"}</div>
                            <div className="mt-2 text-sm text-white/70">
                                Items likely impacting score (late pays, collections, utilization, etc.)
                            </div>
                        </GlassCard>

                        <GlassCard
                            title={mia ? "🔥 MOST IMPORTANT ACTION" : "Next Best Move"}
                            icon={mia ? null : <Sparkles className="h-5 w-5 text-white/90" />}
                            accent={mia ? "sunset" : "sunset"}
                            onClick={() => {
                                document.getElementById("letters-section")?.scrollIntoView({ behavior: "smooth" });
                            }}
                        >
                            {mia ? (
                                <div className="space-y-4">
                                    <div className="text-lg font-black text-white leading-tight">
                                        {mia.action}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm font-bold text-white/80">
                                            <span className="text-emerald-400">→</span>
                                            Pay {mia.payment_amount} {mia.target_utilization ? `to reach ${mia.target_utilization}` : ""}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-white/60">
                                            <span className="text-emerald-400">→</span>
                                            Expected boost: <span className="font-bold text-emerald-400">{mia.expected_boost}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-white/60">
                                            <span className="text-emerald-400">→</span>
                                            Timeline: {mia.timeline}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="text-sm font-bold leading-6 text-white">{nextAction}</div>
                                    {actionPlan && (
                                        <div className="mt-2 space-y-1.5 pb-2">
                                            {actionPlan.steps.map((step: string, i: number) => (
                                                <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                                                    <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/40" />
                                                    {step}
                                                </div>
                                            ))}
                                            <div className="mt-3 inline-block rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                                                Impact: {actionPlan.expected_impact}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-white/40 uppercase tracking-wider">
                                <span>Take Action</span>
                                <ChevronRight className="h-3 w-3" />
                            </div>
                        </GlassCard>
                    </div>

                    {/* UTILIZATION */}
                    <div className="lg:col-span-4">
                        <GlassCard
                            title="Utilization"
                            icon={<Activity className="h-5 w-5 text-white/90" />}
                            accent="violet"
                            onClick={() => setActiveModal("utilization")}
                        >
                            <div className="flex items-end justify-between">
                                <div>
                                    <div className="text-4xl font-black">{util?.overall_percent ?? "—"}%</div>
                                    <div className="mt-1 text-xs text-white/60">Overall revolving utilization</div>
                                </div>
                                <div className="text-xs text-white/60">
                                    Target: <span className="text-white/85 font-semibold">1–9%</span>
                                </div>
                            </div>

                            <div className="mt-4 space-y-2">
                                {(util?.revolving_accounts || []).slice(0, 3).map((a: any, idx: number) => (
                                    <div key={idx} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-semibold">{a.creditor || "Card"}</span>
                                            <span className="text-white/70">{a.utilization_percent ?? "—"}%</span>
                                        </div>
                                        <div className="mt-1 text-xs text-white/60">
                                            Bal: {a.balance ?? "—"} • Limit: {a.limit ?? "—"}
                                        </div>
                                    </div>
                                ))}
                                {!util?.revolving_accounts?.length ? (
                                    <div className="text-sm text-white/70">No utilization lines parsed yet.</div>
                                ) : null}
                            </div>
                        </GlassCard>
                    </div>

                    {/* NEGATIVES */}
                    <div className="lg:col-span-4">
                        <GlassCard
                            title="Negative Items"
                            icon={<AlertTriangle className="h-5 w-5 text-white/90" />}
                            accent="amber"
                            onClick={() => setActiveModal("negatives")}
                        >
                            {Array.isArray(negatives) && negatives.length ? (
                                <div className="space-y-2">
                                    {negatives.slice(0, 4).map((n: any, idx: number) => (
                                        <div key={idx} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-semibold">{n.type ?? "issue"}</div>
                                                <Pill>{n.severity || n.impact_points || "—"}</Pill>
                                            </div>
                                            <div className="mt-1 text-xs text-white/60">
                                                {n.creditor || "Unknown"} • {n.date || "—"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-white/70">No negative items found yet.</div>
                            )}
                        </GlassCard>
                    </div>

                    {/* INQUIRIES */}
                    <div className="lg:col-span-4">
                        <GlassCard
                            title="Inquiries"
                            icon={<FileText className="h-5 w-5 text-white/90" />}
                            accent="ice"
                            onClick={() => setActiveModal("inquiries")}
                        >
                            {Array.isArray(inquiries) && inquiries.length ? (
                                <div className="space-y-2">
                                    {inquiries.slice(0, 5).map((i: any, idx: number) => (
                                        <div key={idx} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-semibold">{i.creditor || "Inquiry"}</span>
                                                <span className="text-white/70">{i.bureau || "unknown"}</span>
                                            </div>
                                            <div className="mt-1 text-xs text-white/60">{i.date || "—"}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-white/70">No inquiries listed yet.</div>
                            )}
                        </GlassCard>
                    </div>

                    {/* LETTERS */}
                    <div className="lg:col-span-12" id="letters-section">
                        <GlassCard
                            title="Dispute Letters"
                            icon={<Sparkles className="h-5 w-5 text-white/90" />}
                            accent="sunset"
                            footer={
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <span>Your customized dispute artifacts are generated automatically.</span>
                                </div>
                            }
                        >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                {letters.length ? (
                                    letters.map((l: any) => (
                                        <div key={l.id} className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10">
                                            <div className="relative z-10">
                                                <div className="text-xs font-semibold uppercase tracking-widest text-white/40">{l.bureau}</div>
                                                <div className="mt-1 text-xl font-bold">PDF Document</div>
                                                <div className="mt-4 flex items-center gap-3">
                                                    <button
                                                        onClick={() => downloadLetter(l.file_key, l.bureau)}
                                                        className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/20"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                        Download
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="absolute -right-4 -top-4 h-24 w-24 bg-gradient-to-br from-white/10 to-transparent blur-2xl transition-opacity group-hover:opacity-100 opacity-20" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-3 py-8 text-center text-white/30 italic">
                                        {status === "Complete" ? "No letters were generated for this report." : "Letters will appear here once analysis is complete."}
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </div>
                </div>

                {/* mobile file picker row */}
                <div className="mt-5 sm:hidden flex items-center gap-2">
                    <label
                        htmlFor="pdf"
                        className="flex-1 cursor-pointer rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-center hover:bg-white/10"
                    >
                        {file ? file.name : "Choose PDF"}
                    </label>
                    <FancyButton variant="primary" onClick={runUploadFlow} disabled={!file || busy}>
                        {busy ? "…" : "Go"}
                    </FancyButton>
                </div>
            </div>

            {/* MODALS */}
            <Modal
                isOpen={activeModal === "utilization"}
                onClose={() => setActiveModal(null)}
                title="Utilization Analysis"
            >
                <div className="space-y-6">
                    <div className="flex items-center justify-between rounded-3xl bg-white/5 p-6 border border-white/10">
                        <div>
                            <div className="text-sm text-white/60 mb-1">Overall Utilization</div>
                            <div className="text-4xl font-black">{util?.overall_percent ?? "—"}%</div>
                        </div>
                        <div className="text-right">
                            <Pill color={util?.overall_percent > 30 ? "rose" : "amber"}>
                                {util?.overall_percent > 30 ? "High Impact" : "Fair"}
                            </Pill>
                            <div className="mt-2 text-xs text-white/50">Target: 1–9%</div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-white/80 mb-3 px-1 uppercase tracking-wider">Account Breakdown</h3>
                        <div className="space-y-3">
                            {(util?.revolving_accounts || []).map((a: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 p-4 transition-colors hover:bg-white/10">
                                    <div>
                                        <div className="font-bold text-white">{a.creditor || "Revolving Account"}</div>
                                        <div className="text-xs text-white/50">
                                            Balance: <span className="text-white/80">{a.balance}</span> • Limit: <span className="text-white/80">{a.limit}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-white">{a.utilization_percent}%</div>
                                        <div className="h-1.5 w-24 bg-white/10 rounded-full mt-1 overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all",
                                                    a.utilization_percent > 30 ? "bg-rose-500" : "bg-emerald-500"
                                                )}
                                                style={{ width: `${Math.min(a.utilization_percent, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={activeModal === "negatives"}
                onClose={() => setActiveModal(null)}
                title="Negative Impact Items"
            >
                <div className="space-y-4">
                    <p className="text-sm text-white/60 px-1 italic">The following items are causing the most significant drag on your score.</p>
                    <div className="space-y-3">
                        {(negatives || []).map((n: any, idx: number) => (
                            <div key={idx} className="rounded-2xl bg-white/5 border border-white/10 p-5 group transition-all hover:bg-white/10">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-lg font-bold text-white">{n.type}</div>
                                        <div className="text-sm text-white/60 mt-1">{n.creditor} • {n.date}</div>
                                    </div>
                                    <div className="text-right">
                                        <Pill color={n.priority_scoring?.total_priority > 50 ? "rose" : "amber"}>
                                            Priority: {n.priority_scoring?.total_priority?.toFixed(0) || n.impact_points || "—"}
                                        </Pill>
                                        <div className="mt-1 text-[10px] text-white/40 uppercase tracking-tighter">
                                            {n.priority_scoring?.impact_weight}w • {n.priority_scoring?.severity_score}s • {n.priority_scoring?.recency_score}r
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            setActiveModal(null);
                                            document.getElementById("letters-section")?.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition-all"
                                    >
                                        <ShieldCheck className="h-3 w-3" />
                                        Dispute Strategy
                                    </button>
                                    <button
                                        className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        View Details
                                        <ExternalLink className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={activeModal === "inquiries"}
                onClose={() => setActiveModal(null)}
                title="Credit Inquiries"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                            <div className="text-2xl font-black text-white">{inquiries?.length || 0}</div>
                            <div className="text-xs text-white/50 uppercase tracking-widest mt-1">Total inquiries</div>
                        </div>
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                            <div className="text-2xl font-black text-emerald-400">Low</div>
                            <div className="text-xs text-white/50 uppercase tracking-widest mt-1">Impact level</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {(inquiries || []).map((i: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4">
                                <div>
                                    <div className="font-bold text-white">{i.creditor}</div>
                                    <div className="text-xs text-white/50">{i.date}</div>
                                </div>
                                <Pill>{i.bureau}</Pill>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
