import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { TENON_BASE_URL, type AiConfig } from "../ai/config";
import { costUsd, type TokenUsage } from "../pricing";
import { SYSTEM_PROMPT } from "./pedagogy";

/**
 * Structured generation through Tenon's OpenAI-compatible Chat Completions endpoint, so any
 * model Tenon serves (DeepSeek, Claude, Gemini, Qwen…) works with one code path.
 * The output schema is given in the prompt, JSON mode is requested where supported, and the
 * answer is validated with zod; one repair attempt is made if it doesn't validate.
 */

export class GenerationError extends Error {}

export interface GenerationResult<T> {
  content: T;
  model: string;
  usage: TokenUsage & { costUsd: number };
}

export interface GenerateOptions<S extends z.ZodObject> {
  schema: S;
  ai: AiConfig;
  /** Stable per subject/band/difficulty: placed first so providers can reuse their prompt cache. */
  curriculumText: string;
  /** Request-specific text (teacher request, uploaded plan, refine instructions). */
  requestText: string;
  onProgress: (characters: number) => void;
  signal?: AbortSignal;
}

const MAX_OUTPUT_TOKENS = 32_000;

/** Claude models on Tenon don't accept OpenAI JSON mode; the schema instruction is enough there. */
const supportsJsonMode = (model: string) => !/^claude/i.test(model);

const schemaCache = new WeakMap<z.ZodObject, string>();
function schemaText(schema: z.ZodObject) {
  let s = schemaCache.get(schema);
  if (!s) {
    s = JSON.stringify(z.toJSONSchema(schema));
    schemaCache.set(schema, s);
  }
  return s;
}

export function systemMessage(schema: z.ZodObject) {
  return `${SYSTEM_PROMPT}

Output format: reply with ONE JSON object and nothing else (no prose, no Markdown, no code fences). It must match this JSON Schema exactly, including every required field; use empty strings or empty arrays rather than leaving fields out:
${schemaText(schema)}`;
}

/** Pulls the JSON object out of a reply, tolerating code fences or stray text around it. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("No JSON object in the reply");
  }
}

type RawUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number } | null;
  prompt_cache_hit_tokens?: number;
};

/** Maps OpenAI-style usage (and DeepSeek's cache fields) to our token counts. */
export function mapUsage(u: RawUsage | null | undefined): TokenUsage {
  const prompt = u?.prompt_tokens ?? 0;
  const cached = Math.min(prompt, u?.prompt_tokens_details?.cached_tokens ?? u?.prompt_cache_hit_tokens ?? 0);
  return { inputTokens: prompt - cached, cacheWriteTokens: 0, cacheReadTokens: cached, outputTokens: u?.completion_tokens ?? 0 };
}

const addUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
  outputTokens: a.outputTokens + b.outputTokens,
});

export function makeClient(ai: AiConfig) {
  return new OpenAI({ apiKey: ai.apiKey, baseURL: TENON_BASE_URL, maxRetries: 2, timeout: 290_000 });
}

export async function generateStructured<S extends z.ZodObject>(opts: GenerateOptions<S>): Promise<GenerationResult<z.infer<S>>> {
  const client = makeClient(opts.ai);
  const model = opts.ai.model;
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemMessage(opts.schema) },
    { role: "user", content: `${opts.curriculumText}\n\n---\n\n${opts.requestText}` },
  ];
  const jsonMode = supportsJsonMode(model) ? { response_format: { type: "json_object" as const } } : {};

  const stream = await client.chat.completions.create(
    { model, messages, max_tokens: MAX_OUTPUT_TOKENS, stream: true, stream_options: { include_usage: true }, ...jsonMode },
    { signal: opts.signal },
  );

  let text = "";
  let finish: string | null = null;
  let usage = mapUsage(null);
  let servedModel = model;
  for await (const chunk of stream) {
    if (chunk.model) servedModel = chunk.model;
    if (chunk.usage) usage = mapUsage(chunk.usage as RawUsage);
    const choice = chunk.choices?.[0];
    if (!choice) continue;
    if (choice.delta?.content) {
      text += choice.delta.content;
      opts.onProgress(text.length);
    }
    if (choice.finish_reason) finish = choice.finish_reason;
  }

  if (finish === "length") throw new GenerationError("The output was too long and got cut off. Ask for fewer items or a narrower idea.");
  if (finish === "content_filter") throw new GenerationError("The request was declined by the model's safety filter. Try rephrasing your idea.");

  let parsed = tryParse(opts.schema, text);
  if (!parsed.ok) {
    // One repair attempt: show the model its reply and what was wrong with it.
    const repair = await client.chat.completions.create(
      {
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        ...jsonMode,
        messages: [
          ...messages,
          { role: "assistant", content: text.slice(0, 200_000) },
          {
            role: "user",
            content: `That reply was not a valid JSON object for the schema (${parsed.error}). Reply again with only the corrected, complete JSON object.`,
          },
        ],
      },
      { signal: opts.signal },
    );
    usage = addUsage(usage, mapUsage(repair.usage as RawUsage));
    parsed = tryParse(opts.schema, repair.choices[0]?.message?.content ?? "");
    if (!parsed.ok) throw new GenerationError("The model returned output in an unexpected format. Please try again, or choose another model on the Usage page.");
  }

  return { content: parsed.value, model: servedModel, usage: { ...usage, costUsd: costUsd(servedModel, usage) } };
}

function tryParse<S extends z.ZodObject>(schema: S, text: string): { ok: true; value: z.infer<S> } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = extractJson(text);
  } catch {
    return { ok: false, error: text.trim() ? "it was not valid JSON" : "it was empty" };
  }
  const result = schema.safeParse(json);
  if (result.success) return { ok: true, value: result.data as z.infer<S> };
  const issues = result.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  return { ok: false, error: issues.join("; ") };
}

/** Lists the models this key can use (GET /v1/models). Returns null if the call fails. */
export async function listModelIds(apiKey: string): Promise<string[] | null> {
  try {
    const client = new OpenAI({ apiKey, baseURL: TENON_BASE_URL, maxRetries: 0, timeout: 15_000 });
    const ids: string[] = [];
    for await (const m of client.models.list()) ids.push(m.id);
    return ids;
  } catch {
    return null;
  }
}

/** Checks that a key works: 401/403 means it doesn't; other failures are reported as unknown. */
export async function checkApiKey(apiKey: string): Promise<"ok" | "invalid" | "unreachable"> {
  try {
    const client = new OpenAI({ apiKey, baseURL: TENON_BASE_URL, maxRetries: 0, timeout: 15_000 });
    await client.models.list();
    return "ok";
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError || err instanceof OpenAI.PermissionDeniedError) return "invalid";
    return "unreachable";
  }
}

export { OpenAI };
