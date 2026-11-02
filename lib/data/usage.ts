import type { Db } from "../db";
import type { OutputType } from "../generator/outputs";
import type { TokenUsage } from "../pricing";
import type { UsageRow } from "../library/stats";

export async function recordUsageEvent(
  db: Db,
  e: { userId: string; generationId: string | null; kind: "generate" | "refine"; outputType: OutputType; model: string; usage: TokenUsage & { costUsd: number } },
) {
  await db.query(
    `insert into usage_events (user_id, generation_id, kind, output_type, model, input_tokens, cache_write_tokens, cache_read_tokens, output_tokens, cost_usd)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [e.userId, e.generationId, e.kind, e.outputType, e.model, e.usage.inputTokens, e.usage.cacheWriteTokens, e.usage.cacheReadTokens, e.usage.outputTokens, e.usage.costUsd],
  );
}

export async function usageSince(db: Db, userId: string, since: Date): Promise<UsageRow[]> {
  const { rows } = await db.query<UsageRow & { created_at: string | Date }>(
    `select kind, output_type, cost_usd, input_tokens, cache_write_tokens, cache_read_tokens, output_tokens, created_at
     from usage_events where user_id = $1 and created_at >= $2 order by created_at desc limit 5000`,
    [userId, since],
  );
  return rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
}
