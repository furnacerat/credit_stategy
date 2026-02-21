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
            targetRangePct: { min: number; max: number };
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

import { openai } from "./openaiClient.js";

const evidenceSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        snippet: { type: "string" },
        page: { type: ["integer", "null"] }
    },
    required: ["snippet", "page"]
} as const;

const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
        meta: {
            type: "object",
            additionalProperties: false,
            properties: {
                bureau: { enum: ["experian", "equifax", "transunion", "unknown"] },
                generatedDate: { type: ["string", "null"] },
                reportSource: { type: ["string", "null"] }
            },
            required: ["bureau", "generatedDate", "reportSource"]
        },
        score: {
            type: "object",
            additionalProperties: false,
            properties: {
                model: { type: ["string", "null"] },
                value: { type: ["integer", "null"] },
                rating: { enum: ["Excellent", "Very Good", "Good", "Fair", "Poor", null] },
                evidence: { type: "array", items: evidenceSchema }
            },
            required: ["model", "value", "rating", "evidence"]
        },
        accountSummary: {
            type: "object",
            additionalProperties: false,
            properties: {
                openAccounts: { type: ["integer", "null"] },
                closedAccounts: { type: ["integer", "null"] },
                collectionsCount: { type: ["integer", "null"] },
                accountsEverLate: { type: ["integer", "null"] },
                averageAccountAge: { type: ["string", "null"] },
                oldestAccountAge: { type: ["string", "null"] },
                evidence: { type: "array", items: evidenceSchema }
            },
            required: ["openAccounts", "closedAccounts", "collectionsCount", "accountsEverLate", "averageAccountAge", "oldestAccountAge", "evidence"]
        },
        utilization: {
            type: "object",
            additionalProperties: false,
            properties: {
                overall: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        creditUsed: { type: ["integer", "null"] },
                        creditLimit: { type: ["integer", "null"] },
                        overallUtilizationPct: { type: ["integer", "null"] },
                        targetRangePct: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                                min: { type: "integer" },
                                max: { type: "integer" }
                            },
                            required: ["min", "max"]
                        }
                    },
                    required: ["creditUsed", "creditLimit", "overallUtilizationPct", "targetRangePct"]
                },
                revolvingAccounts: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            creditor: { type: "string" },
                            accountType: { enum: ["Credit card", "Charge card", "Revolving", "Line of credit", "Other"] },
                            balance: { type: ["integer", "null"] },
                            limit: { type: ["integer", "null"] },
                            utilizationPct: { type: ["integer", "null"] },
                            status: { type: ["string", "null"] },
                            lateCounts: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    "30": { type: "integer" },
                                    "60": { type: "integer" },
                                    "90": { type: "integer" },
                                    "120plus": { type: "integer" },
                                    chargeOff: { type: "integer" },
                                    collection: { type: "integer" }
                                },
                                required: ["30", "60", "90", "120plus", "chargeOff", "collection"]
                            },
                            evidence: { type: "array", items: evidenceSchema }
                        },
                        required: ["creditor", "accountType", "balance", "limit", "utilizationPct", "status", "lateCounts", "evidence"]
                    }
                },
                evidence: { type: "array", items: evidenceSchema }
            },
            required: ["overall", "revolvingAccounts", "evidence"]
        },
        negatives: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    category: { enum: ["Late Payments", "Collection", "Charge Off", "Bankruptcy", "Repossession", "Foreclosure", "Other"] },
                    creditor: { type: ["string", "null"] },
                    amount: { type: ["integer", "null"] },
                    status: { type: ["string", "null"] },
                    dateOpened: { type: ["string", "null"] },
                    lastReported: { type: ["string", "null"] },
                    recencyNote: { type: ["string", "null"] },
                    severity: { enum: ["Critical", "High", "Medium", "Low"] },
                    confidence: { type: "number" },
                    evidence: { type: "array", items: evidenceSchema }
                },
                required: ["category", "creditor", "amount", "status", "dateOpened", "lastReported", "recencyNote", "severity", "confidence", "evidence"]
            }
        },
        inquiries: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    creditor: { type: ["string", "null"] },
                    date: { type: ["string", "null"] },
                    type: { enum: ["Hard", "Soft", "Unknown"] },
                    evidence: { type: "array", items: evidenceSchema }
                },
                required: ["creditor", "date", "type", "evidence"]
            }
        },
        impactRanking: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    priority: { type: "integer" },
                    issueKey: { type: "string" },
                    title: { type: "string" },
                    whyItMatters: { type: "string" },
                    whatToDoNext: { type: "array", items: { type: "string" } },
                    expectedImpact: { type: ["string", "null"] },
                    evidence: { type: "array", items: evidenceSchema }
                },
                required: ["priority", "issueKey", "title", "whyItMatters", "whatToDoNext", "expectedImpact", "evidence"]
            }
        },
        nextBestMove: {
            type: "object",
            additionalProperties: false,
            properties: {
                title: { type: "string" },
                steps: { type: "array", items: { type: "string" } },
                expectedImpact: { type: ["string", "null"] },
                timeframe: { type: ["string", "null"] },
                evidence: { type: "array", items: evidenceSchema }
            },
            required: ["title", "steps", "expectedImpact", "timeframe", "evidence"]
        },
        quality: {
            type: "object",
            additionalProperties: false,
            properties: {
                completenessScore: { type: "integer" },
                missingFields: { type: "array", items: { type: "string" } },
                warnings: { type: "array", items: { type: "string" } }
            },
            required: ["completenessScore", "missingFields", "warnings"]
        }
    },
    required: ["meta", "score", "accountSummary", "utilization", "negatives", "inquiries", "impactRanking", "nextBestMove", "quality"]
} as const;

export async function analyzeCreditText(rawText: string): Promise<CreditAnalysis> {
    console.log("[AI] Starting structured analysis with gpt-4o-mini using json_schema...");

    const messages = [
        {
            role: "system" as const,
            content:
                `You are Credit Strategy AI’s Report Extraction Engine.

                Your job: extract structured credit metrics from raw credit report text and return VALID JSON ONLY that matches the provided schema.

                Rules:
                - Output MUST be JSON only. No markdown, no commentary.
                - Do NOT guess. If a value is not present, use null and add an item to quality.missingFields.
                - Every metric shown to the user MUST include evidence: a short snippet from the source text and an optional page number if available.
                - Prefer numbers over adjectives. Convert $ and % to numeric values.
                - If you see contradictory values, choose the value that appears in the “At a glance” or “Account summary” area and record a warning in quality.warnings.
                - Never output >100% utilization.
                - Do not include PII (full SSN, full account numbers, DOB, full address). Redact with "***" if it appears in evidence snippets.
                - Compute derived fields when inputs exist (e.g., overallUtilizationPct = creditUsed / creditLimit * 100).
                - Provide a ranked “impactRanking” list with priority 1..N (1 is highest priority) based on severity, recency, and known scoring impact (payment history > utilization > derogatories > inquiries > age/mix).
                
                Targets:
                - Score model + value (e.g., “FICO Score 8 551”).
                - Generated date.
                - Account summary counts (open accounts, accounts ever late, collections).
                - Overall credit used + credit limit and derived utilization %.
                - Revolving accounts: creditor name, balance, limit, per-account utilization.
                - Identify severe negatives: collections, charge-offs, over-limit utilization, recent lates.`,
        },
        {
            role: "user" as const,
            content:
                `Extract structured data from this credit report text:\n\n---\n${rawText.slice(0, 30000)}\n---`,
        },
    ];

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const resp = await openai.chat.completions.create({
        model,
        messages,
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "credit_report_analysis",
                strict: true,
                schema: schema,
            },
        },
    });

    const content = resp.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error("AI returned empty content");
    }

    return JSON.parse(content) as CreditAnalysis;
}
