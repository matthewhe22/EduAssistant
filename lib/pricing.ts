/**
 * Estimated cost in USD from Tenon's published prices (per million tokens), November 2026:
 * https://mytenon.com/pricing. Update this table when prices change.
 * `cached` is the price for cached input; models without one bill cached input at the input rate.
 */
export interface ModelPrice {
  input: number;
  cached?: number;
  output: number;
}

export const PRICES: Record<string, ModelPrice> = {
  "deepseek-v4.1-flash": { input: 0.24, cached: 0.0072, output: 0.72 },
  "deepseek-v4.1-flash-1017": { input: 0.24, cached: 0.0072, output: 0.72 },
  "deepseek-v4-flash-0731": { input: 0.072, cached: 0.018, output: 0.216 },
  "deepseek-v4-pro-0813": { input: 1.56, cached: 0.12, output: 3.12 },
  "claude-opus-5-5": { input: 4.8, cached: 0.24, output: 24 },
  "claude-opus-5": { input: 6, output: 30 },
  "claude-sonnet-5-5": { input: 2.4, output: 12 },
  "claude-sonnet-5": { input: 3.6, output: 18 },
  "claude-haiku-4-5": { input: 1, cached: 0.1, output: 5 },
  "claude-fable-5": { input: 12, output: 60 },
  "gemini-3.7-flash": { input: 0.9, output: 4.5 },
  "gemini-3.5-flash": { input: 1.8, output: 10.8 },
  "gpt-oss-120b-ultra": { input: 0.24, output: 1.14 },
  "qwen3.8-flash": { input: 0.1356, cached: 0.0169, output: 0.4584 },
  "qwen3.8-27b": { input: 0.24, cached: 0.06, output: 3 },
  "glm-5.3": { input: 1.08, cached: 0.24, output: 4.8 },
  "glm-5.3-flash": { input: 0.18, cached: 0.036, output: 0.6 },
  "mimo-v2.6-flash": { input: 0.168, cached: 0.0034, output: 0.336 },
  "mimo-v2.6-pro": { input: 0.516, cached: 0.0043, output: 1.044 },
};

export interface TokenUsage {
  /** Uncached input tokens. */
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  /** Output tokens, including any reasoning tokens. */
  outputTokens: number;
}

/** Exact id first, then the longest known prefix (dated variants). Null when the price is unknown. */
export function priceFor(model: string): ModelPrice | null {
  if (PRICES[model]) return PRICES[model];
  const key = Object.keys(PRICES)
    .sort((a, b) => b.length - a.length)
    .find((k) => model.startsWith(k));
  return key ? PRICES[key] : null;
}

/** Estimated cost; 0 when the model's price isn't in the table. */
export function costUsd(model: string, u: TokenUsage): number {
  const p = priceFor(model);
  if (!p) return 0;
  const cost = ((u.inputTokens + u.cacheWriteTokens) * p.input + u.cacheReadTokens * (p.cached ?? p.input) + u.outputTokens * p.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function formatUsd(n: number): string {
  if (n === 0) return "US$0";
  if (n < 0.01) return `US$${n.toFixed(4)}`;
  if (n < 1) return `US$${n.toFixed(3)}`;
  return `US$${n.toFixed(2)}`;
}
