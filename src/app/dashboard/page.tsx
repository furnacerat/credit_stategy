"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import { Upload, FileText, Sparkles, AlertTriangle, ShieldCheck, Activity } from "lucide-react";

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
}: {
    title: string;
    icon?: React.ReactNode;
    accent?: "mint" | "violet" | "sunset" | "ice" | "amber";
    children: React.ReactNode;
    className?: string;
    footer?: React.ReactNode;
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
            whileHover={{ y: -2, scale: 1.01 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className={cn(
                "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur-xl",
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
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 border border-white/10">
                        {icon}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-white/90">{title}</div>
                        <div className="text-xs text-white/60">Live from latest report</div>
                    </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-400/90 shadow-[0_0_16px_rgba(52,211,153,.65)]" />
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

function Pill({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80">
            {children}
        </span>
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
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState<"Idle" | "Presigning" | "Uploading" | "Creating" | "Queued" | "Processing" | "Complete" | "Error">("Idle");
    const [jobId, setJobId] = useState<string | null>(null);
    const [reportId, setReportId] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [err, setErr] = useState<string | null>(null);

    // replace later with real auth
    const headers = useMemo(() => ({ "x-user-id": "demo_user" }), []);

    // demo sparkline until you have real history
    const spark = useMemo(
        () =>
            Array.from({ length: 24 }).map((_, i) => ({
                i,
                v: 580 + Math.round(Math.sin(i / 3) * 22) + Math.round(Math.random() * 18),
            })),
        []
    );

    const score = result?.summary?.score_estimate ?? result?.score_estimate ?? null;
    const issues = result?.summary?.issues_count ?? result?.issues_count ?? null;
    const nextAction = result?.summary?.key_findings?.[0] ?? result?.next_best_action ?? "Upload a report to get your next step.";
    const negatives = result?.negatives ?? result?.top_issues ?? [];
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

    async function fetchResult(reportId: string) {
        const r = await fetch(`${API_BASE}/reports/${reportId}/result`, { headers });
        const data: ResultResp = await r.json();
        if (!data.ok) throw new Error("No result yet");
        return data.result.result_json;
    }

    async function runUploadFlow() {
        if (!file || busy) return;
        setBusy(true);
        setErr(null);
        setResult(null);
        setJobId(null);
        setReportId(null);

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

            const res = await fetchResult(cr.report.id);
            setResult(res);
            setStatus("Complete");
        } catch (e: any) {
            setErr(e?.message || "Something went wrong");
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

                {/* GRID */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    {/* BIG SCORE */}
                    <div className="lg:col-span-8">
                        <GlassCard
                            title="Score Pulse"
                            icon={<Activity className="h-5 w-5 text-white/90" />}
                            accent="ice"
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
                                    </div>
                                    <div className="mt-2 text-sm text-white/70">
                                        Animated trend preview (swap to real history later).
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <Pill>Utilization: {util?.overall_percent ?? "—"}%</Pill>
                                        <Pill>Issues: {issues ?? "—"}</Pill>
                                        <Pill>Inquiries: {Array.isArray(inquiries) ? inquiries.length : 0}</Pill>
                                    </div>
                                </div>

                                <div className="h-28 w-full sm:w-[320px]">
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
                        >
                            <div className="text-5xl font-black">{issues ?? "—"}</div>
                            <div className="mt-2 text-sm text-white/70">
                                Items likely impacting score (late pays, collections, utilization, etc.)
                            </div>
                        </GlassCard>

                        <GlassCard
                            title="Next Best Move"
                            icon={<Sparkles className="h-5 w-5 text-white/90" />}
                            accent="sunset"
                        >
                            <div className="text-sm leading-6 text-white/90">{nextAction}</div>
                            <div className="mt-3 text-xs text-white/60">
                                (This becomes “tap-to-open” action flows on mobile.)
                            </div>
                        </GlassCard>
                    </div>

                    {/* UTILIZATION */}
                    <div className="lg:col-span-4">
                        <GlassCard title="Utilization" icon={<Activity className="h-5 w-5 text-white/90" />} accent="violet">
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
                        <GlassCard title="Negative Items" icon={<AlertTriangle className="h-5 w-5 text-white/90" />} accent="amber">
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
                        <GlassCard title="Inquiries" icon={<FileText className="h-5 w-5 text-white/90" />} accent="ice">
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
                    <div className="lg:col-span-12">
                        <GlassCard
                            title="Dispute Letters"
                            icon={<Sparkles className="h-5 w-5 text-white/90" />}
                            accent="sunset"
                            footer={
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <span>We’ll store letters so re-downloads are always identical.</span>
                                    <div className="flex gap-2">
                                        <FancyButton variant="ghost" disabled>
                                            Generate
                                        </FancyButton>
                                        <FancyButton variant="primary" disabled>
                                            Download All
                                        </FancyButton>
                                    </div>
                                </div>
                            }
                        >
                            <div className="text-sm text-white/70">
                                Next build: generate & store letter PDFs per bureau, then enable downloads.
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
        </div>
    );
}
