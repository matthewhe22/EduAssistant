/** Invitations: super admin invites by email; the link lets that address create an account. */
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: () => new Headers({ host: "edu.example.com", "x-forwarded-proto": "https" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { migrate } from "../scripts/db/migrate.mjs";
import { setDbForTesting, type Db } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { signUp } from "@/app/login/actions";
import { inviteUser, resendInvite, withdrawInvite } from "@/app/admin/actions";
import { createInvitation, findOpenInvitation, listInvitations } from "@/lib/data/invitations";
import { inviteEmail } from "@/lib/email/invite";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";

const pg = new PGlite();
const db: Db = {
  query: async (text: string, params?: unknown[]) =>
    (params?.length ? pg.query(text, params) : (await pg.exec(text)).at(-1) ?? { rows: [] }) as never,
};
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
async function redirectOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { url?: string; message?: string }).url ?? (e as Error).message;
  }
  return undefined;
}
const sent: { url: string; body: Record<string, unknown> }[] = [];
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  sent.push({ url, body: JSON.parse(String(init.body)) });
  return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
});
const tokenFrom = (text: string) => decodeURIComponent(/invite=([^&\s"]+)/.exec(text)![1]);

let adminCookie = "";
let teacherCookie = "";

beforeAll(async () => {
  await migrate(db, () => {});
  setDbForTesting(db);
  process.env.DATABASE_URL = "postgres://test/unused";
  const u = async (email: string, name: string | null) =>
    (await db.query<{ id: string }>("insert into users (email, password_hash, display_name) values ($1, 'x', $2) returning id", [email, name])).rows[0].id;
  const admin = await u("matthew.he@outlook.com", "Matthew");
  const teacher = await u("teacher@school.vic.edu.au", null);
  jar.clear();
  await createSession(db, admin);
  adminCookie = jar.get("eda_session")!;
  await createSession(db, teacher);
  teacherCookie = jar.get("eda_session")!;
  vi.stubGlobal("fetch", fetchMock);
});
afterAll(() => {
  setDbForTesting(null);
  vi.unstubAllGlobals();
});
beforeEach(() => {
  sent.length = 0;
  fetchMock.mockClear();
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "Lessonroo <invites@example.com>";
  jar.set("eda_session", adminCookie);
});

describe("email", () => {
  it("needs RESEND_API_KEY and EMAIL_FROM", async () => {
    expect(isEmailConfigured({})).toBe(false);
    expect(isEmailConfigured({ RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.co" })).toBe(true);
    expect(await sendEmail({ to: "a@b.co", subject: "s", html: "h", text: "t" }, {})).toMatchObject({ ok: false });
  });

  it("reports the provider's error", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ message: "Domain not verified" }), { status: 403 }));
    const r = await sendEmail({ to: "a@b.co", subject: "s", html: "h", text: "t" }, { RESEND_API_KEY: "k", EMAIL_FROM: "f@x.co" }, f as never);
    expect(r).toEqual({ ok: false, error: "The email service said: Domain not verified" });
  });

  it("escapes names and notes in the HTML", () => {
    const e = inviteEmail({ to: "a@b.co", name: "<b>Al</b>", link: "https://x/login?invite=t", inviter: "Matt", message: "<script>x</script>" });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;b&gt;Al&lt;/b&gt;");
    expect(e.text).toContain("https://x/login?invite=t");
    expect(e.subject).toBe("Matt invited you to Lessonroo");
  });
});

describe("inviting", () => {
  it("only the super admin can invite", async () => {
    jar.set("eda_session", teacherCookie);
    expect(await redirectOf(inviteUser(null, form({ email: "new@x.com" })))).toBe("NEXT_NOT_FOUND");
    jar.delete("eda_session");
    expect(await redirectOf(inviteUser(null, form({ email: "new@x.com" })))).toBe("NEXT_NOT_FOUND");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects bad emails and people who already have an account", async () => {
    expect(await inviteUser(null, form({ email: "nope" }))).toMatchObject({ ok: false, message: "Enter a valid email address." });
    expect(await inviteUser(null, form({ email: "Teacher@School.vic.edu.au" }))).toMatchObject({ ok: false });
  });

  it("sends an invitation email with a sign-up link; only the token's hash is stored", async () => {
    const r = await inviteUser(null, form({ email: "Ben@School.vic.edu.au", name: "Ben", message: "Try the worksheets!" }));
    expect(r).toEqual({ ok: true, message: "Invitation sent to ben@school.vic.edu.au." });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://api.resend.com/emails");
    expect(sent[0].body).toMatchObject({ to: ["ben@school.vic.edu.au"], from: "Lessonroo <invites@example.com>", reply_to: "matthew.he@outlook.com" });
    const text = String(sent[0].body.text);
    expect(text).toContain("https://edu.example.com/login?mode=signup&invite=");
    expect(text).toContain("Try the worksheets!");
    const token = tokenFrom(text);
    const { rows } = await db.query<{ token_hash: string }>("select token_hash from invitations");
    expect(rows[0].token_hash).not.toBe(token);
    const [inv] = await listInvitations(db);
    expect(inv).toMatchObject({ email: "ben@school.vic.edu.au", displayName: "Ben", status: "pending", sendCount: 1 });
  });

  it("gives the link to copy when email isn't set up", async () => {
    delete process.env.RESEND_API_KEY;
    const r = await inviteUser(null, form({ email: "cat@x.com" }));
    expect(r.ok).toBe(false);
    expect(r.link).toMatch(/^https:\/\/edu\.example\.com\/login\?mode=signup&invite=/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await findOpenInvitation(db, tokenFrom(r.link!))).toMatchObject({ email: "cat@x.com" });
  });

  it("sending again replaces the link, so the old one stops working", async () => {
    const first = await inviteUser(null, form({ email: "dee@x.com" }));
    expect(first.ok).toBe(true);
    const oldToken = tokenFrom(String(sent[0].body.text));
    const inv = (await listInvitations(db)).find((i) => i.email === "dee@x.com")!;
    expect(await resendInvite(null, form({ id: inv.id }))).toMatchObject({ ok: true });
    const newToken = tokenFrom(String(sent[1].body.text));
    expect(await findOpenInvitation(db, oldToken)).toBeNull();
    expect(await findOpenInvitation(db, newToken)).not.toBeNull();
    expect((await listInvitations(db)).filter((i) => i.email === "dee@x.com")).toHaveLength(1);
  });
});

describe("signing up with an invitation", () => {
  it("creates the account for the invited email (not whatever was typed) and uses up the link", async () => {
    const { token } = await createInvitation(db, { email: "eve@x.com", displayName: "Eve", invitedBy: null });
    jar.clear();
    const url = await redirectOf(signUp(form({ invite: token, email: "attacker@evil.com", password: "correct horse battery", name: "Eve" })));
    expect(url).toBe("/plan");
    expect(jar.get("eda_session")).toBeTruthy();
    const { rows } = await db.query<{ email: string }>("select email from users where email in ('eve@x.com', 'attacker@evil.com')");
    expect(rows.map((r) => r.email)).toEqual(["eve@x.com"]);
    expect(await findOpenInvitation(db, token)).toBeNull();
    expect((await listInvitations(db)).find((i) => i.email === "eve@x.com")?.status).toBe("accepted");
    // The link can't be used again.
    expect(await redirectOf(signUp(form({ invite: token, password: "correct horse battery" })))).toContain("expired%20or%20been%20withdrawn");
  });

  it("keeps the invitation on the page when the password is too short", async () => {
    const { token } = await createInvitation(db, { email: "fay@x.com", invitedBy: null });
    const url = await redirectOf(signUp(form({ invite: token, password: "short" })));
    expect(url).toContain("at%20least%2010");
    expect(url).toContain(`invite=${encodeURIComponent(token)}`);
  });

  it("doesn't let an uninvited email sign up, and withdrawn or expired links fail", async () => {
    expect(await redirectOf(signUp(form({ email: "stranger@x.com", password: "0123456789ab" })))).toContain("New%20accounts%20are%20closed");
    jar.set("eda_session", adminCookie);
    const { id, token } = await createInvitation(db, { email: "gus@x.com", invitedBy: null });
    await withdrawInvite(form({ id }));
    expect(await redirectOf(signUp(form({ invite: token, password: "0123456789ab" })))).toContain("expired%20or%20been%20withdrawn");
    const old = await createInvitation(db, { email: "hal@x.com", invitedBy: null });
    await db.query("update invitations set expires_at = now() - interval '1 minute' where id = $1", [old.id]);
    expect(await redirectOf(signUp(form({ invite: old.token, password: "0123456789ab" })))).toContain("expired%20or%20been%20withdrawn");
    expect((await listInvitations(db)).find((i) => i.id === old.id)?.status).toBe("expired");
  });
});
