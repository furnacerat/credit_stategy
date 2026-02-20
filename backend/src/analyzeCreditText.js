import { openai } from "./openaiClient.js";
const schema = {
    name: "credit_report_analysis",
    schema: {
        type: "object",
        additionalProperties: false,
        properties: {
            summary: {
                type: "object",
                additionalProperties: false,
                properties: {
                    score_estimate: { type: ["number", "null"] },
                    issues_count: { type: "number" },
                    key_findings: { type: "array", items: { type: "string" } }
                },
                required: ["issues_count", "key_findings"]
            },
            negatives: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        type: { type: "string", enum: ["late_payment", "collections", "charge_off", "bankruptcy", "public_record", "other"] },
                        creditor: { type: ["string", "null"] },
                        account_last4: { type: ["string", "null"] },
                        date: { type: ["string", "null"] },
                        notes: { type: ["string", "null"] },
                        severity: { type: "string", enum: ["low", "medium", "high"] }
                    },
                    required: ["type", "severity"]
                }
            },
            utilization: {
                type: "object",
                additionalProperties: false,
                properties: {
                    overall_percent: { type: ["number", "null"] },
                    revolving_accounts: {
                        type: ["array", "null"],
                        items: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                                creditor: { type: ["string", "null"] },
                                account_last4: { type: ["string", "null"] },
                                limit: { type: ["number", "null"] },
                                balance: { type: ["number", "null"] },
                                utilization_percent: { type: ["number", "null"] }
                            }
                        }
                    }
                },
                required: []
            },
            inquiries: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        bureau: { type: "string", enum: ["experian", "equifax", "transunion", "unknown"] },
                        creditor: { type: ["string", "null"] },
                        date: { type: ["string", "null"] }
                    },
                    required: ["bureau"]
                }
            },
            dispute_letters: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        letter_type: { type: "string", enum: ["late_payment", "collection", "charge_off", "inquiry", "identity", "general"] },
                        recipient: { type: "string", enum: ["bureau", "creditor", "collector"] },
                        subject: { type: "string" },
                        bullet_points: { type: "array", items: { type: "string" } }
                    },
                    required: ["letter_type", "recipient", "subject", "bullet_points"]
                }
            }
        },
        required: ["summary", "negatives", "utilization", "inquiries", "dispute_letters"]
    },
    strict: true
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
        response_format: { type: "json_schema", json_schema: schema },
    });
    const text = resp.output_text;
    if (!text) {
        throw new Error("AI returned empty output_text");
    }
    return JSON.parse(text);
}
//# sourceMappingURL=analyzeCreditText.js.map