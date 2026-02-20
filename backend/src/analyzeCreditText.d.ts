export type CreditAnalysis = {
    summary: {
        score_estimate?: number | null;
        issues_count: number;
        key_findings: string[];
    };
    negatives: Array<{
        type: "late_payment" | "collections" | "charge_off" | "bankruptcy" | "public_record" | "other";
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
        bureau?: "experian" | "equifax" | "transunion" | "unknown";
        creditor?: string | null;
        date?: string | null;
    }>;
    dispute_letters: Array<{
        letter_type: "late_payment" | "collection" | "charge_off" | "inquiry" | "identity" | "general";
        recipient: "bureau" | "creditor" | "collector";
        subject: string;
        bullet_points: string[];
    }>;
};
export declare function analyzeCreditText(rawText: string): Promise<CreditAnalysis>;
//# sourceMappingURL=analyzeCreditText.d.ts.map