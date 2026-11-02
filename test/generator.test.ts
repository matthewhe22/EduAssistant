import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { SubjectCurriculum } from "@/lib/curriculum/types";
import { buildCurriculumContext, buildTeacherRequest } from "@/lib/generator/context";
import { GenerateRequestSchema, LessonPlanSchema } from "@/lib/generator/schema";
import { validatePlan } from "@/lib/generator/validate";
import { SYSTEM_PROMPT } from "@/lib/generator/pedagogy";
import { buildLessonPlanDocument, docxFilename, lessonPlanToDocx } from "@/lib/export/docx";
import { samplePlan } from "./fixtures/sample-plan";

const load = (slug: string) =>
  JSON.parse(readFileSync(path.join(__dirname, `../data/curriculum/vc2/${slug}.json`), "utf8")) as SubjectCurriculum;
const science = load("science");
const maths = load("mathematics");

describe("buildCurriculumContext", () => {
  it("uses the band that covers the level, with elaborations", () => {
    const ctx = buildCurriculumContext(science, "3", "at")!;
    expect(ctx.band.band).toBe("Levels 3 and 4");
    expect(ctx.previous).toBeNull();
    expect(ctx.next).toBeNull();
    expect(ctx.text).toContain("[VC2S4U01]");
    expect(ctx.text).toContain("elaboration:");
    expect(ctx.allowedCodes.has("VC2S4U01")).toBe(true);
    expect(ctx.allowedCodes.has("VC2S2U01")).toBe(false);
  });

  it("adds neighbouring bands for below / above / mixed, without elaborations", () => {
    const ctx = buildCurriculumContext(maths, "3", "mixed")!;
    expect(ctx.previous?.band).toBe("Level 2");
    expect(ctx.next?.band).toBe("Level 4");
    expect(ctx.allowedCodes.has("VC2M2N01")).toBe(true);
    expect(ctx.allowedCodes.has("VC2M4N01")).toBe(true);
    const nextSection = ctx.text.split("## Next level/band")[1];
    expect(nextSection).not.toContain("elaboration:");
  });

  it("returns null when the subject has no content at that level", () => {
    expect(buildCurriculumContext(load("economics-and-business"), "2", "at")).toBeNull();
  });

  it("is deterministic so the curriculum block caches", () => {
    expect(buildCurriculumContext(maths, "3", "at")!.text).toBe(buildCurriculumContext(maths, "3", "at")!.text);
  });

  it("describes the year within a band and keeps only valid focus codes", () => {
    const req = GenerateRequestSchema.parse({
      level: "4",
      subjectSlug: "science",
      idea: "Investigate how heat changes materials",
      difficulty: "at",
      lessonMinutes: 60,
      focusCodes: ["VC2S4U01", "BOGUS"],
    });
    const ctx = buildCurriculumContext(science, req.level, req.difficulty)!;
    const text = buildTeacherRequest(req, science, ctx);
    expect(text).toContain('year 2 of the 2-year band "Levels 3 and 4"');
    expect(text).toContain("VC2S4U01");
    expect(text).not.toContain("BOGUS");
  });
});

describe("validatePlan", () => {
  it("drops invented codes and flags timing mismatches", () => {
    const ctx = buildCurriculumContext(maths, "3", "at")!;
    const { plan, warnings } = validatePlan(samplePlan, ctx.allowedCodes, 60);
    expect(plan.curriculumLinks.map((l) => l.code)).toEqual(["VC2M3N03"]);
    expect(warnings.join(" ")).toContain("VC2M9N99");
    expect(warnings.join(" ")).toContain("55 minutes, not 60");
  });
});

describe("schemas and prompt", () => {
  it("LessonPlanSchema converts to a structured-output format", () => {
    const format = zodOutputFormat(LessonPlanSchema);
    expect(format.type).toBe("json_schema");
    expect(LessonPlanSchema.parse(samplePlan).title).toBe(samplePlan.title);
  });

  it("rejects an empty idea", () => {
    const r = GenerateRequestSchema.safeParse({ level: "3", subjectSlug: "mathematics", idea: " ", difficulty: "at", lessonMinutes: 60 });
    expect(r.success).toBe(false);
  });

  it("system prompt is static (no dates) and covers Victorian requirements", () => {
    expect(SYSTEM_PROMPT).toMatch(/VTLM 2\.0/);
    expect(SYSTEM_PROMPT).toMatch(/synthetic phonics/);
    expect(SYSTEM_PROMPT).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  });
});

describe("docx export", () => {
  it("produces a Word file", async () => {
    const buf = await lessonPlanToDocx(samplePlan, {
      subject: "Mathematics",
      levelLabel: "Level 3 (Year 3)",
      lessonMinutes: 55,
      codeText: { VC2M3N03: "recognise and represent unit fractions" },
    });
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    expect(buf.length).toBeGreaterThan(5000);
    expect(buildLessonPlanDocument(samplePlan, { subject: "M", levelLabel: "L", lessonMinutes: 1, codeText: {} })).toBeTruthy();
  });

  it("makes a safe filename", () => {
    expect(docxFilename('Fractions: "halves" & quarters!')).toBe("Fractions-halves-quarters.docx");
  });
});
