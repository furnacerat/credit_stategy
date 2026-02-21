export type Evidence = {
    snippet: string;
    page?: number | null;
};
export type CreditAnalysis = {
    meta: {
        bureau: "experian" | "equifax" | "transunion" | "unknown";
        generatedDate: string | null;
        reportSource: string | null;
    };
    score: {
        model: string | null;
        value: number | null;
        rating: "Excellent" | "Very Good" | "Good" | "Fair" | "Poor" | null;
        evidence: Evidence[];
    };
    accountSummary: {
        openAccounts: number | null;
        closedAccounts: number | null;
        collectionsCount: number | null;
        accountsEverLate: number | null;
        averageAccountAge: string | null;
        oldestAccountAge: string | null;
        evidence: Evidence[];
    };
    utilization: {
        overall: {
            creditUsed: number | null;
            creditLimit: number | null;
            overallUtilizationPct: number | null;
            targetRangePct: {
                min: number;
                max: number;
            };
        };
        revolvingAccounts: Array<{
            creditor: string;
            accountType: "Credit card" | "Charge card" | "Revolving" | "Line of credit" | "Other";
            balance: number | null;
            limit: number | null;
            utilizationPct: number | null;
            status: string | null;
            lateCounts: {
                "30": number;
                "60": number;
                "90": number;
                "120plus": number;
                chargeOff: number;
                collection: number;
            };
            evidence: Evidence[];
        }>;
        evidence: Evidence[];
    };
    negatives: Array<{
        category: "Late Payments" | "Collection" | "Charge Off" | "Bankruptcy" | "Repossession" | "Foreclosure" | "Other";
        creditor: string | null;
        amount: number | null;
        status: string | null;
        dateOpened: string | null;
        lastReported: string | null;
        recencyNote: string | null;
        severity: "Critical" | "High" | "Medium" | "Low";
        confidence: number;
        evidence: Evidence[];
    }>;
    inquiries: Array<{
        creditor: string | null;
        date: string | null;
        type: "Hard" | "Soft" | "Unknown";
        evidence: Evidence[];
    }>;
    impactRanking: Array<{
        priority: number;
        issueKey: string;
        title: string;
        whyItMatters: string;
        whatToDoNext: string[];
        expectedImpact: string | null;
        evidence: Evidence[];
    }>;
    nextBestMove: {
        title: string;
        steps: string[];
        expectedImpact: string | null;
        timeframe: string | null;
        evidence: Evidence[];
    };
    quality: {
        completenessScore: number;
        missingFields: string[];
        warnings: string[];
    };
};
export declare function analyzeCreditText(rawText: string): Promise<CreditAnalysis>;
//# sourceMappingURL=analyzeCreditText.d.ts.map