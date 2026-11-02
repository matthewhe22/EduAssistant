import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { SYSTEM_PROMPT } from "./pedagogy";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
/** Opus 5.5 defaults to "medium"; set it explicitly. Override with ANTHROPIC_EFFORT. */
const EFFORT = (process.env.ANTHROPIC_EFFORT || "medium") as "low" | "medium" | "high" | "xhigh" | "max";

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  return client;
}

export class GenerationError extends Error {}

export interface GenerationResult<T> {
  content: T;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

export interface GenerateOptions<S extends z.ZodObject> {
  schema: S;
  /** Stable per subject/band/difficulty, so it is cached. */
  curriculumText: string;
  /** Request-specific content (teacher request, optional PDF, refine instructions). */
  requestBlocks: Anthropic.Beta.BetaContentBlockParam[];
  onProgress: (characters: number) => void;
  signal?: AbortSignal;
}

/** Streams structured JSON matching `schema` from Claude. */
export async function generateStructured<S extends z.ZodObject>(opts: GenerateOptions<S>): Promise<GenerationResult<z.infer<S>>> {
  const stream = getClient().beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 64000,
      // Server-side refusal fallback: Anthropic picks the recommended fallback model by category.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT, format: zodOutputFormat(opts.schema) },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: opts.curriculumText, cache_control: { type: "ephemeral" } }, ...opts.requestBlocks],
        },
      ],
    },
    { signal: opts.signal },
  );

  let characters = 0;
  for await (const event of stream) {
    if (event.type === "content_block_start" && event.content_block.type === "fallback") {
      characters = 0; // the fallback model starts the answer again
    }
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      characters += event.delta.text.length;
      opts.onProgress(characters);
    }
  }
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new GenerationError("The request was declined by the model's safety checks. Try rephrasing your idea.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new GenerationError("The output was too long and got cut off. Ask for fewer items or a narrower idea.");
  }

  // If a fallback happened, the answer is the text after the last fallback block.
  const lastFallback = message.content.map((b) => b.type).lastIndexOf("fallback");
  const text = message.content
    .slice(lastFallback + 1)
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GenerationError("The model returned incomplete output. Please try again.");
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    throw new GenerationError("The model returned output in an unexpected format. Please try again.");
  }

  return {
    content: parsed.data as z.infer<S>,
    model: message.model,
    usage: {
      inputTokens: message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0),
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    },
  };
}

export { Anthropic };
