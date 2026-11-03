import { notFound } from "next/navigation";
import { Page } from "@/components/Page";
import { adminPage } from "@/lib/auth/admin-page";
import { labelFor } from "@/lib/ai/models";
import { getCurriculumIndex } from "@/lib/curriculum";
import { adminGetUser, adminUsageRows, adminUserActivity, dailyCalls } from "@/lib/data/admin";
import { isUuid } from "@/lib/library/server";
import { isOutputType } from "@/lib/generator/outputs";
import { formatUsd } from "@/lib/pricing";
import { formatCount, formatDate, formatDateTime, formatTokens, timeAgo } from "@/lib/ui/format";
import { OUTPUT_UI, YEAR_LABELS } from "@/lib/ui/labels";
import type { PrimaryLevel } from "@/lib/curriculum/types";

export const dynamic = "force-dynamic";

export default async function AdminUserPage({ params }: { params: { id: string } }) {
  const { db } = await adminPage(`/admin/users/${params.id}`);
  if (!isUuid(params.id)) notFound();
  const user = await adminGetUser(db, params.id);
  if (!user) notFound();
  const [activity, rows, index] = await Promise.all([
    adminUserActivity(db, user.id),
    adminUsageRows(db, new Date(Date.now() - 31 * 86_400_000), user.id),
    getCurriculumIndex(),
  ]);
  const subjectName = new Map(index?.subjects.map((s) => [s.slug, s.subject]) ?? []);
  const daily = dailyCalls(rows, 30);
  const maxCalls = Math.max(1, ...daily.map((d) => d.calls));
  const typeLabel = (t: string) => (isOutputType(t) ? OUTPUT_UI[t].label : t);

  const stats: [string, string, string?][] = [
    ["Items made", formatCount(user.libraryItems)],
    ["Rewrites", formatCount(user.refinements)],
    ["Spend this month", formatUsd(user.spendThisMonth), user.budgetUsd !== null ? `budget ${formatUsd(user.budgetUsd)}` : "no budget set"],
    ["Spend all time", formatUsd(user.spendAllTime), `${formatTokens(user.tokensIn)} in · ${formatTokens(user.tokensOut)} out`],
  ];

  return (
    <Page
      eyebrow="Super admin"
      title={user.displayName || user.email}
      actions={<a href="/admin" className="btn-outline">All users</a>}
    >
      <div className="flex flex-col gap-10">
        <p className="m-0 text-ink-soft">
          {user.email} · joined {formatDate(user.createdAt)} · last active {timeAgo(user.lastActive)} ·{" "}
          {user.ownKey ? "own Tenon key" : "server Tenon key"}
          {user.model && <> · model {labelFor(user.model)}</>}
        </p>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals">
          {stats.map(([k, v, note]) => (
            <div key={k} className="card p-5">
              <p className="eyebrow m-0 text-ink-muted">{k}</p>
              <p className="m-0 mt-1 font-display text-3xl font-bold">{v}</p>
              {note && <p className="m-0 mt-1 text-sm text-ink-muted">{note}</p>}
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-2xl font-bold">AI requests per day</h2>
          <div className="flex h-28 items-end gap-1" aria-label="Daily AI requests chart">
            {daily.map((d) => (
              <div key={d.date} className="flex-1" title={`${d.date}: ${d.calls} request${d.calls === 1 ? "" : "s"}, ${formatUsd(d.costUsd)}`}>
                <div className="w-full rounded-t bg-euc" style={{ height: `${Math.max(d.calls > 0 ? 3 : 0, (d.calls / maxCalls) * 112)}px` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-ink-muted">
            <span>{daily[0]?.date}</span>
            <span>{daily.at(-1)?.date}</span>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-2xl font-bold">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="m-0 text-ink-soft">No AI requests yet.</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-[15px]">
                <thead>
                  <tr className="eyebrow bg-mist text-left text-ink-muted">
                    <th scope="col" className="p-3">When (Melbourne)</th>
                    <th scope="col" className="p-3">What</th>
                    <th scope="col" className="p-3">Title</th>
                    <th scope="col" className="p-3">Class</th>
                    <th scope="col" className="p-3">Model</th>
                    <th scope="col" className="p-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a, i) => (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="whitespace-nowrap p-3 text-ink-soft">{formatDateTime(a.at)}</td>
                      <td className="p-3">
                        {a.kind === "refine" ? "Rewrote part of a " : "Made a "}
                        {typeLabel(a.outputType).toLowerCase()}
                      </td>
                      <td className="p-3">{a.title ?? <span className="text-ink-muted">deleted</span>}</td>
                      <td className="p-3 text-ink-soft">
                        {a.level ? YEAR_LABELS[a.level as PrimaryLevel] ?? a.level : ""}
                        {a.subjectSlug && ` · ${subjectName.get(a.subjectSlug) ?? a.subjectSlug}`}
                      </td>
                      <td className="p-3 text-ink-soft">{labelFor(a.model)}</td>
                      <td className="p-3 text-right">{formatUsd(a.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="m-0 text-sm text-ink-muted">Shows the latest 100 requests: titles and settings only, not the content of their materials.</p>
        </section>
      </div>
    </Page>
  );
}
