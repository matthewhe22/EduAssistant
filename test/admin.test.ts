import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/* In-memory cookie jar standing in for next/headers. */
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { adminEmails, isAdminEmail } from "@/lib/auth/admin";
import { adminGetUser, adminListUsers, adminOverview, adminUsageRows, adminUserActivity, dailyCalls } from "@/lib/data/admin";
import { formatTokens, timeAgo } from "@/lib/ui/format";
import { migrate } from "../scripts/db/migrate.mjs";
import { setDbForTesting, type Db } from "@/lib/db";
import { adminPage } from "@/lib/auth/admin-page";
import { createSession } from "@/lib/auth/session";

const pg = new PGlite();
const db: Db = {
  query: async (text: string, params?: unknown[]) =>
    (params?.length ? pg.query(text, params) : (await pg.exec(text)).at(-1) ?? { rows: [] }) as never,
};
let admin = "";
let teacher = "";
let quiet = "";
let genId = "";

const event = (user: string, gen: string | null, kind: string, type: string, cost: number, ageDays = 0) =>
  db.query(
    `insert into usage_events (user_id, generation_id, kind, output_type, model, input_tokens, cache_read_tokens, output_tokens, cost_usd, created_at)
     values ($1, $2, $3, $4::output_type, 'deepseek-v4.1-flash', 1000, 500, 2000, $5, now() - ($6 || ' days')::interval)`,
    [user, gen, kind, type, cost, String(ageDays)],
  );

beforeAll(async () => {
  await migrate(db, () => {});
  const u = async (email: string, name: string | null) =>
    (await db.query<{ id: string }>("insert into users (email, password_hash, display_name) values ($1, 'x', $2) returning id", [email, name])).rows[0].id;
  admin = await u("matthew.he@outlook.com", null);
  teacher = await u("teacher@school.vic.edu.au", "Sam Teacher");
  quiet = await u("quiet@school.vic.edu.au", null);
  genId = (
    await db.query<{ id: string }>(
      `insert into generations (user_id, title, level, subject_slug, output_type, difficulty, teacher_input, curriculum_codes, content, model)
       values ($1, 'Fractions with strips', '3', 'mathematics', 'lesson_plan', 'at', '{"idea":"SECRET IDEA"}', '{}', '{"output":{"overview":"SECRET CONTENT"}}', 'deepseek-v4.1-flash') returning id`,
      [teacher],
    )
  ).rows[0].id;
  await event(teacher, genId, "generate", "lesson_plan", 0.01);
  await event(teacher, genId, "refine", "lesson_plan", 0.005, 1);
  await event(teacher, null, "generate", "worksheet", 0.02, 40); // older than this month
  await db.query("update users set monthly_budget_usd = 5 where id = $1", [teacher]);
  await db.query("insert into user_settings (user_id, api_key_enc, api_key_hint, default_model) values ($1, 'v1.SECRETKEY', '…1234', 'claude-sonnet-5-5')", [teacher]);
  await db.query("insert into sessions (token_hash, user_id, expires_at) values ('h', $1, now() + interval '1 day')", [admin]);
});
afterAll(() => pg.close());

describe("super admin", () => {
  it("is matthew.he@outlook.com by default, whatever the capitalisation", () => {
    expect(adminEmails(undefined)).toEqual(["matthew.he@outlook.com"]);
    expect(isAdminEmail("Matthew.He@Outlook.com ", undefined)).toBe(true);
    expect(isAdminEmail("teacher@school.vic.edu.au", undefined)).toBe(false);
    expect(isAdminEmail("", undefined)).toBe(false);
    expect(isAdminEmail(null, undefined)).toBe(false);
  });

  it("can be changed with ADMIN_EMAILS, which replaces the default", () => {
    expect(isAdminEmail("boss@x.com", "boss@x.com, other@x.com")).toBe(true);
    expect(isAdminEmail("matthew.he@outlook.com", "boss@x.com")).toBe(false);
    expect(isAdminEmail("matthew.he@outlook.com", "  ")).toBe(true); // blank falls back to the default
  });

  it("totals users, items and spend", async () => {
    const o = await adminOverview(db);
    expect(o).toMatchObject({ users: 3, newUsers7d: 3, activeUsers7d: 1, generations: 1, generationsThisMonth: 1 });
    expect(o.spendAllTime).toBeCloseTo(0.035);
    expect(o.spendThisMonth).toBeGreaterThanOrEqual(0.015 - 1e-9);
    expect(o.spendThisMonth).toBeLessThanOrEqual(0.035 + 1e-9);
  });

  it("lists every account with its own totals", async () => {
    const users = await adminListUsers(db);
    expect(users.map((x) => x.email).sort()).toEqual(["matthew.he@outlook.com", "quiet@school.vic.edu.au", "teacher@school.vic.edu.au"]);
    const t = users.find((x) => x.id === teacher)!;
    expect(t).toMatchObject({ displayName: "Sam Teacher", libraryItems: 1, generations: 2, refinements: 1, budgetUsd: 5, ownKey: true, model: "claude-sonnet-5-5" });
    expect(t.spendAllTime).toBeCloseTo(0.035);
    expect(t.tokensIn).toBe(4500);
    expect(t.tokensOut).toBe(6000);
    expect(t.lastActive).toBeInstanceOf(Date);
    const q = users.find((x) => x.id === quiet)!;
    expect(q).toMatchObject({ generations: 0, libraryItems: 0, spendAllTime: 0, ownKey: false, lastActive: null });
    // sign-in counts as activity, and the most recently active person is first
    expect(users.find((x) => x.id === admin)!.lastActive).toBeInstanceOf(Date);
    expect(users.at(-1)!.id).toBe(quiet);
  });

  it("shows one person's activity with titles only, never content or keys", async () => {
    const activity = await adminUserActivity(db, teacher);
    expect(activity).toHaveLength(3);
    expect(activity[0]).toMatchObject({ kind: "generate", outputType: "lesson_plan", title: "Fractions with strips", subjectSlug: "mathematics", level: "3" });
    expect(activity[2].title).toBeNull(); // an item that was deleted
    const text = JSON.stringify([activity, await adminGetUser(db, teacher), await adminListUsers(db)]);
    for (const secret of ["SECRET IDEA", "SECRET CONTENT", "SECRETKEY", "1234"]) expect(text).not.toContain(secret);
    expect(await adminUserActivity(db, quiet)).toEqual([]);
    expect(await adminGetUser(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("charts calls per Melbourne day, for everyone or one person", async () => {
    const all = await adminUsageRows(db, new Date(Date.now() - 31 * 86_400_000));
    expect(all).toHaveLength(2); // the 40-day-old call is outside the 31-day window
    expect(await adminUsageRows(db, new Date(Date.now() - 31 * 86_400_000), quiet)).toEqual([]);
    const days = dailyCalls(all, 30);
    expect(days).toHaveLength(30);
    expect(days.reduce((n, d) => n + d.calls, 0)).toBe(2);
    expect(days.at(-1)!.calls + days.at(-2)!.calls).toBe(2);
  });

  it("formats times and token counts", () => {
    const now = new Date("2026-11-03T10:00:00Z");
    expect(timeAgo(null, now)).toBe("never");
    expect(timeAgo(new Date("2026-11-03T09:59:50Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-11-03T09:55:00Z"), now)).toBe("5 minutes ago");
    expect(timeAgo(new Date("2026-11-02T10:00:00Z"), now)).toBe("1 day ago");
    expect(timeAgo(new Date("2026-10-30T10:00:00Z"), now)).toBe("4 days ago");
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(12_400)).toBe("12k");
    expect(formatTokens(3_200_000)).toBe("3.2M");
  });
});

describe("admin pages are locked", () => {
  beforeAll(() => setDbForTesting(db));
  afterAll(() => setDbForTesting(null));

  it("sends signed-out visitors to sign in", async () => {
    jar.clear();
    await expect(adminPage("/admin")).rejects.toMatchObject({ url: "/login?next=%2Fadmin" });
  });

  it("shows other teachers a plain 404", async () => {
    jar.clear();
    await createSession(db, teacher);
    await expect(adminPage("/admin")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(adminPage(`/admin/users/${teacher}`)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("lets the super admin in", async () => {
    jar.clear();
    await createSession(db, admin);
    const { user } = await adminPage("/admin");
    expect(user.email).toBe("matthew.he@outlook.com");
  });
});
