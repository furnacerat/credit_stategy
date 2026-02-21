import React from "react";

function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

type WidgetState = "loading" | "empty" | "partial" | "ready" | "error";

export function WidgetCard(props: {
    title: string;
    subtitle?: string;
    state: WidgetState;
    badge?: string;
    action?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    onClick?: () => void;
}) {
    const { title, subtitle, state, badge, action, children, className, onClick } = props;

    return (
        <div
            className={cn(
                "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg h-full transition-all duration-300",
                onClick && "cursor-pointer hover:bg-white/10 hover:border-white/20 hover:-translate-y-1",
                className
            )}
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-3 p-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
                        {badge ? (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                                {badge}
                            </span>
                        ) : null}
                    </div>
                    {subtitle ? (
                        <p className="mt-1 text-xs text-white/60">{subtitle}</p>
                    ) : null}
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>

            <div className="px-4 pb-4">
                {state === "loading" && (
                    <div className="space-y-4 py-2">
                        <div className="h-4 w-2/3 rounded bg-white/10 animate-pulse" />
                        <div className="h-4 w-1/2 rounded bg-white/10 animate-pulse" />
                        <div className="h-4 w-5/6 rounded bg-white/10 animate-pulse" />
                    </div>
                )}

                {state === "empty" && (
                    <div className="py-8 text-center">
                        <p className="text-sm text-white/40 italic">
                            No report data available.
                        </p>
                    </div>
                )}

                {state === "partial" && (
                    <div className="space-y-4">
                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-[10px] text-amber-200/70">
                            ⚠️ Partial results: Some metrics were missing from the source report.
                        </div>
                        {children}
                    </div>
                )}

                {state === "error" && (
                    <div className="py-8 text-center text-rose-400">
                        <p className="text-sm font-bold">
                            Analysis Failed
                        </p>
                        <p className="mt-1 text-[10px] text-white/40">
                            There was an issue parsing this section.
                        </p>
                    </div>
                )}

                {state === "ready" && children}
            </div>
        </div>
    );
}
