/**
 * End-to-end tests against a real PostgreSQL (PGlite, in-process) with the real migrations:
 * sign-up/sign-in, sessions, saving generations, library search, feedback, templates,
 * budget and per-teacher isolation. Claude is mocked.
 */
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { samplePlan } from "./fixtures/sample-plan";

/* In-memory cookie jar standing in for next/headers. */
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
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
vi.mock("@/lib/generator/llm", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generator/llm")>("@/lib/generator/llm");
  return {
    ...actual,
    generateStructured: vi.fn(),
    checkApiKey: vi.fn(async (key: string) => (key.includes("bad") ? "invalid" : "ok")),
  };
});

import { migrate } from "../scripts/db/migrate.mjs";
import { setDbForTesting, type Db } from "@/lib/db";
import { generateStructured } from "@/lib/generator/llm";
import { signIn, signUp } from "@/app/login/actions";
import { POST as generate } from "@/app/api/generate/route";
import { POST as refine } from "@/app/api/refine/route";
import { POST as feedback } from "@/app/api/generations/[id]/feedback/route";
import { DELETE as deleteGen, PUT as saveGen } from "@/app/api/generations/[id]/route";
import { POST as undoGen } from "@/app/api/generations/[id]/undo/route";
import { GET as listTpl, POST as createTpl } from "@/app/api/templates/route";
import { POST as setBudget } from "@/app/api/budget/route";
import { POST as saveAi } from "@/app/api/ai-settings/route";
import { resolveAiConfig } from "@/lib/ai/config";
import { listGenerations } from "@/lib/data/generations";
import { monthSpend } from "@/lib/data/users";

const pg = new PGlite();
/** node-pg runs multi-statement SQL through query(); PGlite needs exec() for that. */
const db: Db = {
  query: async (text: string, params?: unknown[]) =>
    (params?.length ? pg.query(text, params) : (await pg.exec(text)).at(-1) ?? { rows: [] }) as never,
};
const mocked = vi.mocked(generateStructured);
const usage = { inputTokens: 100, cacheWriteTokens: 5000, cacheReadTokens: 0, outputTokens: 2000, costUsd: 0.0669 };
const json = (b: unknown) => new Request("http://test", { method: "POST", body: JSON.stringify(b), headers: { "Content-Type": "application/json" } });
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
async function redirectOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { url?: string }).url;
  }
  return undefined;
}
const genBody = { level: "3", subjectSlug: "mathematics", idea: "Fractions with paper strips", difficulty: "at", lessonMinutes: 55 };
async function generateOne() {
  mocked.mockResolvedValue({ content: samplePlan, model: "deepseek-v4.1-flash", usage } as never);
  const lines = (await (await generate(json(genBody))).text()).trim().split("\n");
  return JSON.parse(lines.at(-1)!);
}
let teacherA = "";
let teacherACookie = "";

beforeAll(async () => {
  await migrate(db, () => {});
  setDbForTesting(db);
  process.env.DATABASE_URL = "postgres://test/unused";
  process.env.TENON_API_KEY = "sk-tx-server";
  process.env.SETTINGS_SECRET = "test-secret-at-least-16-chars";
});
afterAll(() => setDbForTesting(null));
beforeEach(() => mocked.mockReset());

describe("migrations", () => {
  it("apply once and are idempotent", async () => {
    await migrate(db, () => {});
    const { rows } = await db.query<{ name: string }>("select name from schema_migrations");
    expect(rows.map((r) => r.name)).toEqual(["001_init.sql", "002_ai_settings.sql", "003_generation_versions.sql", "004_invitations.sql", "005_slides_output.sql", "006_puzzles_output.sql"]);
  });
});

describe("accounts", () => {
  it("lets the first teacher sign up and signs them in", async () => {
    jar.clear();
    const url = await redirectOf(signUp(form({ email: "Ann@School.vic.edu.au", password: "correct horse battery", name: "Ann", next: "/plans" })));
    expect(url).toBe("/plans");
    expect(jar.get("eda_session")).toBeTruthy();
    const { rows } = await db.query<{ id: string; email: string; password_hash: string }>("select id, email, password_hash from users");
    expect(rows[0].email).toBe("ann@school.vic.edu.au");
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);
    teacherA = rows[0].id;
    teacherACookie = jar.get("eda_session")!;
    const { rows: s } = await db.query<{ token_hash: string }>("select token_hash from sessions");
    expect(s[0].token_hash).not.toBe(teacherACookie); // only the hash is stored
  });

  it("closes sign-ups after the first account unless the email is allowed", async () => {
    jar.clear();
    expect(await redirectOf(signUp(form({ email: "stranger@x.com", password: "0123456789ab" })))).toContain("New%20accounts%20are%20closed");
    process.env.ALLOWED_EMAILS = "colleague@x.com";
    expect(await redirectOf(signUp(form({ email: "Colleague@x.com", password: "0123456789ab" })))).toBe("/plan");
    delete process.env.ALLOWED_EMAILS;
  });

  it("tells someone who already has an account to sign in (e.g. after a double submit)", async () => {
    jar.clear();
    expect(await redirectOf(signUp(form({ email: "ann@school.vic.edu.au", password: "correct horse battery" })))).toContain("already%20have%20an%20account");
  });

  it("rejects weak passwords and wrong credentials with the same message", async () => {
    jar.clear();
    process.env.ALLOWED_EMAILS = "new@x.com";
    expect(await redirectOf(signUp(form({ email: "new@x.com", password: "short" })))).toContain("at%20least%2010");
    delete process.env.ALLOWED_EMAILS;
    expect(await redirectOf(signIn(form({ email: "ann@school.vic.edu.au", password: "wrong password" })))).toContain("Wrong%20email%20or%20password");
    expect(await redirectOf(signIn(form({ email: "nobody@x.com", password: "whatever123" })))).toContain("Wrong%20email%20or%20password");
    expect(jar.has("eda_session")).toBe(false);
    expect(await redirectOf(signIn(form({ email: "ANN@school.vic.edu.au", password: "correct horse battery", next: "//evil.com" })))).toBe("/plan");
    expect(jar.has("eda_session")).toBe(true);
  });
});

describe("as a signed-in teacher", () => {
  beforeEach(() => {
    jar.clear();
    jar.set("eda_session", teacherACookie);
  });

  it("requires a valid session", async () => {
    jar.set("eda_session", "forged");
    expect((await generate(json(genBody))).status).toBe(401);
    expect((await listTpl()).status).toBe(401);
  });

  it("saves generations with costs and logs usage", async () => {
    const result = await generateOne();
    expect(result.generationId).toMatch(/^[0-9a-f-]{36}$/);
    const { rows } = await db.query<{ cost_usd: string; cache_write_tokens: number; user_id: string; content: { output: { title: string } } }>(
      "select cost_usd, cache_write_tokens, user_id, content from generations where id = $1",
      [result.generationId],
    );
    expect(rows[0]).toMatchObject({ cost_usd: "0.066900", cache_write_tokens: 5000, user_id: teacherA });
    expect(rows[0].content.output.title).toBe(samplePlan.title);
    expect(await monthSpend(db, teacherA)).toBeCloseTo(0.0669);
  });

  it("refines and saves a section, logging a refine event", async () => {
    const { generationId } = await generateOne();
    mocked.mockResolvedValue({ content: { ...samplePlan, overview: "New overview" }, model: "deepseek-v4.1-flash", usage } as never);
    await (await refine(json({ ...genBody, outputType: "lesson_plan", section: "overview", instruction: "shorter", content: samplePlan, generationId }))).text();
    const { rows } = await db.query<{ content: { output: { overview: string } } }>("select content from generations where id = $1", [generationId]);
    expect(rows[0].content.output.overview).toBe("New overview");
    const { rows: ev } = await db.query<{ n: number }>("select count(*)::int n from usage_events where kind = 'refine' and generation_id = $1", [generationId]);
    expect(ev[0].n).toBe(1);
  });

  it("keeps versions so rewrites and quick fixes can be undone", async () => {
    const { generationId } = await generateOne();
    const params = { params: { id: generationId } };
    expect((await undoGen(json({}), params)).status).toBe(404); // nothing to undo yet

    mocked.mockResolvedValue({ content: { ...samplePlan, overview: "Rewritten" }, model: "deepseek-v4.1-flash", usage } as never);
    await (await refine(json({ ...genBody, outputType: "lesson_plan", section: "overview", instruction: "shorter", content: samplePlan, generationId }))).text();
    const fixed = { ...samplePlan, overview: "Rewritten", phases: samplePlan.phases.map((p) => ({ ...p, minutes: 5 })) };
    const put = await saveGen(new Request("http://test", { method: "PUT", body: JSON.stringify({ content: fixed, warnings: [] }) }), params);
    expect(await put.json()).toEqual({ ok: true, versions: 2 });
    expect((await saveGen(new Request("http://test", { method: "PUT", body: JSON.stringify({ content: { title: 1 } }) }), params)).status).toBe(400);

    const first = await (await undoGen(json({}), params)).json();
    expect(first.content.overview).toBe("Rewritten");
    expect(first.content.phases[0].minutes).toBe(samplePlan.phases[0].minutes);
    expect(first.remaining).toBe(1);
    const second = await (await undoGen(json({}), params)).json();
    expect(second.content.overview).toBe(samplePlan.overview);
    expect(second.remaining).toBe(0);
    const { rows } = await db.query<{ content: { output: { overview: string } } }>("select content from generations where id = $1", [generationId]);
    expect(rows[0].content.output.overview).toBe(samplePlan.overview);
  });

  it("stores what a matching item was based on, without copying the source content", async () => {
    const { generationId } = await generateOne();
    let requestText = "";
    mocked.mockImplementation(async (...args: unknown[]) => {
      requestText = (args[0] as { requestText?: string } | undefined)?.requestText ?? requestText;
      return { content: samplePlan, model: "deepseek-v4.1-flash", usage } as never;
    });
    const res = await generate(json({ ...genBody, idea: "", secondLevel: "4", basedOn: { outputType: "lesson_plan", title: samplePlan.title, content: samplePlan, generationId } }));
    const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    const result = events.at(-1);
    expect(result).toMatchObject({ type: "result" });
    expect(requestText).toContain("<source_material>");
    expect(requestText).toContain(samplePlan.learningIntention);
    const { rows } = await db.query<{ teacher_input: Record<string, unknown> }>("select teacher_input from generations where id = $1", [result.generationId]);
    expect(rows[0].teacher_input.basedOn).toEqual({ outputType: "lesson_plan", title: samplePlan.title, generationId });
    expect(rows[0].teacher_input.secondLevel).toBe("4");
  });

  it("searches the library literally (LIKE wildcards are escaped)", async () => {
    const all = await listGenerations(db, teacherA, {}, 50, 0);
    expect(all.count).toBeGreaterThanOrEqual(2);
    expect((await listGenerations(db, teacherA, { q: "paper strips" }, 50, 0)).count).toBe(all.count); // matches idea text
    expect((await listGenerations(db, teacherA, { q: "%" }, 50, 0)).count).toBe(0);
    expect((await listGenerations(db, teacherA, { outputType: "rubric" }, 50, 0)).count).toBe(0);
  });

  it("records feedback, templates and budget", async () => {
    const { generationId } = await generateOne();
    expect((await feedback(json({ rating: -1, comment: "Too long" }), { params: { id: generationId } })).status).toBe(200);
    expect((await listGenerations(db, teacherA, { rating: "down" }, 50, 0)).items.map((i) => i.id)).toContain(generationId);

    expect((await createTpl(json({ name: "Y3 maths", settings: { outputType: "worksheet", level: "3" } }))).status).toBe(201);
    expect((await (await listTpl()).json()).templates.map((t: { name: string }) => t.name)).toEqual(["Y3 maths"]);

    expect((await setBudget(json({ monthlyBudgetUsd: 0.01 }))).status).toBe(200);
    mocked.mockClear();
    try {
      const blocked = await generate(json(genBody));
      expect(blocked.status).toBe(402);
      expect((await blocked.json()).error).toContain("monthly budget");
      expect(mocked).not.toHaveBeenCalled();
    } finally {
      await setBudget(json({ monthlyBudgetUsd: null }));
    }
  });

  it("keeps usage when a generation is deleted", async () => {
    const { generationId } = await generateOne();
    expect((await deleteGen(new Request("http://test"), { params: { id: generationId } })).status).toBe(200);
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from usage_events where kind = 'generate' and generation_id is null");
    expect(rows[0].n).toBe(1);
  });

  it("stores the Tenon key encrypted, uses it and the chosen model", async () => {
    expect((await resolveAiConfig(db, teacherA)).keySource).toBe("server");
    expect((await saveAi(json({ apiKey: "sk-tx-bad-key-123" }))).status).toBe(400);
    expect((await saveAi(json({ apiKey: "sk-tx-teacher-a-0001", model: "claude-sonnet-5-5" }))).status).toBe(200);
    const { rows } = await db.query<{ api_key_enc: string; api_key_hint: string; default_model: string }>("select * from user_settings where user_id = $1", [teacherA]);
    expect(rows[0].api_key_enc).not.toContain("teacher-a");
    expect(rows[0].api_key_hint).toBe("sk-tx-…0001");
    expect(await resolveAiConfig(db, teacherA)).toEqual({ apiKey: "sk-tx-teacher-a-0001", model: "claude-sonnet-5-5", keySource: "user" });

    mocked.mockResolvedValue({ content: samplePlan, model: "claude-sonnet-5-5", usage } as never);
    await (await generate(json(genBody))).text();
    expect(mocked.mock.calls.at(-1)![0].ai).toEqual({ apiKey: "sk-tx-teacher-a-0001", model: "claude-sonnet-5-5", keySource: "user" });

    expect((await saveAi(json({ removeKey: true }))).status).toBe(200);
    expect(await resolveAiConfig(db, teacherA)).toEqual({ apiKey: "sk-tx-server", model: "claude-sonnet-5-5", keySource: "server" });
    expect((await saveAi(json({ model: "bad model id!" }))).status).toBe(400);
  });

  it("isolates teachers from each other", async () => {
    const { generationId } = await generateOne();
    jar.clear();
    await redirectOf(signIn(form({ email: "colleague@x.com", password: "0123456789ab" })));
    expect((await feedback(json({ rating: 1 }), { params: { id: generationId } })).status).toBe(404);
    expect((await deleteGen(new Request("http://test"), { params: { id: generationId } })).status).toBe(404);
    expect((await undoGen(json({}), { params: { id: generationId } })).status).toBe(404);
    expect((await saveGen(new Request("http://test", { method: "PUT", body: JSON.stringify({ content: samplePlan }) }), { params: { id: generationId } })).status).toBe(404);
    expect((await (await listTpl()).json()).templates).toEqual([]);
    expect((await resolveAiConfig(db, (await db.query<{ id: string }>("select id from users where email = 'colleague@x.com'")).rows[0].id)).keySource).toBe("server");
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from generations where id = $1", [generationId]);
    expect(rows[0].n).toBe(1);
  });
});
