import "server-only";
import { z } from "zod";
import { decisionCopyInstructions, VoiceError, type Evidence, type VoiceProfile } from "./model";

export const configuredModel = () => process.env.RODO_AI_MODEL?.trim() || "";
export const voiceEnabled = () => Boolean(process.env.RODO_OPENAI_API_KEY?.trim() && configuredModel());
export interface GroupProduct { sku: string; facts: Evidence[] }
const paragraph = z.object({
  text: z.string().trim().min(1).max(1800), sources: z.array(z.string()).min(1).max(60),
});
const output = z.object({ products: z.array(z.object({ sku: z.string(), paragraphs: z.array(paragraph).min(1).max(4) })) });
const schema = { type: "object", additionalProperties: false, required: ["products"], properties: {
  products: { type: "array", items: { type: "object", additionalProperties: false, required: ["sku", "paragraphs"],
    properties: { sku: { type: "string" }, paragraphs: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["text", "sources"], properties: { text: { type: "string" }, sources: { type: "array", items: { type: "string" } } } } } } } },
} };

export async function generateGroup(profile: VoiceProfile, products: GroupProduct[], model: string, examples: string[], request: typeof fetch = fetch) {
  const key = process.env.RODO_OPENAI_API_KEY?.trim();
  if (!key || !model) throw new VoiceError("გენერაციის სერვისი გამორთულია.");
  const input = products.map(p => ({ sku: p.sku, facts: p.facts.map((fact, i) => ({ id: p.sku + ":" + (i + 1), ...fact })) }));
  const response = await request("https://api.openai.com/v1/responses", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(600_000),
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ model, store: false, max_output_tokens: 1500 + 1400 * products.length, instructions: decisionCopyInstructions,
      input: JSON.stringify({ profile, approvedStyleExamples: examples, products: input }),
      text: { format: { type: "json_schema", name: "product_group", strict: true, schema } } }),
  });
  if (!response.ok) throw new VoiceError("გენერაციის სერვისმა დააბრუნა შეცდომა (HTTP " + response.status + ").");
  const body = await response.json();
  if (body.status !== "completed" || !Array.isArray(body.output)) throw new VoiceError("მოდელმა ჯგუფის მომზადება ვერ დაასრულა.");
  const content = body.output.filter((x: { type: string }) => x.type === "message")
    .flatMap((x: { content: { type: string; text?: string }[] }) => x.content);
  const raw = content.find((x: { type: string }) => x.type === "output_text")?.text;
  try {
    const result = output.parse(JSON.parse(raw)).products;
    const bySku = new Map(result.map(p => [p.sku, p]));
    if (result.length !== input.length || bySku.size !== input.length) throw Error();
    return new Map(input.map(({ sku, facts }) => {
      const generated = bySku.get(sku);
      if (!generated) throw Error();
      const indices = new Map(facts.map((fact, i) => [fact.id, i + 1]));
      return [sku, generated.paragraphs.map(p => ({ text: p.text, sources: p.sources.map(source => {
        const id = indices.get(source);
        if (!id) throw Error();
        return id;
      }) }))];
    }));
  } catch {
    throw new VoiceError("ჯგუფის პასუხი არასრულია ან აბზაცს სხვა პროდუქტის წყარო აქვს მითითებული.");
  }
}
