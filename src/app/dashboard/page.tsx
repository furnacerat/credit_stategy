"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import {
    Upload,
    FileText,
    Sparkles,
    AlertTriangle,
    ShieldCheck,
    Activity,
    X,
    ChevronRight,
    ExternalLink,
} from "lucide-react";

import { WidgetCard } from "@/components/WidgetCard";
import { ReportHeader } from "@/components/ReportHeader";
import { DashboardGrid } from "@/components/DashboardGrid";

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
    | {
        ok: true;
        job: {
            id: string;
            status: "queued" | "processing" | "complete" | "failed";
            progress?: string | null;
            error?: string | null;
            report_id: string;
        };
    }
    | { ok: false; error: any };

// ------------------ UI atoms ------------------
function GradientOrb({ className }: { className?: string }) {
    return (
        <div
            className={cn("pointer-events-none absolute -z-10 blur-3xl opacity-70", className)}
            style={{
                background:
                    "radial-gradient(closest-side, rgba(0,255,170,.35), transparent 65%), radial-gradient(closest-side, rgba(120,80,255,.30), transparent 62%), radial-gradient(closest-side, rgba(255,80,180,.22), transparent 60%)",
            }}
        />
    );
}

function Pill({
    children,
    color = "white",
}: {
    children: React.ReactNode;
    color?: "white" | "rose" | "amber";
}) {
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

function Modal({
    isOpen,
    onClose,
    title,
    children,
}: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}) {
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
                <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">{children}</div>
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
    const { token, logout, loading: authLoading } = useAuth();
    const router = useRouter();

    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState<
        "Idle" | "Presigning" | "Uploading" | "Creating" | "Queued" | "Processing" | "Complete" | "Error"
    >("Idle");
    const [jobId, setJobId] = useState<string | null>(null);
    const [reportId, setReportId] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [letters, setLetters] = useState<any[]>([]);
    const [err, setErr] = useState<string | null>(null);

    const [activeModal, setActiveModal] = useState<"utilization" | "negatives" | "inquiries" | null>(null);

    useEffect(() => {
        if (!authLoading && !token) router.push("/login");
    }, [token, authLoading, router]);

    const headers = useMemo(
        () => ({
            Authorization: `Bearer ${token}`,
        }),
        [token]
    );

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

    // ---- Derived fields from result JSON ----
    const score = result?.score?.value ?? null;
    const rating = result?.score?.rating ?? null;
    const provider = result?.meta?.bureau ?? null;
    const reportDate = result?.meta?.generatedDate ?? null;
    const completeness = result?.quality?.completenessScore ?? null;

    const impactRanking = result?.impactRanking ?? [];
    const actionPlan = result?.nextBestMove ?? null;

    const inquiries = Array.isArray(result?.inquiries) ? result.inquiries : [];
    const util = result?.utilization ?? {};
    const negatives = useMemo(() => {
        const items = Array.isArray(result?.negatives) ? result.negatives : [];
        const severityMap: any = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        return [...items].sort((a, b) => (severityMap[b.severity] || 0) - (severityMap[a.severity] || 0));
    }, [result]);

    const issuesCount = (result?.impactRanking?.length ?? 0) || (result?.negatives?.length ?? 0);
    const lateCount = result?.accountSummary?.accountsEverLate ?? null;
    const collectionsCount = result?.accountSummary?.collectionsCount ?? null;

    const mia = actionPlan
        ? {
            action: actionPlan.title,
            steps: actionPlan.steps,
            expected_boost: actionPlan.expectedImpact || "Unknown",
            timeline: actionPlan.timeframe || "Unknown",
        }
        : null;

    const nextAction = result?.nextBestMove?.title ?? "Upload a report to get your next step.";

    // ---- Widget state helpers ----
    const baseState = useMemo(() => {
        if (busy || (status !== "Idle" && status !== "Complete" && status !== "Error")) return "loading";
        if (err || status === "Error") return "error";
        if (!result && status === "Idle") return "empty";
        if ((result?.quality?.completenessScore ?? 100) < 85) return "partial";
        return "ready";
    }, [busy, status, err, result]);

    const stateFor = (hasData: boolean) => {
        if (baseState === "loading" || baseState === "error" || baseState === "empty") return baseState;
        return hasData ? baseState : "partial";
    };

    const utilizationState = stateFor(!!util?.overall);
    const negativesState = stateFor(Array.isArray(result?.negatives));
    const inquiriesState = stateFor(Array.isArray(result?.inquiries));

    // ------------------ API flows ------------------
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

    async function downloadLetter(fileKey: string) {
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
        setLetters([]);

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
                headers,
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
        status === "Complete"
            ? "text-emerald-300"
            : status === "Error"
                ? "text-rose-300"
                : status === "Processing"
                    ? "text-amber-200"
                    : status === "Queued"
                        ? "text-cyan-200"
                        : "text-white/70";

    return (
        <div className="min-h-screen bg-[#05060a] text-white">
            {/* background vibes */}
            <GradientOrb className="left-[-160px] top-[-140px] h-[520px] w-[520px]" />
            <GradientOrb className="right-[-180px] top-[140px] h-[620px] w-[620px]" />
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.18]"
                style={{
                    backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.35) 1px, transparent 0)",
                    backgroundSize: "22px 22px",
                }}
            />

            {/* top bar */}
            <div className="sticky top-0 z-20 border-b border-white/10 bg-black/35 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
                            <Sparkles className="h-5 w-5 text-white/90" />
                        </div>
                        <div>
                            <div className="font-semibold leading-tight">Credit Strategy AI</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
                                {provider && reportDate ? (
                                    <span className="flex items-center gap-1.5">
                                        <span className="text-emerald-400">●</span>
                                        {provider} Report • {reportDate}
                                    </span>
                                ) : (
                                    "Widget Dashboard"
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {completeness !== null && (
                            <div className="hidden sm:flex items-center gap-2 mr-2">
                                <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Completeness</div>
                                <div className="text-xs font-black text-white/80">{completeness}%</div>
                                <div className="h-1 w-12 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${completeness}%` }} />
                                </div>
                            </div>
                        )}

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

                        <button onClick={logout} className="text-white/40 hover:text-white/80 transition-colors">
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

                {result && status === "Complete" && (
                    <div className="mb-6">
                        <ReportHeader
                            bureau={result.meta?.bureau}
                            generatedDate={result.meta?.generatedDate}
                            score={result.score?.value}
                            rating={result.score?.rating}
                            completenessScore={result.quality?.completenessScore}
                            warningsCount={result.quality?.warnings?.length}
                            onUploadNew={() => document.getElementById("pdf")?.click()}
                            onRerun={runRetryFlow}
                        />
                    </div>
                )}

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

                <DashboardGrid>
                    {/* BIG SCORE */}
                    <div className="lg:col-span-8">
                        <WidgetCard
                            title="Score Pulse"
                            subtitle={result?.meta?.bureau ? `Source: ${result.meta.bureau}` : "Estimated credit health based on report data"}
                            state={baseState}
                            badge={rating || undefined}
                            action={
                                <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono">
                                    {reportId ? `REF: ${reportId.slice(0, 8)}` : ""}
                                </div>
                            }
                        >
                            <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
                                <div className="flex-1">
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-7xl font-black tracking-tight text-white">{score ?? "—"}</div>
                                        <div className="text-sm font-bold text-white/40 uppercase tracking-widest">
                                            {score ? result?.score?.model ?? "SCORE" : "EST."}
                                        </div>
                                    </div>

                                    <div className="mt-8">
                                        <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-4">
                                            Impact Assessment
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            {impactRanking.slice(0, 3).map((item: any, i: number) => {
                                                const snippet = String(item?.evidence?.[0]?.snippet || "");
                                                const shown = snippet.slice(0, 120);
                                                return (
                                                    <div
                                                        key={i}
                                                        className="group relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/5 p-4 transition-all hover:bg-white/[0.06] hover:border-white/10"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className={cn(
                                                                        "h-2 w-2 rounded-full",
                                                                        item.severity === "Critical"
                                                                            ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                                                                            : item.severity === "High"
                                                                                ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                                                                                : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                                                    )}
                                                                />
                                                                <span className="text-xs font-black uppercase tracking-wider text-white/90">
                                                                    {item.title}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-white/30 uppercase">
                                                                {item.severity}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-white/60 leading-relaxed mb-3">{item.whyItMatters}</p>
                                                        {shown ? (
                                                            <div className="text-[10px] text-emerald-400/60 font-medium italic bg-emerald-400/5 rounded px-2 py-1 inline-block">
                                                                Verified: “{shown}{snippet.length > 120 ? "…" : ""}”
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="mt-8 flex flex-wrap gap-2">
                                        <div className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-bold text-white/60 uppercase tracking-wider">
                                            Util: {util?.overall?.overallUtilizationPct ?? "—"}%
                                        </div>
                                        <div className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-bold text-white/60 uppercase tracking-wider">
                                            Issues: {issuesCount ?? "—"}
                                        </div>
                                        <div className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-bold text-white/60 uppercase tracking-wider">
                                            Late Pays: {lateCount ?? "—"}
                                        </div>
                                        <div className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-bold text-white/60 uppercase tracking-wider">
                                            Collections: {collectionsCount ?? "—"}
                                        </div>
                                        <div className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-bold text-white/60 uppercase tracking-wider">
                                            Inquiries: {inquiries.length}
                                        </div>
                                    </div>
                                </div>

                                <div className="h-32 w-full sm:w-[280px] opacity-80" id="sparkline-chart">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={spark}>
                                            <Tooltip
                                                contentStyle={{
                                                    background: "rgba(10,12,18,.95)",
                                                    border: "1px solid rgba(255,255,255,.1)",
                                                    borderRadius: 12,
                                                    fontSize: "10px",
                                                }}
                                            />
                                            <defs>
                                                <linearGradient id="scoreG" x1="0" x2="0" y1="0" y2="1">
                                                    <stop offset="0%" stopColor="rgba(56,189,248,.3)" />
                                                    <stop offset="100%" stopColor="rgba(56,189,248,0)" />
                                                </linearGradient>
                                            </defs>
                                            <Area type="monotone" dataKey="v" stroke="#38bdf8" strokeWidth={2} fill="url(#scoreG)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </WidgetCard>
                    </div>

                    {/* RIGHT STACK */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        <WidgetCard title="Issues Found" state={baseState} onClick={() => setActiveModal("negatives")}>
                            <div className="text-5xl font-black text-rose-400">{issuesCount ?? "—"}</div>
                            <div className="mt-2 text-sm text-white/50 leading-relaxed">
                                Ranked items likely impacting your score (payment history, utilization, derogatories, inquiries).
                            </div>
                        </WidgetCard>

                        <WidgetCard
                            title={mia ? "🔥 MOST IMPORTANT ACTION" : "Next Best Move"}
                            state={baseState}
                            action={
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                                    <span>Plan</span>
                                    <ChevronRight className="h-3 w-3" />
                                </div>
                            }
                        >
                            {mia ? (
                                <div className="space-y-4">
                                    <div className="text-lg font-black text-white leading-tight">{mia.action}</div>
                                    <div className="space-y-2">
                                        {mia.steps?.map((step: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-sm font-bold text-white/80">
                                                <span className="text-emerald-400">→</span>
                                                {step}
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                            <div className="text-[10px] text-white/40 uppercase tracking-widest">Est. Boost</div>
                                            <div className="text-sm font-bold text-emerald-400">{mia.expected_boost}</div>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                            <div className="text-[10px] text-white/40 uppercase tracking-widest">Timeline</div>
                                            <div className="text-sm font-bold text-white/80">{mia.timeline}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="text-sm font-bold leading-relaxed text-white/90">{nextAction}</div>
                                    <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                                        <span>View Action Steps</span>
                                        <ChevronRight className="h-3 w-3" />
                                    </div>
                                </div>
                            )}
                        </WidgetCard>

                        <WidgetCard
                            title="Utilization"
                            state={utilizationState}
                            action={
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveModal("utilization");
                                    }}
                                    className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest hover:text-emerald-400 transition-colors"
                                >
                                    Details
                                </button>
                            }
                        >
                            <div className="flex items-end justify-between">
                                <div>
                                    <div className="text-4xl font-black">
                                        {util?.overall?.overallUtilizationPct ?? "—"}%
                                        {(util?.overall?.overallUtilizationPct ?? 0) > 30 ? <span className="ml-2 text-xl">⚠️</span> : null}
                                    </div>
                                    <div className="mt-1 text-xs text-white/40">Total Revolving</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Target</div>
                                    <div className="text-xs text-emerald-400 font-bold">
                                        {util?.overall?.targetRangePct?.min ?? 1}–{util?.overall?.targetRangePct?.max ?? 9}%
                                    </div>
                                </div>
                            </div>
                        </WidgetCard>
                    </div>

                    {/* NEGATIVES */}
                    <div className="lg:col-span-4">
                        <WidgetCard
                            title="Negative Items"
                            state={negativesState}
                            badge={negatives.length ? `${negatives.length} total` : undefined}
                            onClick={() => setActiveModal("negatives")}
                        >
                            {negatives.length ? (
                                <div className="space-y-2">
                                    {negatives.slice(0, 3).map((n: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex items-center justify-between group hover:bg-white/[0.05] transition-colors"
                                        >
                                            <div>
                                                <div className="text-xs font-bold text-white/90">{n.creditor || "Unknown"}</div>
                                                <div className="text-[10px] text-white/40">
                                                    {n.category || "Issue"} • {n.lastReported || n.dateOpened || "—"}
                                                </div>
                                            </div>
                                            <div
                                                className={cn(
                                                    "text-[10px] font-black px-1.5 py-0.5 rounded",
                                                    n.severity === "Critical"
                                                        ? "bg-rose-500/20 text-rose-400"
                                                        : n.severity === "High"
                                                            ? "bg-amber-500/20 text-amber-300"
                                                            : "bg-emerald-500/20 text-emerald-400"
                                                )}
                                            >
                                                {(n.severity ? String(n.severity).toUpperCase() : "UNKNOWN") as string}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-white/30 italic">No negative items found yet.</p>
                            )}
                        </WidgetCard>
                    </div>

                    {/* INQUIRIES */}
                    <div className="lg:col-span-4">
                        <WidgetCard
                            title="Recent Inquiries"
                            state={inquiriesState}
                            badge={inquiries.length ? `${inquiries.length}` : undefined}
                            onClick={() => setActiveModal("inquiries")}
                        >
                            {inquiries.length ? (
                                <div className="space-y-2">
                                    {inquiries.slice(0, 3).map((i: any, idx: number) => (
                                        <div key={idx} className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex items-center justify-between">
                                            <div>
                                                <div className="text-xs font-bold text-white/90">{i.creditor || "Inquiry"}</div>
                                                <div className="text-[10px] text-white/40">{i.date || "—"}</div>
                                            </div>
                                            <div className="text-[10px] font-medium text-white/30 uppercase">{i.type || "Unknown"}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-white/30 italic">No recent inquiries.</p>
                            )}
                        </WidgetCard>
                    </div>

                    {/* LETTERS (now consistent with WidgetCard) */}
                    <div className="lg:col-span-12" id="letters-section">
                        <WidgetCard
                            title="Dispute Letters"
                            subtitle="Generated automatically after analysis completes"
                            state={baseState}
                            badge={letters.length ? `${letters.length}` : undefined}
                        >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                {letters.length ? (
                                    letters.map((l: any) => (
                                        <div key={l.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition">
                                            <div className="text-xs font-semibold uppercase tracking-widest text-white/40">{l.bureau}</div>
                                            <div className="mt-1 text-lg font-bold text-white/90">PDF Document</div>
                                            <button
                                                onClick={() => downloadLetter(l.file_key)}
                                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
                                            >
                                                <FileText className="h-4 w-4" />
                                                Download
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-3 py-8 text-center text-white/30 italic">
                                        {status === "Complete" ? "No letters were generated for this report." : "Letters will appear here once analysis is complete."}
                                    </div>
                                )}
                            </div>
                        </WidgetCard>
                    </div>
                </DashboardGrid>

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
            <Modal isOpen={activeModal === "utilization"} onClose={() => setActiveModal(null)} title="Utilization Analysis">
                <div className="space-y-6">
                    <div className="flex items-center justify-between rounded-3xl bg-white/5 p-6 border border-white/10">
                        <div>
                            <div className="text-sm text-white/60 mb-1">Overall Utilization</div>
                            <div className="text-4xl font-black">{util?.overall?.overallUtilizationPct ?? "—"}%</div>
                        </div>
                        <div className="text-right">
                            <Pill color={(util?.overall?.overallUtilizationPct ?? 0) > 30 ? "rose" : "amber"}>
                                {(util?.overall?.overallUtilizationPct ?? 0) > 30 ? "High Impact" : "Fair"}
                            </Pill>
                            <div className="mt-2 text-xs text-white/50">
                                Target: {util?.overall?.targetRangePct?.min ?? 1}–{util?.overall?.targetRangePct?.max ?? 9}%
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-white/80 mb-3 px-1 uppercase tracking-wider">Account Breakdown</h3>
                        <div className="space-y-3">
                            {(util?.revolvingAccounts || []).map((a: any, idx: number) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 p-4 transition-colors hover:bg-white/10"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div className="font-bold text-white">{a.creditor || "Revolving Account"}</div>
                                            {a.utilizationPct > 100 ? "❌" : a.utilizationPct > 9 ? "⚠️" : ""}
                                        </div>
                                        <div className="text-xs text-white/50">
                                            Balance: <span className="text-white/80">{a.balance ?? "—"}</span> • Limit:{" "}
                                            <span className="text-white/80">{a.limit ?? "—"}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn("text-lg font-black", (a.utilizationPct ?? 0) > 30 ? "text-rose-400" : "text-emerald-400")}>
                                            {a.utilizationPct ?? "—"}%
                                        </div>
                                        <div className="h-1.5 w-24 bg-white/10 rounded-full mt-1 overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all", (a.utilizationPct ?? 0) > 30 ? "bg-rose-400" : "bg-emerald-400")}
                                                style={{ width: `${Math.min(a.utilizationPct || 0, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={activeModal === "negatives"} onClose={() => setActiveModal(null)} title="Negative Impact Items">
                <div className="space-y-4">
                    <p className="text-sm text-white/60 px-1 italic">The following items are causing the most significant drag on your score.</p>
                    <div className="space-y-3">
                        {(negatives || []).map((n: any, idx: number) => {
                            const snippet = String(n?.evidence?.[0]?.snippet || "");
                            const shown = snippet.slice(0, 160);
                            return (
                                <div key={idx} className="rounded-2xl bg-white/5 border border-white/10 p-5 group transition-all hover:bg-white/10">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="text-lg font-bold text-white">{n.category || "Negative Item"}</div>
                                            <div className="text-sm text-white/60 mt-1">
                                                {n.creditor || "Unknown"} • {n.lastReported || n.dateOpened || "—"}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Pill color={n.severity === "Critical" || n.severity === "High" ? "rose" : "amber"}>
                                                {n.severity || "Unknown"} • {(n.confidence ?? 0).toFixed(2)}
                                            </Pill>
                                        </div>
                                    </div>

                                    {shown ? (
                                        <div className="mt-3 text-xs text-white/60 rounded-xl bg-white/5 border border-white/10 p-3">
                                            <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Evidence</div>
                                            <div className="leading-relaxed">“{shown}{snippet.length > 160 ? "…" : ""}”</div>
                                        </div>
                                    ) : null}

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
                                        <button className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all">
                                            View Details
                                            <ExternalLink className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={activeModal === "inquiries"} onClose={() => setActiveModal(null)} title="Credit Inquiries">
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                            <div className="text-2xl font-black text-white">{inquiries.length}</div>
                            <div className="text-xs text-white/50 uppercase tracking-widest mt-1">Total inquiries</div>
                        </div>
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                            <div className="text-2xl font-black text-emerald-400">{inquiries.length > 3 ? "Med" : "Low"}</div>
                            <div className="text-xs text-white/50 uppercase tracking-widest mt-1">Impact level</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {inquiries.map((i: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4">
                                <div>
                                    <div className="font-bold text-white">{i.creditor || "Inquiry"}</div>
                                    <div className="text-xs text-white/50">{i.date || "—"}</div>
                                </div>
                                <Pill>{i.type || "Unknown"}</Pill>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
}