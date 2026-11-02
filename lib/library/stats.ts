/** Pure aggregation helpers for the Usage page (easy to test). */

export interface UsageRow {
  kind: string;
  output_type: string;
  cost_usd: number | string;
  input_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  output_tokens: number;
  created_at: string;
}

export interface FeedbackRow {
  output_type: string;
  rating: number | null;
}

export function summariseUsage(rows: UsageRow[]) {
  const byType = new Map<string, { count: number; costUsd: number }>();
  let costUsd = 0;
  let inputTokens = 0;
  let cachedTokens = 0;
  let outputTokens = 0;
  for (const r of rows) {
    const c = Number(r.cost_usd) || 0;
    costUsd += c;
    inputTokens += r.input_tokens + r.cache_write_tokens + r.cache_read_tokens;
    cachedTokens += r.cache_read_tokens;
    outputTokens += r.output_tokens;
    const t = byType.get(r.output_type) ?? { count: 0, costUsd: 0 };
    t.count += 1;
    t.costUsd += c;
    byType.set(r.output_type, t);
  }
  return {
    calls: rows.length,
    generations: rows.filter((r) => r.kind === "generate").length,
    refinements: rows.filter((r) => r.kind === "refine").length,
    costUsd,
    inputTokens,
    cachedShare: inputTokens ? cachedTokens / inputTokens : 0,
    outputTokens,
    byType: [...byType.entries()].map(([outputType, v]) => ({ outputType, ...v })).sort((a, b) => b.costUsd - a.costUsd),
  };
}

/** Spend per day (Melbourne date) for the last `days` days, oldest first, including empty days. */
export function dailySpend(rows: UsageRow[], days: number, now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }); // YYYY-MM-DD
  const totals = new Map<string, number>();
  for (const r of rows) {
    const d = fmt.format(new Date(r.created_at));
    totals.set(d, (totals.get(d) ?? 0) + (Number(r.cost_usd) || 0));
  }
  const out: { date: string; costUsd: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = fmt.format(new Date(now.getTime() - i * 86_400_000));
    out.push({ date: d, costUsd: totals.get(d) ?? 0 });
  }
  return out;
}

export function feedbackByType(rows: FeedbackRow[]) {
  const m = new Map<string, { up: number; down: number; unrated: number }>();
  for (const r of rows) {
    const t = m.get(r.output_type) ?? { up: 0, down: 0, unrated: 0 };
    if (r.rating === 1) t.up += 1;
    else if (r.rating === -1) t.down += 1;
    else t.unrated += 1;
    m.set(r.output_type, t);
  }
  return [...m.entries()].map(([outputType, v]) => ({
    outputType,
    ...v,
    approval: v.up + v.down ? v.up / (v.up + v.down) : null,
  }));
}
