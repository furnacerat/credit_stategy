import OpenAI from "openai";
function requireEnv(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing env var: ${name}`);
    return v;
}
export const openai = new OpenAI({
    apiKey: requireEnv("OPENAI_API_KEY"),
});
//# sourceMappingURL=openai.js.map