import { openai } from "./openaiClient.js";
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
};
export async function analyzeCreditText(rawText) {
    console.log("[AI] Starting structured analysis with gpt-4o-mini using responses API...");
    const input = [
        {
            role: "system",
            content: "You extract structured credit-report facts from text. If a field is not present, use null/empty. Do not invent account numbers; if available, only include last4.",
        },
        {
            role: "user",
            content: `Extract structured data from this credit report text:\n\n---\n${rawText.slice(0, 30000)}\n---`,
        },
    ];
    // Using the user-preferred openai.responses API
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const resp = await openai.responses.create({
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
    return JSON.parse(text);
}
//# sourceMappingURL=analyzeCreditText.js.map