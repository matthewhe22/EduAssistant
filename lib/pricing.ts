/**
 * Estimated Claude API cost in USD. Prices are per million tokens (Anthropic first-party rates,
 * October 2026). Cache writes use the 5-minute TTL rate (1.25 × input).
 * Update this table when prices change: https://platform.claude.com/docs/en/about-claude/pricing
 */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
}

export const PRICES: Record<string, ModelPrice> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
};

const CACHE_WRITE_MULTIPLIER = 1.25;

export interface TokenUsage {
  /** Uncached input tokens. */
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
}

/** Looks up a price by exact model id, then by prefix (e.g. a dated id). Falls back to Opus 5.5. */
export function priceFor(model: string): ModelPrice {
  if (PRICES[model]) return PRICES[model];
  const key = Object.keys(PRICES)
    .sort((a, b) => b.length - a.length)
    .find((k) => model.startsWith(k));
  return PRICES[key ?? "claude-opus-5-5"];
}

export function costUsd(model: string, u: TokenUsage): number {
  const p = priceFor(model);
  const cost =
    (u.inputTokens * p.input + u.cacheWriteTokens * p.input * CACHE_WRITE_MULTIPLIER + u.cacheReadTokens * p.cacheRead + u.outputTokens * p.output) /
    1_000_000;
  return Math.round(cost * 10_000) / 10_000;
}

export function formatUsd(n: number): string {
  return n < 1 ? `US$${n.toFixed(3)}` : `US$${n.toFixed(2)}`;
}
