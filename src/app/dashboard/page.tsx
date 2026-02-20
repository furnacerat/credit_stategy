"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

type PresignResp =
    | { ok: true; file_key: string; upload_url: string; expires_in: number }
    | { ok: false; error: string };

type CreateReportResp =
    | {
        ok: true;
        report: { id: string; filename: string; file_key: string; created_at: string };
        job: { id: string; status: string; progress: string; created_at: string };
    }
    | { ok: false; error: string };

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
    | { ok: false; error: string };

type CreditAnalysis = {
    summary: {
        score_estimate?: number | null;
        issues_count: number;
        key_findings: string[];
    };
    negatives: Array<{
        type: string;
        creditor?: string | null;
        account_last4?: string | null;
        date?: string | null;
        notes?: string | null;
        severity: "low" | "medium" | "high";
    }>;
    utilization: {
        overall_percent?: number | null;
        revolving_accounts?: Array<{
            creditor?: string | null;
            account_last4?: string | null;
            limit?: number | null;
            balance?: number | null;
            utilization_percent?: number | null;
        }>;
    };
    inquiries: Array<{
        bureau?: string;
        creditor?: string | null;
        date?: string | null;
    }>;
    dispute_letters: Array<{
        letter_type: string;
        recipient: string;
        subject: string;
        bullet_points: string[];
    }>;
};

type ResultResp =
    | { ok: true; result: { result_json: CreditAnalysis; created_at: string } }
    | { ok: false; error: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

function Widget({
    title,
    children,
    footer,
}: {
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/90">{title}</h3>
            </div>
            <div className="text-white">{children}</div>
            {footer ? <div className="mt-4 border-t border-white/10 pt-3 text-white/70 text-xs">{footer}</div> : null}
        </div>
    );
}

export default function DashboardPage() {
    const [file, setFile] = useState<File | null>(null);

    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<string>("Idle");
    const [result, setResult] = useState<CreditAnalysis | null>(null);
    const [error, setError] = useState<string | null>(null);

    const headers = useMemo(() => {
        return {
            "x-user-id": "demo_user",
        };
    }, []);

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
        setStatus("Queued");
        for (let i = 0; i < 60; i++) {
            const r = await fetch(`${API_BASE}/jobs/${jobId}`, { headers });
            const data: JobResp = await r.json();
            if (!data.ok) throw new Error("Job status check failed");

            const s = data.job.status;
            setStatus(s === "processing" ? (data.job.progress || "Processing") : s === "complete" ? "Complete" : s === "failed" ? "Failed" : "Queued");

            if (s === "failed") throw new Error(data.job.error || "Job failed");
            if (s === "complete") return;
            await new Promise((res) => setTimeout(res, 1500));
        }
        throw new Error("Timed out waiting for job");
    }

    async function fetchResult(reportId: string): Promise<CreditAnalysis> {
        const r = await fetch(`${API_BASE}/reports/${reportId}/result`, { headers });
        const data: ResultResp = await r.json();
        if (!data.ok) throw new Error("No result yet");
        return data.result.result_json;
    }

    async function handleUpload() {
        if (!file) return;

        setError(null);
        setResult(null);
        setUploading(true);
        setStatus("Starting…");

        try {
            const p = await presignUpload(file.name);
            if (!p.ok) throw new Error(typeof p.error === 'string' ? p.error : "Presign failed");

            setStatus("Uploading…");
            await putToR2(p.upload_url, file);

            setStatus("Creating job…");
            const cr = await createReport(file.name, p.file_key);
            if (!cr.ok) throw new Error(typeof cr.error === 'string' ? cr.error : "Create report failed");

            await pollJob(cr.job.id);

            setStatus("Fetching results…");
            const resJson = await fetchResult(cr.report.id);
            setResult(resJson);
            setStatus("Complete");
        } catch (e: unknown) {
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError("Something went wrong");
            }
            setStatus("Error");
        } finally {
            setUploading(false);
        }
    }

    const score = result?.summary?.score_estimate ?? null;
    const issues = result?.summary?.issues_count ?? 0;
    const findings = result?.summary?.key_findings ?? [];
    const negatives = result?.negatives ?? [];
    const utilization = result?.utilization ?? {};
    const letters = result?.dispute_letters ?? [];

    return (
        <div className="min-h-screen bg-[#05060a] text-white selection:bg-white/10">
            {/* Top bar */}
            <div className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20" />
                        <div className="text-lg font-bold tracking-tight">Credit Strategy AI</div>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="hidden sm:flex items-center gap-2 text-xs font-medium text-white/40">
                            <span>Status:</span>
                            <span className={clsx(
                                "rounded-full px-2.5 py-0.5 border capitalize",
                                status === "Complete" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                    status === "Error" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                                        status === "Idle" ? "bg-white/5 border-white/10 text-white/40" :
                                            "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 animate-pulse"
                            )}>
                                {status}
                            </span>
                        </label>

                        <div className="flex items-center gap-2 h-10 px-1 rounded-2xl bg-white/5 border border-white/10">
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="hidden"
                                id="pdfInput"
                            />
                            <label
                                htmlFor="pdfInput"
                                className="cursor-pointer rounded-xl px-3 py-1.5 text-xs font-medium hover:bg-white/5 transition-colors text-white/70"
                            >
                                {file ? file.name : "Choose PDF"}
                            </label>

                            <button
                                onClick={handleUpload}
                                disabled={!file || uploading}
                                className={clsx(
                                    "rounded-xl px-4 py-1.5 text-xs font-bold transition-all shadow-sm",
                                    !file || uploading
                                        ? "bg-white/5 text-white/20 cursor-not-allowed"
                                        : "bg-white text-black hover:bg-white/90 active:scale-95"
                                )}
                            >
                                {uploading ? "Analyzing..." : "Analyze Report"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <main className="mx-auto max-w-6xl px-4 py-8">
                {error && (
                    <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                        <span className="font-bold mr-2">Error:</span> {error}
                    </div>
                )}

                {!result && !uploading && !error && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="mb-6 h-16 w-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10">
                            <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Ready to analyze</h2>
                        <p className="text-white/40 max-w-sm mb-8">Upload your credit report PDF to get a professional breakdown and dispute strategy.</p>
                    </div>
                )}

                {uploading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="mb-6 relative">
                            <div className="h-20 w-20 rounded-full border-4 border-white/5 border-t-white animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/40">AI</div>
                        </div>
                        <h2 className="text-xl font-bold mb-2">{status}...</h2>
                        <p className="text-white/40 max-w-sm">Our AI is parsing your report and identifying key strategy items. This usually takes 15-30 seconds.</p>
                    </div>
                )}

                {result && (
                    <div className="grid gap-6 md:grid-cols-12">
                        {/* Left: Summary Metrics */}
                        <div className="space-y-6 md:col-span-4">
                            <Widget title="Score Estimate">
                                <div className="flex items-baseline gap-2 py-2">
                                    <span className="text-5xl font-black tracking-tighter bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent italic">
                                        {score || "???"}
                                    </span>
                                    <span className="text-xs font-bold text-white/30 uppercase tracking-widest">FICO®</span>
                                </div>
                                <div className="mt-2 text-xs text-white/40 leading-relaxed font-medium">
                                    This is an AI-estimated score based on your report findings.
                                </div>
                            </Widget>

                            <Widget title="Negative Items">
                                <div className="flex items-baseline gap-2 py-2">
                                    <span className="text-5xl font-black italic text-red-500">{issues}</span>
                                    <span className="text-xs font-bold text-red-500/50 uppercase tracking-widest">Flags Found</span>
                                </div>
                                <div className="mt-4 space-y-3">
                                    {negatives.slice(0, 3).map((n, i: number) => (
                                        <div key={i} className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-xs border border-white/5">
                                            <div className={clsx(
                                                "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                                                n.severity === "high" ? "bg-red-500 shadow-sm shadow-red-500/40" : n.severity === "medium" ? "bg-amber-500" : "bg-emerald-500"
                                            )} />
                                            <div className="space-y-1">
                                                <p className="font-bold text-white/80">{n.type?.replace('_', ' ')}</p>
                                                <p className="text-white/40">{n.creditor || 'Unknown creditor'} • {n.account_last4 ? `****${n.account_last4}` : 'No account info'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Widget>

                            <Widget title="Utilization Summary">
                                <div className="py-2">
                                    <div className="flex items-baseline justify-between mb-2">
                                        <span className="text-3xl font-black italic">{utilization.overall_percent || 0}%</span>
                                        <span className="text-[10px] font-bold text-white/20 uppercase">Total Limit Used</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 transition-all duration-1000"
                                            style={{ width: `${Math.min(utilization.overall_percent || 0, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </Widget>
                        </div>

                        {/* Right: Detailed Analysis & Letters */}
                        <div className="space-y-6 md:col-span-8">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                                <div className="mb-6 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold">Strategic Brief</h2>
                                        <p className="text-xs text-white/30 font-medium">AI-generated strategy for your credit profile</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {findings.map((f: string, i: number) => (
                                        <div key={i} className="flex gap-4 p-4 rounded-xl bg-black/20 border border-white/5 group">
                                            <div className="h-6 w-6 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/30 group-hover:bg-white/10 transition-colors">{i + 1}</div>
                                            <p className="text-sm text-white/70 leading-relaxed font-medium">{f}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
                                <div className="mb-6">
                                    <h2 className="text-lg font-bold">Dispute Letter Templates</h2>
                                    <p className="text-xs text-white/30 font-medium">Ready-to-use dispute letters generated for identified items</p>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    {letters.map((l, i: number) => (
                                        <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer group">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{l.letter_type?.replace('_', ' ')}</span>
                                                <svg className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-sm font-bold mb-2 group-hover:text-white transition-colors">{l.subject}</h3>
                                            <p className="text-[11px] text-white/40 line-clamp-2 leading-relaxed">{l.bullet_points?.[0] || 'View details...'}</p>
                                        </div>
                                    ))}
                                </div>

                                {letters.length === 0 && (
                                    <div className="py-8 text-center bg-white/2 rounded-2xl border border-dashed border-white/10">
                                        <p className="text-xs text-white/20 font-bold uppercase tracking-widest">No letters required</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
