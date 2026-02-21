import { openai } from "./openaiClient.js";

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

const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
        score_estimate: { type: "integer" },
        issues_count: { type: "integer" },
        top_issues: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    type: { type: "string" },
                    severity: { type: "string" },
                    impact_points: { type: "integer" }
                },
                required: ["type", "severity", "impact_points"]
            }
        },
        next_best_action: { type: "string" }
    },
    required: ["score_estimate", "issues_count", "top_issues", "next_best_action"]
} as const;

export async function analyzeCreditText(rawText: string): Promise<CreditAnalysis> {
    console.log("[AI] Starting structured analysis with gpt-4o-mini using responses API...");

    const input = [
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

    // Using the user-preferred openai.responses API
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await (openai as unknown as { responses: any }).responses.create({
        model,
        input,
        text: {
            format: {
                type: "json_schema",
                name: "credit_report_analysis",
                strict: true,
                schema: schema,
            }
        },
    });

    const text = resp.output_text;
    if (!text) {
        throw new Error("AI returned empty output_text");
    }

    return JSON.parse(text) as CreditAnalysis;
}
