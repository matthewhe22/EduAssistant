import { z } from "zod";
import { requireUser } from "@/lib/library/server";

const BudgetSchema = z.object({ monthlyBudgetUsd: z.number().min(0).max(100000).nullable() });

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const body = BudgetSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Enter a budget of 0 or more, or leave it empty for no limit." }, { status: 400 });
  const { error } = await auth.supabase.from("profiles").update({ monthly_budget_usd: body.data.monthlyBudgetUsd }).eq("id", auth.user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
