import { openai } from "./openaiClient.js";

export type CreditAnalysis = {
    summary: {
        score: number;
        rating: string;
        primary_issues: string[];
    };
    impact_ranking: Array<{
        issue: string;
        priority: number;
        impact_score: number;
        why: string;
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
        }>;
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
    }>;
    inquiries?: Array<{
        creditor: string;
        date: string;
        bureau: string;
    }>;
    next_best_action: string;
    action_plan?: {
        title: string;
        steps: string[];
        expected_impact: string;
    };
    key_findings?: string[];
};

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
                }
            },
            required: ["score", "rating", "primary_issues"]
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
                    why: { type: "string" }
                },
                required: ["issue", "priority", "impact_score", "why"]
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
                            utilization_percent: { type: "integer" }
                        },
                        required: ["creditor", "balance", "limit", "utilization_percent"]
                    }
                }
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
                    }
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
                    bureau: { type: "string" }
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
        key_findings: {
            type: "array",
            items: { type: "string" }
        }
    },
    required: ["summary", "impact_ranking", "score_estimate", "issues_count", "next_best_action", "action_plan"]
} as const;

export async function analyzeCreditText(rawText: string): Promise<CreditAnalysis> {
    console.log("[AI] Starting structured analysis with gpt-4o-mini using json_schema...");

    const messages = [
        {
            role: "system" as const,
            content:
                `You extract structured credit-report facts from text. 
                
                For each negative item, calculate a priority_scoring object using this formula: 
                priorityScore = impact_weight (1-10) × severity_score (1-10) × recency_score (1-10) × confidence_score (0.0-1.0).
                
                - impact_weight: How much this type of item usually affects a score (e.g., Bankruptcy=10, Late Pay=5).
                - severity_score: How bad this specific instance is (e.g., 90 days late=9, 30 days=3).
                - recency_score: Higher if the item is recent (e.g., last 6 months=10, 5 years ago=2).
                - confidence_score: Your level of certainty about the data extraction (0.0 to 1.0).
                
                Also provide a high-level 'summary' with a 'rating' (Very Poor, Poor, Fair, Good, Exceptional) and 'primary_issues'.
                Rank the top 2-3 most impactful issues in 'impact_ranking'.
                Generate a concrete 'action_plan' with high-level 'steps' and an 'expected_impact' (e.g., "+20 to +40 points").
                
                If a field is not present, use null/empty. Do not invent account numbers; if available, only include last4.`,
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
