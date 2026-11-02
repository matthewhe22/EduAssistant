import { redirect } from "next/navigation";
import { BudgetForm } from "@/components/BudgetForm";
import { OUTPUTS, isOutputType } from "@/lib/generator/outputs";
import { MODEL } from "@/lib/generator/claude";
import { getBudgetStatus } from "@/lib/library/server";
import { dailySpend, feedbackByType, summariseUsage, type UsageRow } from "@/lib/library/stats";
import { formatUsd } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const typeLabel = (t: string) => (isOutputType(t) ? OUTPUTS[t].label : t);

export default async function UsagePage() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return <p className="text-sm">Usage tracking needs Supabase. Set the Supabase env vars to enable it.</p>;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/usage");

  const since = new Date(Date.now() - 31 * 86_400_000).toISOString();
  const melbourneMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit" }).format(new Date());
  const [budget, { data: events }, { data: ratings }, { data: comments }] = await Promise.all([
    getBudgetStatus(supabase, auth.user.id),
    supabase
      .from("usage_events")
      .select("kind, output_type, cost_usd, input_tokens, cache_write_tokens, cache_read_tokens, output_tokens, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("generations").select("output_type, rating").limit(5000),
    supabase
      .from("generations")
      .select("id, title, output_type, rating, feedback_comment, rated_at")
      .not("feedback_comment", "is", null)
      .order("rated_at", { ascending: false })
      .limit(15),
  ]);

  const rows = (events ?? []) as UsageRow[];
  const monthFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit" });
  const month = summariseUsage(rows.filter((r) => monthFmt.format(new Date(r.created_at)) === melbourneMonth));
  const daily = dailySpend(rows, 30);
  const maxDay = Math.max(0.0001, ...daily.map((d) => d.costUsd));
  const feedback = feedbackByType(ratings ?? []);
  const pct = budget.budgetUsd ? Math.min(100, (budget.spentUsd / budget.budgetUsd) * 100) : 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Usage and insights</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">This month</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ["Spend", formatUsd(budget.spentUsd)],
            ["Generations", String(month.generations)],
            ["Refinements", String(month.refinements)],
            ["Input from cache", `${Math.round(month.cachedShare * 100)}%`],
          ].map(([k, v]) => (
            <div key={k} className="rounded border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs uppercase text-slate-500">{k}</p>
              <p className="text-2xl font-semibold">{v}</p>
            </div>
          ))}
        </div>
        {budget.budgetUsd !== null && (
          <div className="space-y-1">
            <div className="h-2 w-full rounded bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-2 rounded ${budget.exceeded ? "bg-red-600" : "bg-slate-900 dark:bg-white"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-slate-500">
              {formatUsd(budget.spentUsd)} of {formatUsd(budget.budgetUsd)}
              {budget.exceeded && " · budget reached: new generations are paused until next month or until you raise it"}
            </p>
          </div>
        )}
        <BudgetForm budgetUsd={budget.budgetUsd} />
        <p className="text-xs text-slate-500">
          Costs are estimates from Anthropic&apos;s published per-token prices for {MODEL} (see lib/pricing.ts). Your Anthropic Console shows the exact bill. Months follow Melbourne time.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Last 30 days</h2>
        <div className="flex h-32 items-end gap-1" aria-label="Daily spend chart">
          {daily.map((d) => (
            <div key={d.date} className="flex-1" title={`${d.date}: ${formatUsd(d.costUsd)}`}>
              <div className="w-full rounded-t bg-slate-400 dark:bg-slate-500" style={{ height: `${Math.max(d.costUsd > 0 ? 3 : 0, (d.costUsd / maxDay) * 128)}px` }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>{daily[0]?.date}</span>
          <span>{daily.at(-1)?.date}</span>
        </div>
        {month.byType.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">Type (this month)</th>
                <th>Calls</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {month.byType.map((t) => (
                <tr key={t.outputType} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-1">{typeLabel(t.outputType)}</td>
                  <td>{t.count}</td>
                  <td>{formatUsd(t.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Feedback</h2>
        {feedback.length === 0 ? (
          <p className="text-sm text-slate-600">Nothing saved yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">Type</th>
                <th>👍</th>
                <th>👎</th>
                <th>Not rated</th>
                <th>Approval</th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((f) => (
                <tr key={f.outputType} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-1">
                    <a className="underline" href={`/plans?type=${f.outputType}`}>{typeLabel(f.outputType)}</a>
                  </td>
                  <td>{f.up}</td>
                  <td>
                    {f.down > 0 ? <a className="underline" href={`/plans?type=${f.outputType}&rating=down`}>{f.down}</a> : 0}
                  </td>
                  <td>{f.unrated}</td>
                  <td>{f.approval === null ? "–" : `${Math.round(f.approval * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {comments && comments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Recent comments</h3>
            <ul className="space-y-2 text-sm">
              {comments.map((c) => (
                <li key={c.id}>
                  {c.rating === 1 ? "👍" : c.rating === -1 ? "👎" : "💬"} {c.feedback_comment}{" "}
                  <a className="text-xs text-slate-500 underline" href={`/plans/${c.id}`}>
                    {typeLabel(c.output_type)}: {c.title}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">
              Recurring 👎 themes are worth turning into rules in lib/generator/pedagogy.ts or the type&apos;s instructions in lib/generator/outputs.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
