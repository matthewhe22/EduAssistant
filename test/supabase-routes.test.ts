import { beforeEach, describe, expect, it, vi } from "vitest";
import { samplePlan } from "./fixtures/sample-plan";

/* A tiny fake of the Supabase query builder: records calls and returns canned results. */
type Call = { table: string; op: string; payload?: unknown; filters: unknown[][] };
const calls: Call[] = [];
let spent = 0;
let budget: number | null = null;

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  calls.push(call);
  const result = () => {
    if (table === "profiles") return { data: { monthly_budget_usd: budget }, error: null };
    if (table === "generations" && call.op === "insert") return { data: { id: "11111111-1111-4111-8111-111111111111" }, error: null };
    if (table === "generations" && call.op === "update") return { data: { id: "11111111-1111-4111-8111-111111111111" }, error: null };
    if (call.op === "delete") return { data: [{ id: "x" }], error: null };
    return { data: null, error: null };
  };
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "range", "or", "is", "not", "gte"]) {
    b[m] = (...args: unknown[]) => {
      if (m !== "select") call.filters.push([m, ...args]);
      return b;
    };
  }
  for (const op of ["insert", "update", "delete"]) {
    b[op] = (payload?: unknown) => {
      call.op = op;
      call.payload = payload;
      return b;
    };
  }
  b.single = async () => result();
  b.maybeSingle = async () => result();
  b.then = (resolve: (v: unknown) => void) => resolve(result());
  return b;
}

const fakeSupabase = {
  auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "t@example.com" } } }) },
  from: (table: string) => builder(table),
  rpc: async () => ({ data: spent, error: null }),
};

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: () => fakeSupabase,
  getCurrentUser: async () => ({ id: "user-1" }),
}));
vi.mock("@/lib/generator/claude", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generator/claude")>("@/lib/generator/claude");
  return { ...actual, generateStructured: vi.fn() };
});

import { generateStructured } from "@/lib/generator/claude";
import { POST as generate } from "@/app/api/generate/route";
import { POST as feedback } from "@/app/api/generations/[id]/feedback/route";
import { POST as createTemplate } from "@/app/api/templates/route";
import { POST as setBudget } from "@/app/api/budget/route";

const mocked = vi.mocked(generateStructured);
const usage = { inputTokens: 100, cacheWriteTokens: 5000, cacheReadTokens: 0, outputTokens: 2000, costUsd: 0.0669 };
const json = (b: unknown) => new Request("http://test", { method: "POST", body: JSON.stringify(b), headers: { "Content-Type": "application/json" } });
const body = { level: "3", subjectSlug: "mathematics", idea: "Fractions with strips", difficulty: "at", lessonMinutes: 55, attachment: { name: "old.txt", mediaType: "text/plain", data: Buffer.from("old plan").toString("base64") } };

beforeEach(() => {
  calls.length = 0;
  spent = 0;
  budget = null;
  mocked.mockReset();
});

describe("generate with Supabase", () => {
  it("saves the generation with costs, logs usage, and doesn't store the file", async () => {
    mocked.mockResolvedValue({ content: samplePlan, model: "claude-opus-5-5", usage } as never);
    const text = await (await generate(json(body))).text();
    const result = JSON.parse(text.trim().split("\n").at(-1)!);
    expect(result.generationId).toBe("11111111-1111-4111-8111-111111111111");

    const insert = calls.find((c) => c.table === "generations" && c.op === "insert")!.payload as Record<string, unknown>;
    expect(insert).toMatchObject({ output_type: "lesson_plan", cache_write_tokens: 5000, cost_usd: 0.0669, user_id: "user-1" });
    expect(insert.teacher_input).toMatchObject({ attachmentName: "old.txt" });
    expect(JSON.stringify(insert.teacher_input)).not.toContain(body.attachment.data);

    const log = calls.find((c) => c.table === "usage_events")!.payload;
    expect(log).toMatchObject({ kind: "generate", generation_id: result.generationId, cost_usd: 0.0669, output_tokens: 2000 });
  });

  it("blocks generation when the monthly budget is used up", async () => {
    spent = 5.2;
    budget = 5;
    const res = await generate(json(body));
    expect(res.status).toBe(402);
    expect((await res.json()).error).toContain("monthly budget of US$5.00");
    expect(mocked).not.toHaveBeenCalled();
  });
});

describe("library routes", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("saves feedback and validates it", async () => {
    const ok = await feedback(json({ rating: -1, comment: "Too long" }), { params: { id } });
    expect(ok.status).toBe(200);
    expect(calls.at(-1)!.payload).toMatchObject({ rating: -1, feedback_comment: "Too long" });
    expect((await feedback(json({ rating: 5 }), { params: { id } })).status).toBe(400);
    expect((await feedback(json({ rating: 1 }), { params: { id: "../x" } })).status).toBe(404);
  });

  it("creates templates and sets the budget", async () => {
    const t = await createTemplate(json({ name: "Y3 maths", settings: { outputType: "worksheet", level: "3", itemCount: 12 } }));
    expect(t.status).toBe(201);
    expect(calls.at(-1)).toMatchObject({ table: "templates", op: "insert" });
    expect((await createTemplate(json({ name: "", settings: {} }))).status).toBe(400);
    expect((await setBudget(json({ monthlyBudgetUsd: 10 }))).status).toBe(200);
    expect((await setBudget(json({ monthlyBudgetUsd: -1 }))).status).toBe(400);
  });
});
