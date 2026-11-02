import type { Db } from "../db";

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export async function findUserByEmail(db: Db, email: string) {
  const { rows } = await db.query<{ id: string; email: string; password_hash: string }>(
    "select id, email, password_hash from users where lower(email) = $1",
    [normaliseEmail(email)],
  );
  return rows[0] ?? null;
}

export async function createUser(db: Db, u: { email: string; passwordHash: string; displayName?: string }) {
  const { rows } = await db.query<{ id: string }>(
    "insert into users (email, password_hash, display_name) values ($1, $2, $3) returning id",
    [normaliseEmail(u.email), u.passwordHash, u.displayName?.trim() || null],
  );
  return rows[0].id;
}

/**
 * Sign-ups are closed except for: the very first account, and emails listed in
 * ALLOWED_EMAILS (comma-separated). This stops strangers using your Anthropic credit.
 */
export async function canSignUp(db: Db, email: string, allowedEmails = process.env.ALLOWED_EMAILS ?? "") {
  const allowed = allowedEmails
    .split(",")
    .map((e) => normaliseEmail(e))
    .filter(Boolean);
  if (allowed.includes(normaliseEmail(email))) return true;
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from users");
  return rows[0].n === 0;
}

export async function getBudget(db: Db, userId: string): Promise<number | null> {
  const { rows } = await db.query<{ monthly_budget_usd: string | null }>("select monthly_budget_usd from users where id = $1", [userId]);
  const v = rows[0]?.monthly_budget_usd;
  return v === null || v === undefined ? null : Number(v);
}

export async function setBudget(db: Db, userId: string, budget: number | null) {
  await db.query("update users set monthly_budget_usd = $2, updated_at = now() where id = $1", [userId, budget]);
}

/** Spend since the start of the current month in Melbourne time. */
export async function monthSpend(db: Db, userId: string): Promise<number> {
  const { rows } = await db.query<{ s: string }>(
    `select coalesce(sum(cost_usd), 0) as s from usage_events
     where user_id = $1 and created_at >= (date_trunc('month', now() at time zone 'Australia/Melbourne') at time zone 'Australia/Melbourne')`,
    [userId],
  );
  return Number(rows[0].s);
}
