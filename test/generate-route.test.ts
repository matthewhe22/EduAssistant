import { beforeEach, describe, expect, it, vi } from "vitest";
import { samplePlan } from "./fixtures/sample-plan";

vi.mock("@/lib/generator/claude", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generator/claude")>("@/lib/generator/claude");
  return { ...actual, generateLessonPlan: vi.fn() };
});

import { GenerationError, generateLessonPlan } from "@/lib/generator/claude";
import { POST } from "@/app/api/generate/route";

const mocked = vi.mocked(generateLessonPlan);
const body = { level: "3", subjectSlug: "mathematics", idea: "Fractions with paper strips", difficulty: "at", lessonMinutes: 55 };
const post = (b: unknown) =>
  POST(new Request("http://test/api/generate", { method: "POST", body: JSON.stringify(b), headers: { "Content-Type": "application/json" } }));

async function events(res: Response) {
  return (await res.text())
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
}

describe("POST /api/generate (local mode, no Supabase)", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    mocked.mockReset();
  });

  it("streams progress then a validated result", async () => {
    mocked.mockImplementation(async (curriculumText, teacherRequest, onProgress) => {
      expect(curriculumText).toContain("[VC2M3N03]");
      expect(teacherRequest).toContain("Fractions with paper strips");
      onProgress(250);
      return { plan: samplePlan, model: "claude-opus-5-5", usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 900 } };
    });
    const res = await post(body);
    expect(res.headers.get("Content-Type")).toContain("ndjson");
    const ev = await events(res);
    expect(ev[0]).toEqual({ type: "progress", characters: 250 });
    const result = ev.at(-1);
    expect(result.type).toBe("result");
    expect(result.plan.curriculumLinks.map((l: { code: string }) => l.code)).toEqual(["VC2M3N03"]);
    expect(result.generationId).toBeNull();
    expect(result.warnings.join(" ")).toContain("VC2M9N99");
  });

  it("sends a friendly error event when generation fails", async () => {
    mocked.mockRejectedValue(new GenerationError("The plan was too long"));
    const ev = await events(await post(body));
    expect(ev).toEqual([{ type: "error", message: "The plan was too long" }]);
  });

  it("rejects invalid input and levels without content", async () => {
    expect((await post({ ...body, idea: "" })).status).toBe(400);
    expect((await post({ ...body, subjectSlug: "economics-and-business", level: "2" })).status).toBe(400);
    expect((await post({ ...body, subjectSlug: "../etc" })).status).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });
});
