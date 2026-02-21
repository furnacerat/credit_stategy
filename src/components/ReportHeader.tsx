import React from "react";

export function ReportHeader(props: {
    bureau?: string | null;
    generatedDate?: string | null;
    score?: number | null;
    rating?: string | null;
    completenessScore?: number | null;
    warningsCount?: number;
    onUploadNew?: () => void;
    onRerun?: () => void;
}) {
    const {
        bureau, generatedDate, score, rating,
        completenessScore, warningsCount = 0,
        onUploadNew, onRerun
    } = props;

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 shadow-lg">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                            {(bureau ?? "Unknown Bureau").toUpperCase()}
                        </span>
                        <span className="text-xs text-white/60">
                            {generatedDate ? `Generated ${generatedDate}` : "Date unknown"}
                        </span>
                    </div>

                    <div className="flex items-baseline gap-3">
                        <div className="text-2xl font-bold text-white">
                            {score ?? "—"}
                        </div>
                        <div className="text-sm text-white/70">
                            {rating ?? "Rating unknown"}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                        <span>Completeness: {completenessScore ?? 0}%</span>
                        {warningsCount > 0 ? <span>Warnings: {warningsCount}</span> : null}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onUploadNew}
                        className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
                    >
                        Upload new
                    </button>
                    <button
                        onClick={onRerun}
                        className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/30"
                    >
                        Re-run analysis
                    </button>
                </div>
            </div>
        </div>
    );
}
