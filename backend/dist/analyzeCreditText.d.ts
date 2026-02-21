export type CreditAnalysis = {
    score_estimate: number;
    issues_count: number;
    top_issues: Array<{
        type: string;
        severity: string;
        impact_points: number;
    }>;
    next_best_action: string;
};
export declare function analyzeCreditText(rawText: string): Promise<CreditAnalysis>;
//# sourceMappingURL=analyzeCreditText.d.ts.map