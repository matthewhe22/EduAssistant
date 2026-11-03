import type { Db } from "../db";
import type { UsageRow } from "../library/stats";

/** Start of the current month in Melbourne time, as a SQL expression. */
const MONTH_START = "(date_trunc('month', now() at time zone 'Australia/Melbourne') at time zone 'Australia/Melbourne')";

export interface AdminOverview {
  users: number;
  newUsers7d: number;
  activeUsers7d: number;
  generations: number;
  generationsThisMonth: number;
  callsThisMonth: number;
  spendThisMonth: number;
  spendAllTime: number;
}

export async function adminOverview(db: Db): Promise<AdminOverview> {
  const { rows } = await db.query<Record<string, string | number | null>>(
    `select
       (select count(*)::int from users) as users,
       (select count(*)::int from users where created_at >= now() - interval '7 days') as new_users_7d,
       (select count(distinct user_id)::int from usage_events where created_at >= now() - interval '7 days') as active_users_7d,
       (select count(*)::int from generations) as generations,
       (select count(*)::int from generations where created_at >= ${MONTH_START}) as generations_month,
       (select count(*)::int from usage_events where created_at >= ${MONTH_START}) as calls_month,
       (select coalesce(sum(cost_usd), 0) from usage_events where created_at >= ${MONTH_START}) as spend_month,
       (select coalesce(sum(cost_usd), 0) from usage_events) as spend_all`,
  );
  const r = rows[0];
  return {
    users: Number(r.users),
    newUsers7d: Number(r.new_users_7d),
    activeUsers7d: Number(r.active_users_7d),
    generations: Number(r.generations),
    generationsThisMonth: Number(r.generations_month),
    callsThisMonth: Number(r.calls_month),
    spendThisMonth: Number(r.spend_month),
    spendAllTime: Number(r.spend_all),
  };
}

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
  lastActive: Date | null;
  generations: number;
  refinements: number;
  libraryItems: number;
  spendThisMonth: number;
  spendAllTime: number;
  tokensIn: number;
  tokensOut: number;
  budgetUsd: number | null;
  ownKey: boolean;
  model: string | null;
}

const USER_SELECT = `
  select u.id, u.email, u.display_name, u.created_at, u.monthly_budget_usd,
    (select count(*)::int from generations g where g.user_id = u.id) as library_items,
    coalesce(e.generations, 0) as generations, coalesce(e.refinements, 0) as refinements,
    coalesce(e.spend_month, 0) as spend_month, coalesce(e.spend_all, 0) as spend_all,
    coalesce(e.tokens_in, 0) as tokens_in, coalesce(e.tokens_out, 0) as tokens_out,
    greatest(e.last_event, (select max(created_at) from sessions s where s.user_id = u.id),
             (select max(created_at) from generations g where g.user_id = u.id)) as last_active,
    (st.api_key_enc is not null) as own_key, st.default_model
  from users u
  left join lateral (
    select count(*) filter (where kind = 'generate')::int as generations,
           count(*) filter (where kind = 'refine')::int as refinements,
           sum(cost_usd) filter (where created_at >= ${MONTH_START}) as spend_month,
           sum(cost_usd) as spend_all,
           sum(input_tokens + cache_write_tokens + cache_read_tokens)::bigint as tokens_in,
           sum(output_tokens)::bigint as tokens_out,
           max(created_at) as last_event
    from usage_events where user_id = u.id
  ) e on true
  left join user_settings st on st.user_id = u.id`;

type Raw = Record<string, unknown>;
const toUser = (r: Raw): AdminUserRow => ({
  id: String(r.id),
  email: String(r.email),
  displayName: (r.display_name as string | null) ?? null,
  createdAt: new Date(r.created_at as string),
  lastActive: r.last_active ? new Date(r.last_active as string) : null,
  generations: Number(r.generations),
  refinements: Number(r.refinements),
  libraryItems: Number(r.library_items),
  spendThisMonth: Number(r.spend_month),
  spendAllTime: Number(r.spend_all),
  tokensIn: Number(r.tokens_in),
  tokensOut: Number(r.tokens_out),
  budgetUsd: r.monthly_budget_usd === null || r.monthly_budget_usd === undefined ? null : Number(r.monthly_budget_usd),
  ownKey: Boolean(r.own_key),
  model: (r.default_model as string | null) ?? null,
});

/** Every account with its totals, most recently active first. */
export async function adminListUsers(db: Db): Promise<AdminUserRow[]> {
  const { rows } = await db.query<Raw>(`${USER_SELECT} order by last_active desc nulls last, u.created_at`);
  return rows.map(toUser);
}

export async function adminGetUser(db: Db, id: string): Promise<AdminUserRow | null> {
  const { rows } = await db.query<Raw>(`${USER_SELECT} where u.id = $1`, [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export interface AdminActivity {
  at: Date;
  kind: "generate" | "refine";
  outputType: string;
  model: string;
  costUsd: number;
  title: string | null;
  subjectSlug: string | null;
  level: string | null;
}

/**
 * One person's recent activity: every AI call with the item it produced. Titles and settings
 * only, never the content of their materials.
 */
export async function adminUserActivity(db: Db, userId: string, limit = 100): Promise<AdminActivity[]> {
  const { rows } = await db.query<Raw>(
    `select e.created_at, e.kind, e.output_type, e.model, e.cost_usd, g.title, g.subject_slug, g.level
     from usage_events e left join generations g on g.id = e.generation_id
     where e.user_id = $1 order by e.created_at desc, e.id desc limit ${Number(limit)}`,
    [userId],
  );
  return rows.map((r) => ({
    at: new Date(r.created_at as string),
    kind: r.kind as "generate" | "refine",
    outputType: String(r.output_type),
    model: String(r.model),
    costUsd: Number(r.cost_usd),
    title: (r.title as string | null) ?? null,
    subjectSlug: (r.subject_slug as string | null) ?? null,
    level: (r.level as string | null) ?? null,
  }));
}

/** Usage rows for charts. userId limits it to one person; omit for everyone. */
export async function adminUsageRows(db: Db, since: Date, userId?: string): Promise<UsageRow[]> {
  const { rows } = await db.query<UsageRow & { created_at: string | Date }>(
    `select kind, output_type, cost_usd, input_tokens, cache_write_tokens, cache_read_tokens, output_tokens, created_at
     from usage_events where created_at >= $1 ${userId ? "and user_id = $2" : ""} order by created_at desc limit 20000`,
    userId ? [since, userId] : [since],
  );
  return rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
}

export interface DailyCalls {
  date: string;
  calls: number;
  costUsd: number;
}

/** Calls and spend per Melbourne day for the last `days` days, oldest first, including empty days. */
export function dailyCalls(rows: UsageRow[], days: number, now = new Date()): DailyCalls[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" });
  const byDay = new Map<string, { calls: number; costUsd: number }>();
  for (const r of rows) {
    const d = fmt.format(new Date(r.created_at));
    const t = byDay.get(d) ?? { calls: 0, costUsd: 0 };
    t.calls += 1;
    t.costUsd += Number(r.cost_usd) || 0;
    byDay.set(d, t);
  }
  const out: DailyCalls[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = fmt.format(new Date(now.getTime() - i * 86_400_000));
    out.push({ date: d, ...(byDay.get(d) ?? { calls: 0, costUsd: 0 }) });
  }
  return out;
}
