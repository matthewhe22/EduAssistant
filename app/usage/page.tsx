import { redirect } from "next/navigation";
import { BudgetForm } from "@/components/BudgetForm";
import { DEFAULT_MODEL } from "@/lib/ai/config";
import { labelFor } from "@/lib/ai/models";
import { getAiSettings } from "@/lib/data/settings";
import { Notice, Page } from "@/components/Page";
import { OUTPUT_UI } from "@/lib/ui/labels";
import { isOutputType } from "@/lib/generator/outputs";
import { pageUser } from "@/lib/auth/page";
import { ratingsByType, recentComments } from "@/lib/data/generations";
import { usageSince } from "@/lib/data/usage";
import { getBudgetStatus } from "@/lib/library/server";
import { dailySpend, feedbackByType, summariseUsage } from "@/lib/library/stats";
import { formatUsd } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const typeLabel = (t: string) => (isOutputType(t) ? OUTPUT_UI[t].label : t);

export default async function UsagePage() {
  const auth = await pageUser("/usage");
  if (!auth) return <Page title="Usage"><Notice tone="info">Usage tracking needs a database. Set DATABASE_URL to enable it.</Notice></Page>;
  const { db, user } = auth;

  const melbourneMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit" }).format(new Date());
  const settings = await getAiSettings(db, user.id);
  const hasKey = Boolean(settings.apiKey ?? process.env.TENON_API_KEY);
  const model = settings.model || DEFAULT_MODEL;
  const [budget, rows, ratings, comments] = await Promise.all([
    getBudgetStatus(db, user.id),
    usageSince(db, user.id, new Date(Date.now() - 31 * 86_400_000)),
    ratingsByType(db, user.id),
    recentComments(db, user.id),
  ]);

  const monthFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit" });
  const month = summariseUsage(rows.filter((r) => monthFmt.format(new Date(r.created_at)) === melbourneMonth));
  const daily = dailySpend(rows, 30);
  const maxDay = Math.max(0.0001, ...daily.map((d) => d.costUsd));
  const feedback = feedbackByType(ratings);
  const pct = budget.budgetUsd ? Math.min(100, (budget.spentUsd / budget.budgetUsd) * 100) : 0;

  return (
    <Page title="Usage and insights">
    <div className="flex flex-col gap-10">
      <p className="card m-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 text-[15px]">
        {hasKey ? <>Generating with <strong>{labelFor(model)}</strong> through Tenon.</> : <strong>No Tenon API key yet.</strong>}
        <a href="/settings" className="font-bold">{hasKey ? "Change model or key in Settings" : "Add your key in Settings"}</a>
      </p>

      <section className="flex flex-col gap-4">
        <h2 className="m-0 text-2xl font-bold">This month</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ["Spend", formatUsd(budget.spentUsd)],
            ["Generations", String(month.generations)],
            ["Refinements", String(month.refinements)],
            ["Input from cache", `${Math.round(month.cachedShare * 100)}%`],
          ].map(([k, v]) => (
            <div key={k} className="card p-5">
              <p className="eyebrow m-0 text-ink-muted">{k}</p>
              <p className="m-0 mt-1 font-display text-3xl font-bold">{v}</p>
            </div>
          ))}
        </div>
        {budget.budgetUsd !== null && (
          <div className="space-y-1">
            <div className="h-2.5 w-full rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-2.5 rounded-full ${budget.exceeded ? "bg-alert" : "bg-euc"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-ink-muted">
              {formatUsd(budget.spentUsd)} of {formatUsd(budget.budgetUsd)}
              {budget.exceeded && " · budget reached: new generations are paused until next month or until you raise it"}
            </p>
          </div>
        )}
        <BudgetForm budgetUsd={budget.budgetUsd} />
        <p className="text-sm text-ink-muted">
          Costs are estimates from Tenon&apos;s published per-token prices (see lib/pricing.ts). Your Tenon dashboard shows the exact amount charged. Months follow Melbourne time.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="m-0 text-2xl font-bold">Last 30 days</h2>
        <div className="flex h-32 items-end gap-1" aria-label="Daily spend chart">
          {daily.map((d) => (
            <div key={d.date} className="flex-1" title={`${d.date}: ${formatUsd(d.costUsd)}`}>
              <div className="w-full rounded-t bg-euc" style={{ height: `${Math.max(d.costUsd > 0 ? 3 : 0, (d.costUsd / maxDay) * 128)}px` }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm text-ink-muted">
          <span>{daily[0]?.date}</span>
          <span>{daily.at(-1)?.date}</span>
        </div>
        {month.byType.length > 0 && (
          <table className="w-full text-[15px]">
            <thead>
              <tr className="eyebrow text-left text-ink-muted">
                <th className="py-1">Type (this month)</th>
                <th>Calls</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {month.byType.map((t) => (
                <tr key={t.outputType} className="border-t border-line">
                  <td className="py-1">{typeLabel(t.outputType)}</td>
                  <td>{t.count}</td>
                  <td>{formatUsd(t.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="m-0 text-2xl font-bold">Feedback</h2>
        {feedback.length === 0 ? (
          <p className="m-0 text-ink-soft">Nothing saved yet.</p>
        ) : (
          <table className="w-full text-[15px]">
            <thead>
              <tr className="eyebrow text-left text-ink-muted">
                <th className="py-1">Type</th>
                <th>Useful</th>
                <th>Not useful</th>
                <th>Not rated</th>
                <th>Approval</th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((f) => (
                <tr key={f.outputType} className="border-t border-line">
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
        {comments.length > 0 && (
          <div className="space-y-2">
            <h3 className="m-0 text-lg font-bold">Recent comments</h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {comments.map((c) => (
                <li key={c.id}>
                  <strong>{c.rating === 1 ? "Useful" : c.rating === -1 ? "Not useful" : "Comment"}:</strong> {c.feedback_comment}{" "}
                  <a className="text-sm text-ink-muted underline" href={`/plans/${c.id}`}>
                    {typeLabel(c.output_type)}: {c.title}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink-muted">
              Recurring &ldquo;not useful&rdquo; themes are worth turning into rules in lib/generator/pedagogy.ts or the type&apos;s instructions in lib/generator/outputs.
            </p>
          </div>
        )}
      </section>
    </div>
    </Page>
  );
}
