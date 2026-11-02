import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutputType } from "../generator/outputs";
import { formatUsd, type TokenUsage } from "../pricing";
import { createSupabaseServerClient } from "../supabase/server";
import { isOverBudget } from "./settings";

export async function recordUsage(
  supabase: SupabaseClient,
  e: {
    userId: string;
    generationId: string | null;
    kind: "generate" | "refine";
    outputType: OutputType;
    model: string;
    usage: TokenUsage & { costUsd: number };
  },
) {
  const { error } = await supabase.from("usage_events").insert({
    user_id: e.userId,
    generation_id: e.generationId,
    kind: e.kind,
    output_type: e.outputType,
    model: e.model,
    input_tokens: e.usage.inputTokens,
    cache_write_tokens: e.usage.cacheWriteTokens,
    cache_read_tokens: e.usage.cacheReadTokens,
    output_tokens: e.usage.outputTokens,
    cost_usd: e.usage.costUsd,
  });
  if (error) console.error("usage log failed", error);
}

export async function getBudgetStatus(supabase: SupabaseClient, userId: string) {
  const [{ data: spent }, { data: profile }] = await Promise.all([
    supabase.rpc("month_spend_usd"),
    supabase.from("profiles").select("monthly_budget_usd").eq("id", userId).maybeSingle(),
  ]);
  const spentUsd = Number(spent ?? 0);
  const budgetUsd = profile?.monthly_budget_usd == null ? null : Number(profile.monthly_budget_usd);
  return { spentUsd, budgetUsd, exceeded: isOverBudget(spentUsd, budgetUsd) };
}

/** Returns an error response if this month's budget is used up, otherwise null. */
export async function budgetGuard(supabase: SupabaseClient, userId: string): Promise<Response | null> {
  const status = await getBudgetStatus(supabase, userId);
  if (!status.exceeded) return null;
  return Response.json(
    {
      error: `You've reached your monthly budget of ${formatUsd(status.budgetUsd!)} (spent ${formatUsd(status.spentUsd)} this month). Change it on the Usage page.`,
    },
    { status: 402 },
  );
}


type AuthResult =
  | { ok: false; error: Response }
  | { ok: true; supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>; user: { id: string } };

/** For library API routes: the signed-in teacher, or an error response. */
export async function requireUser(): Promise<AuthResult> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return { ok: false, error: Response.json({ error: "Saving needs Supabase to be configured." }, { status: 501 }) };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: Response.json({ error: "Please sign in." }, { status: 401 }) };
  return { ok: true, supabase, user: data.user };
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
