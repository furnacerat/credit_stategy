import { openai } from "./openaiClient.js";

export type Evidence = {
    text: string;
    page_number?: number;
};

export type CreditAnalysis = {
    summary: {
        score: number;
        rating: string;
        primary_issues: string[];
        top_score_killers: Array<{
            label: string;
            impact: string; // e.g. "19 instances" or "38%"
        }>;
        projected_score_range: string; // e.g. "620–660"
        provider?: string; // e.g. "Experian"
        report_date?: string; // e.g. "Feb 2, 2026"
        completeness_percentage: number; // 0-100
        evidence?: Evidence;
    };
    impact_ranking: Array<{
        issue: string;
        priority: number;
        impact_score: number;
        severity: "CRITICAL" | "HIGH" | "MEDIUM";
        details: string[]; // e.g. ["Affects 35% of score", "Last late: Dec 2025"]
        why: string;
        evidence?: Evidence;
    }>;
    score_estimate: number;
    issues_count: number;
    utilization?: {
        overall_percent: number;
        revolving_accounts: Array<{
            creditor: string;
            balance: string;
            limit: string;
            utilization_percent: number;
            evidence?: Evidence;
        }>;
        evidence?: Evidence;
    };
    negatives?: Array<{
        type: string;
        creditor: string;
        date: string;
        severity: string;
        impact_points: number;
        priority_scoring: {
            impact_weight: number;    // 1-10
            severity_score: number;  // 1-10
            recency_score: number;   // 1-10 (higher if recent)
            confidence_score: number; // 0.0-1.0
            total_priority: number;  // Result of impactWeight × severity × recency × confidence
        }
        evidence?: Evidence;
    }>;
    inquiries?: Array<{
        creditor: string;
        date: string;
        bureau: string;
        evidence?: Evidence;
    }>;
    next_best_action: string;
    action_plan?: {
        title: string;
        steps: string[];
        expected_impact: string;
    };
    most_important_action?: {
        action: string;
        payment_amount?: string;
        target_utilization?: string;
        expected_boost: string;
        timeline: string;
    };
    quality: {
        missing_fields: string[];
        warnings: string[];
    };
    key_findings?: string[];
};

const evidenceSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        text: { type: "string" },
        page_number: { type: "integer" }
    },
    required: ["text"]
} as const;

const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
        summary: {
            type: "object",
            additionalProperties: false,
            properties: {
                score: { type: "integer" },
                rating: { type: "string" },
                primary_issues: {
                    type: "array",
                    items: { type: "string" }
                },
                top_score_killers: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            label: { type: "string" },
                            impact: { type: "string" }
                        },
                        required: ["label", "impact"]
                    }
                },
                projected_score_range: { type: "string" },
                provider: { type: "string" },
                report_date: { type: "string" },
                completeness_percentage: { type: "integer" },
                evidence: evidenceSchema
            },
            required: ["score", "rating", "primary_issues", "top_score_killers", "projected_score_range", "completeness_percentage"]
        },
        impact_ranking: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    issue: { type: "string" },
                    priority: { type: "integer" },
                    impact_score: { type: "integer" },
                    severity: { enum: ["CRITICAL", "HIGH", "MEDIUM"] },
                    details: {
                        type: "array",
                        items: { type: "string" }
                    },
                    why: { type: "string" },
                    evidence: evidenceSchema
                },
                required: ["issue", "priority", "impact_score", "severity", "details", "why"]
            }
        },
        score_estimate: { type: "integer" },
        issues_count: { type: "integer" },
        utilization: {
            type: "object",
            additionalProperties: false,
            properties: {
                overall_percent: { type: "integer" },
                revolving_accounts: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            creditor: { type: "string" },
                            balance: { type: "string" },
                            limit: { type: "string" },
                            utilization_percent: { type: "integer" },
                            evidence: evidenceSchema
                        },
                        required: ["creditor", "balance", "limit", "utilization_percent"]
                    }
                },
                evidence: evidenceSchema
            },
            required: ["overall_percent", "revolving_accounts"]
        },
        negatives: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    type: { type: "string" },
                    creditor: { type: "string" },
                    date: { type: "string" },
                    severity: { type: "string" },
                    impact_points: { type: "integer" },
                    priority_scoring: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            impact_weight: { type: "integer" },
                            severity_score: { type: "integer" },
                            recency_score: { type: "integer" },
                            confidence_score: { type: "number" },
                            total_priority: { type: "number" }
                        },
                        required: ["impact_weight", "severity_score", "recency_score", "confidence_score", "total_priority"]
                    },
                    evidence: evidenceSchema
                },
                required: ["type", "creditor", "date", "severity", "impact_points", "priority_scoring"]
            }
        },
        inquiries: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    creditor: { type: "string" },
                    date: { type: "string" },
                    bureau: { type: "string" },
                    evidence: evidenceSchema
                },
                required: ["creditor", "date", "bureau"]
            }
        },
        next_best_action: { type: "string" },
        action_plan: {
            type: "object",
            additionalProperties: false,
            properties: {
                title: { type: "string" },
                steps: {
                    type: "array",
                    items: { type: "string" }
                },
                expected_impact: { type: "string" }
            },
            required: ["title", "steps", "expected_impact"]
        },
        most_important_action: {
            type: "object",
            additionalProperties: false,
            properties: {
                action: { type: "string" },
                payment_amount: { type: "string" },
                target_utilization: { type: "string" },
                expected_boost: { type: "string" },
                timeline: { type: "string" }
            },
            required: ["action", "expected_boost", "timeline"]
        },
        quality: {
            type: "object",
            additionalProperties: false,
            properties: {
                missing_fields: {
                    type: "array",
                    items: { type: "string" }
                },
                warnings: {
                    type: "array",
                    items: { type: "string" }
                }
            },
            required: ["missing_fields", "warnings"]
        },
        key_findings: {
            type: "array",
            items: { type: "string" }
        }
    },
    required: ["summary", "impact_ranking", "score_estimate", "issues_count", "next_best_action", "action_plan", "quality"]
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
                - Do NOT guess. If a value is not present, use null and add an item to quality.missing_fields.
                - Every metric shown to the user MUST include evidence: a short snippet from the source text and an optional page_number if available.
                - Prefer numbers over adjectives. Convert $ and % to numeric values.
                - If you see contradictory values, choose the value that appears in the “At a glance” or “Account summary” area and record a warning in quality.warnings.
                - Never output >100% utilization.
                - Do not include PII (full SSN, full account numbers, DOB, full address). Redact with "***" if it appears in evidence snippets.
                - Compute derived fields when inputs exist (e.g., overallUtilizationPct = creditUsed / creditLimit * 100).
                
                Scoring Logic:
                For each negative item, calculate a priority_scoring object using this formula: 
                priorityScore = impact_weight (1-10) × severity_score (1-10) × recency_score (1-10) × confidence_score (0.0-1.0).
                - impact_weight: How much this type of item usually affects a score (e.g., Bankruptcy=10, Late Pay=5).
                - severity_score: How bad this specific instance is (e.g., 90 days late=9, 30 days=3).
                - recency_score: Higher if the item is recent (e.g., last 6 months=10, 5 years ago=2).
                - confidence_score: Your level of certainty about the data extraction (0.0 to 1.0).
                
                Categorization:
                - Categorize 'impact_ranking' issues by 'severity' (CRITICAL, HIGH, MEDIUM).
                - Provide 1-2 'details' bullets per impact item.
                - Provide a ranked “impact_ranking” list with priority 1..N (1 is highest priority) based on severity, recency, and known scoring impact (payment history > utilization > derogatories > inquiries > age/mix).

                Summary & Actions:
                - Identify the bureau (Experian, Equifax, TransUnion, or Generic) and report date.
                - Calculate completeness_percentage based on data density.
                - Identify the SINGLE most urgent task as 'most_important_action'. Be specific with dollar amounts if possible.`,
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
