import { InviteForm, ResendButton, WithdrawButton } from "@/components/admin/Invites";
import { Page } from "@/components/Page";
import { inviteUser, resendInvite, withdrawInvite } from "./actions";
import { adminPage } from "@/lib/auth/admin-page";
import { adminListUsers, adminOverview, adminUsageRows, dailyCalls } from "@/lib/data/admin";
import { listInvitations, type InvitationStatus } from "@/lib/data/invitations";
import { isEmailConfigured } from "@/lib/email/send";
import { formatUsd } from "@/lib/pricing";
import { formatCount, formatDate, formatTokens, timeAgo } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

const STATUS: Record<InvitationStatus, [string, string]> = {
  pending: ["Waiting", "bg-wattle-tint text-wattle-ink"],
  accepted: ["Joined", "bg-euc-tint text-euc-dark"],
  expired: ["Expired", "bg-mist text-ink-soft"],
  revoked: ["Withdrawn", "bg-mist text-ink-soft"],
};

export default async function AdminPage() {
  const { db } = await adminPage("/admin");
  const [overview, users, rows, invitations] = await Promise.all([
    adminOverview(db),
    adminListUsers(db),
    adminUsageRows(db, new Date(Date.now() - 31 * 86_400_000)),
    listInvitations(db),
  ]);
  const daily = dailyCalls(rows, 30);
  const maxCalls = Math.max(1, ...daily.map((d) => d.calls));

  const cards: [string, string, string?][] = [
    ["Users", formatCount(overview.users), `${overview.newUsers7d} new in the last 7 days`],
    ["Active (7 days)", formatCount(overview.activeUsers7d), "made at least one AI request"],
    ["Items made", formatCount(overview.generations), `${overview.generationsThisMonth} this month`],
    ["AI requests this month", formatCount(overview.callsThisMonth)],
    ["Spend this month", formatUsd(overview.spendThisMonth), `${formatUsd(overview.spendAllTime)} all time`],
  ];

  return (
    <Page eyebrow="Super admin" title="All users">
      <div className="flex flex-col gap-10">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Totals">
          {cards.map(([k, v, note]) => (
            <div key={k} className="card p-5">
              <p className="eyebrow m-0 text-ink-muted">{k}</p>
              <p className="m-0 mt-1 font-display text-3xl font-bold">{v}</p>
              {note && <p className="m-0 mt-1 text-sm text-ink-muted">{note}</p>}
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-2xl font-bold">AI requests per day, everyone</h2>
          <div className="flex h-32 items-end gap-1" aria-label="Daily AI requests chart">
            {daily.map((d) => (
              <div key={d.date} className="flex-1" title={`${d.date}: ${d.calls} request${d.calls === 1 ? "" : "s"}, ${formatUsd(d.costUsd)}`}>
                <div className="w-full rounded-t bg-euc" style={{ height: `${Math.max(d.calls > 0 ? 3 : 0, (d.calls / maxCalls) * 128)}px` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-ink-muted">
            <span>{daily[0]?.date}</span>
            <span>{daily.at(-1)?.date}</span>
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="invite-heading">
          <div>
            <h2 id="invite-heading" className="m-0 text-2xl font-bold">Invite people</h2>
            <p className="m-0 mt-1 text-ink-soft">
              Sign-ups are closed to everyone else. An invited person gets an email with a link that lets that address create an account. Links work for 14 days and once only.
            </p>
          </div>
          <InviteForm action={inviteUser} emailReady={isEmailConfigured()} />
          {invitations.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[15px]">
                <thead>
                  <tr className="eyebrow bg-mist text-left text-ink-muted">
                    <th scope="col" className="p-3">Invited</th>
                    <th scope="col" className="p-3">Status</th>
                    <th scope="col" className="p-3">Created</th>
                    <th scope="col" className="p-3">Last emailed</th>
                    <th scope="col" className="p-3">Link expires</th>
                    <th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((i) => {
                    const [label, cls] = STATUS[i.status];
                    const open = i.status === "pending" || i.status === "expired";
                    return (
                      <tr key={i.id} className="border-t border-line align-top">
                        <th scope="row" className="p-3 text-left font-normal">
                          <span className="font-bold">{i.displayName || i.email}</span>
                          {i.displayName && <span className="block text-sm text-ink-muted">{i.email}</span>}
                        </th>
                        <td className="p-3">
                          <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${cls}`}>{label}</span>
                          {i.acceptedAt && <span className="block pt-1 text-sm text-ink-muted">{formatDate(i.acceptedAt)}</span>}
                        </td>
                        <td className="p-3 text-ink-soft">{formatDate(i.createdAt)}</td>
                        <td className="p-3 text-ink-soft">
                          {i.sentAt ? timeAgo(i.sentAt) : "Not emailed"}
                          {i.sendCount > 1 && <span className="block text-sm text-ink-muted">{i.sendCount} times</span>}
                        </td>
                        <td className="p-3 text-ink-soft">{open ? formatDate(i.expiresAt) : "–"}</td>
                        <td className="p-3 text-right">
                          {open && (
                            <span className="flex flex-wrap justify-end gap-1">
                              <ResendButton action={resendInvite} id={i.id} />
                              <WithdrawButton action={withdrawInvite} id={i.id} email={i.email} />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-2xl font-bold">Users</h2>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-[15px]">
              <thead>
                <tr className="eyebrow bg-mist text-left text-ink-muted">
                  <th scope="col" className="p-3">Teacher</th>
                  <th scope="col" className="p-3">Joined</th>
                  <th scope="col" className="p-3">Last active</th>
                  <th scope="col" className="p-3 text-right">Made</th>
                  <th scope="col" className="p-3 text-right">Rewrites</th>
                  <th scope="col" className="p-3 text-right">Tokens in / out</th>
                  <th scope="col" className="p-3 text-right">This month</th>
                  <th scope="col" className="p-3 text-right">All time</th>
                  <th scope="col" className="p-3">AI key</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-line align-top">
                    <th scope="row" className="p-3 text-left font-normal">
                      <a href={`/admin/users/${u.id}`} className="font-bold">{u.displayName || u.email}</a>
                      {u.displayName && <span className="block text-sm text-ink-muted">{u.email}</span>}
                    </th>
                    <td className="p-3 text-ink-soft">{formatDate(u.createdAt)}</td>
                    <td className="p-3 text-ink-soft">{timeAgo(u.lastActive)}</td>
                    <td className="p-3 text-right">{u.libraryItems}</td>
                    <td className="p-3 text-right">{u.refinements}</td>
                    <td className="p-3 text-right text-ink-soft">{formatTokens(u.tokensIn)} / {formatTokens(u.tokensOut)}</td>
                    <td className="p-3 text-right">
                      {formatUsd(u.spendThisMonth)}
                      {u.budgetUsd !== null && <span className="block text-sm text-ink-muted">of {formatUsd(u.budgetUsd)}</span>}
                    </td>
                    <td className="p-3 text-right">{formatUsd(u.spendAllTime)}</td>
                    <td className="p-3 text-sm text-ink-soft">{u.ownKey ? "Own key" : "Server key"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-sm text-ink-muted">
            Spend is an estimate from Tenon&apos;s published prices. When someone uses their own Tenon key, that cost is charged to their key, not yours. You can see what each person made (titles and settings) but not the content of their materials, and never their API keys.
          </p>
        </section>
      </div>
    </Page>
  );
}
