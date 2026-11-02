import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, userForToken, type SessionUser } from "../auth/session";
import { getBudget, monthSpend } from "../data/users";
import { recordUsageEvent } from "../data/usage";
import { getDb, type Db } from "../db";
import type { OutputType } from "../generator/outputs";
import { formatUsd, type TokenUsage } from "../pricing";
import { isOverBudget } from "./settings";

type AuthResult = { ok: false; error: Response } | { ok: true; db: Db; user: SessionUser };

/** For API routes that need a signed-in teacher. */
export async function requireUser(): Promise<AuthResult> {
  const db = getDb();
  if (!db) return { ok: false, error: Response.json({ error: "Saving needs a database (DATABASE_URL)." }, { status: 501 }) };
  const user = await userForToken(db, cookies().get(SESSION_COOKIE)?.value);
  if (!user) return { ok: false, error: Response.json({ error: "Please sign in." }, { status: 401 }) };
  return { ok: true, db, user };
}

/**
 * For generate/refine, which also work without a database (local mode):
 * returns { db: null, user: null } in local mode, an error if a database is configured but nobody is signed in.
 */
export async function optionalUser(): Promise<{ ok: true; db: Db | null; user: SessionUser | null } | { ok: false; error: Response }> {
  const db = getDb();
  if (!db) return { ok: true, db: null, user: null };
  return requireUser();
}

export async function recordUsage(
  db: Db,
  e: { userId: string; generationId: string | null; kind: "generate" | "refine"; outputType: OutputType; model: string; usage: TokenUsage & { costUsd: number } },
) {
  try {
    await recordUsageEvent(db, e);
  } catch (err) {
    console.error("usage log failed", err);
  }
}

export async function getBudgetStatus(db: Db, userId: string) {
  const [spentUsd, budgetUsd] = await Promise.all([monthSpend(db, userId), getBudget(db, userId)]);
  return { spentUsd, budgetUsd, exceeded: isOverBudget(spentUsd, budgetUsd) };
}

/** Returns an error response if this month's budget is used up, otherwise null. */
export async function budgetGuard(db: Db, userId: string): Promise<Response | null> {
  const status = await getBudgetStatus(db, userId);
  if (!status.exceeded) return null;
  return Response.json(
    {
      error: `You've reached your monthly budget of ${formatUsd(status.budgetUsd!)} (spent ${formatUsd(status.spentUsd)} this month). Change it on the Usage page.`,
    },
    { status: 402 },
  );
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
