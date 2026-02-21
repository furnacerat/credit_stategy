import { openai } from "./openaiClient.js";

export type CreditAnalysis = {
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
    }>;
    inquiries?: Array<{
        creditor: string;
        date: string;
        bureau: string;
    }>;
    next_best_action: string;
    key_findings?: string[];
};

const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
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
                    impact_points: { type: "integer" }
                },
                required: ["type", "creditor", "date", "severity", "impact_points"]
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
        key_findings: {
            type: "array",
            items: { type: "string" }
        }
    },
    required: ["score_estimate", "issues_count", "next_best_action"]
} as const;

export async function analyzeCreditText(rawText: string): Promise<CreditAnalysis> {
    console.log("[AI] Starting structured analysis with gpt-4o-mini using json_schema...");

    const messages = [
        {
            role: "system" as const,
            content:
                "You extract structured credit-report facts from text. If a field is not present, use null/empty. Do not invent account numbers; if available, only include last4.",
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
