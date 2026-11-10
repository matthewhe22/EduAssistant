import { beforeEach, describe, expect, it, vi } from "vitest";
import { samplePlan } from "./fixtures/sample-plan";
import { SAMPLES } from "./fixtures/samples";

vi.mock("@/lib/generator/llm", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generator/llm")>("@/lib/generator/llm");
  return { ...actual, generateStructured: vi.fn() };
});

import { GenerationError, generateStructured } from "@/lib/generator/llm";
import { makePdf } from "./fixtures/pdf";
import { POST as generate } from "@/app/api/generate/route";
import { POST as refine } from "@/app/api/refine/route";

const mocked = vi.mocked(generateStructured);
const usage = { inputTokens: 100, cacheWriteTokens: 0, outputTokens: 50, cacheReadTokens: 900, costUsd: 0.0001 };
const body = { level: "3", subjectSlug: "mathematics", idea: "Fractions with paper strips", difficulty: "at", lessonMinutes: 55 };
const post = (handler: (r: Request) => Promise<Response>, b: unknown) =>
  handler(new Request("http://test/api", { method: "POST", body: JSON.stringify(b), headers: { "Content-Type": "application/json" } }));
const events = async (res: Response) =>
  (await res.text())
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

beforeEach(() => {
  delete process.env.DATABASE_URL;
  process.env.TENON_API_KEY = "sk-tx-server";
  delete process.env.DEFAULT_MODEL;
  mocked.mockReset();
});

describe("POST /api/generate (local mode, no Supabase)", () => {
  it("streams progress then a validated lesson plan", async () => {
    mocked.mockImplementation(async (opts) => {
      expect(opts.curriculumText).toContain("[VC2M3N03]");
      expect(opts.requestText).toContain("Fractions with paper strips");
      expect(opts.ai).toEqual({ apiKey: "sk-tx-server", model: "glm-5.3-flash", keySource: "server" });
      opts.onProgress(250, '{"title":"x","overview":"' + "a".repeat(220) + '","phases":[');
      return { content: samplePlan, model: "claude-opus-5-5", usage } as never;
    });
    const ev = await events(await post(generate, body));
    expect(ev[0]).toEqual({ type: "progress", characters: 250, section: "phases" });
    const result = ev.at(-1);
    expect(result).toMatchObject({ type: "result", outputType: "lesson_plan", generationId: null });
    expect(result.content.curriculumLinks.map((l: { code: string }) => l.code)).toEqual(["VC2M3N03"]);
  });

  it("generates other output types with their schema", async () => {
    mocked.mockResolvedValue({ content: SAMPLES.worksheet, model: "m", usage } as never);
    const ev = await events(await post(generate, { ...body, outputType: "worksheet", itemCount: 2 }));
    expect(mocked.mock.calls[0][0].schema.shape).toHaveProperty("sections");
    expect(ev.at(-1)).toMatchObject({ type: "result", outputType: "worksheet" });
  });

  it("sends an uploaded PDF's text to the model", async () => {
    mocked.mockResolvedValue({ content: samplePlan, model: "m", usage } as never);
    const data = makePdf("Old plan: halves and quarters").toString("base64");
    await events(await post(generate, { ...body, idea: "", attachment: { name: "plan.pdf", mediaType: "application/pdf", data } }));
    expect(mocked.mock.calls[0][0].requestText).toContain("Old plan: halves and quarters");
  });

  it("sends the text of several reference files to the model", async () => {
    mocked.mockResolvedValue({ content: SAMPLES.slides, model: "m", usage } as never);
    const pdf = makePdf("Reading: fractions in the kitchen").toString("base64");
    const txt = Buffer.from("Worksheet: shade one quarter").toString("base64");
    const ev = await events(
      await post(generate, {
        ...body,
        outputType: "slides",
        attachments: [
          { name: "reading.pdf", mediaType: "application/pdf", data: pdf },
          { name: "sheet.txt", mediaType: "text/plain", data: txt },
        ],
      }),
    );
    const text = mocked.mock.calls[0][0].requestText;
    expect(text).toContain("Reading: fractions in the kitchen");
    expect(text).toContain('<reference_material name="sheet.txt">');
    expect(ev.at(-1)).toMatchObject({ type: "result", outputType: "slides" });
  });

  it("asks for an API key when none is configured", async () => {
    delete process.env.TENON_API_KEY;
    const ev = await events(await post(generate, body));
    expect(ev).toEqual([{ type: "error", message: "Add your Tenon API key on the Settings page to start generating." }]);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("reports unreadable uploads as an error event", async () => {
    const ev = await events(
      await post(generate, {
        ...body,
        attachment: { name: "x.docx", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", data: "bm9wZQ==" },
      }),
    );
    expect(ev).toEqual([{ type: "error", message: 'Could not read "x.docx". Is it a valid Word (.docx) file?' }]);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("sends a friendly error event when generation fails", async () => {
    mocked.mockRejectedValue(new GenerationError("The output was too long"));
    expect(await events(await post(generate, body))).toEqual([{ type: "error", message: "The output was too long" }]);
  });

  it("rejects invalid input and levels without content", async () => {
    expect((await post(generate, { ...body, idea: "" })).status).toBe(400);
    expect((await post(generate, { ...body, subjectSlug: "economics-and-business", level: "2" })).status).toBe(400);
    expect((await post(generate, { ...body, outputType: "essay" })).status).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });
});

describe("POST /api/refine", () => {
  const refineBody = { outputType: "lesson_plan", level: "3", subjectSlug: "mathematics", difficulty: "at", lessonMinutes: 55, content: samplePlan };

  it("replaces only the chosen section", async () => {
    const rewritten = { ...samplePlan, title: "CHANGED", learningIntention: "We are learning to compare fractions." };
    mocked.mockResolvedValue({ content: rewritten, model: "m", usage } as never);
    const ev = await events(await post(refine, { ...refineBody, section: "learningIntention", instruction: "Focus on comparing" }));
    const result = ev.at(-1);
    expect(result.content.learningIntention).toBe("We are learning to compare fractions.");
    expect(result.content.title).toBe(samplePlan.title);
    expect(mocked.mock.calls[0][0].requestText).toContain('Rewrite only the "learningIntention" field');
  });

  it("rejects unknown sections and invalid content", async () => {
    expect((await post(refine, { ...refineBody, section: "curriculumLinks", instruction: "change" })).status).toBe(400);
    expect((await post(refine, { ...refineBody, section: "overview", instruction: "change", content: { title: "x" } })).status).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });
});
