import { readFileSync } from "node:fs";
import path from "node:path";
import { Document, Packer, Paragraph } from "docx";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { SubjectCurriculum } from "@/lib/curriculum/types";
import { AttachmentError, MAX_ATTACHMENT_TEXT, prepareAttachment } from "@/lib/generator/attachments";
import { buildCurriculumContext, buildTeacherRequest, resolveItemCount } from "@/lib/generator/context";
import { OUTPUT_TYPES, OUTPUTS } from "@/lib/generator/outputs";
import { SYSTEM_PROMPT } from "@/lib/generator/pedagogy";
import { GenerateRequestSchema, type GenerateRequest } from "@/lib/generator/schema";
import { validateOutput } from "@/lib/generator/validate";
import { docxFilename, outputToDocx } from "@/lib/export/docx";
import { makePdf } from "./fixtures/pdf";
import { samplePlan } from "./fixtures/sample-plan";
import { SAMPLES } from "./fixtures/samples";

const load = (slug: string) =>
  JSON.parse(readFileSync(path.join(__dirname, `../data/curriculum/vc2/${slug}.json`), "utf8")) as SubjectCurriculum;
const science = load("science");
const maths = load("mathematics");
const mathsCtx = buildCurriculumContext(maths, "3", "at")!;
const request = (over: Partial<Record<string, unknown>> = {}): GenerateRequest =>
  GenerateRequestSchema.parse({ level: "3", subjectSlug: "mathematics", idea: "Fractions with strips", difficulty: "at", lessonMinutes: 60, ...over });

describe("buildCurriculumContext", () => {
  it("uses the band that covers the level, with elaborations", () => {
    const ctx = buildCurriculumContext(science, "3", "at")!;
    expect(ctx.band.band).toBe("Levels 3 and 4");
    expect(ctx.text).toContain("[VC2S4U01]");
    expect(ctx.text).toContain("elaboration:");
    expect(ctx.allowedCodes.has("VC2S2U01")).toBe(false);
  });

  it("adds neighbouring bands for mixed difficulty, without elaborations", () => {
    const ctx = buildCurriculumContext(maths, "3", "mixed")!;
    expect(ctx.previous?.band).toBe("Level 2");
    expect(ctx.next?.band).toBe("Level 4");
    expect(ctx.text.split("## Next level/band")[1]).not.toContain("elaboration:");
  });

  it("returns null when the subject has no content at that level", () => {
    expect(buildCurriculumContext(load("economics-and-business"), "2", "at")).toBeNull();
  });

  it("is deterministic so the curriculum block caches", () => {
    expect(buildCurriculumContext(maths, "3", "at")!.text).toBe(mathsCtx.text);
  });
});

describe("buildTeacherRequest", () => {
  it("describes the year within a band and keeps only valid focus codes", () => {
    const req = request({ level: "4", subjectSlug: "science", focusCodes: ["VC2S4U01", "BOGUS"] });
    const ctx = buildCurriculumContext(science, "4", "at")!;
    const text = buildTeacherRequest(req, science, ctx);
    expect(text).toContain('year 2 of the 2-year band "Levels 3 and 4"');
    expect(text).toContain("VC2S4U01");
    expect(text).not.toContain("BOGUS");
    expect(text).toContain("Output: Lesson plan.");
    expect(text).toContain("exactly 60");
  });

  it("uses the output type's instructions and item count", () => {
    const text = buildTeacherRequest(request({ outputType: "worksheet", itemCount: 12 }), maths, mathsCtx);
    expect(text).toContain("Output: Worksheet + answer key.");
    expect(text).toContain("exactly 12 questions");
    expect(text).not.toContain("Lesson length");
  });

  it("clamps item counts and uses defaults", () => {
    expect(resolveItemCount({ outputType: "unit_plan", itemCount: undefined })).toBe(8);
    expect(resolveItemCount({ outputType: "unit_plan", itemCount: 30 })).toBe(20);
    expect(resolveItemCount({ outputType: "lesson_plan", itemCount: 5 })).toBe(0);
  });

  it("includes the uploaded plan's text", () => {
    const withText = buildTeacherRequest(request(), maths, mathsCtx, { name: "old.docx", text: "My old plan" });
    expect(withText).toContain('existing plan ("old.docx")');
    expect(withText).toContain("<uploaded_plan>\nMy old plan\n</uploaded_plan>");
  });
});

describe("request schema", () => {
  it("needs an idea or an attachment", () => {
    const base = { level: "3", subjectSlug: "mathematics", difficulty: "at", lessonMinutes: 60 };
    expect(GenerateRequestSchema.safeParse({ ...base, idea: " " }).success).toBe(false);
    expect(
      GenerateRequestSchema.safeParse({ ...base, attachment: { name: "a.txt", mediaType: "text/plain", data: "aGk=" } }).success,
    ).toBe(true);
    expect(
      GenerateRequestSchema.safeParse({ ...base, attachment: { name: "a.exe", mediaType: "application/x-msdownload", data: "aGk=" } }).success,
    ).toBe(false);
  });
});

describe.each(OUTPUT_TYPES)("output type %s", (type) => {
  const def = OUTPUTS[type];
  it("has a valid structured-output schema and sample", () => {
    expect(z.toJSONSchema(def.schema)).toMatchObject({ type: "object" });
    expect(def.schema.safeParse(SAMPLES[type]).success).toBe(true);
  });

  it("only lists refinable sections that exist in the schema", () => {
    for (const key of Object.keys(def.sections)) expect(Object.keys(def.schema.shape)).toContain(key);
  });

  it("exports to Word", async () => {
    const buf = await outputToDocx(type, SAMPLES[type], { subject: "Mathematics", levelLabel: "Level 3", lessonMinutes: 60, codeText: { VC2M3N03: "fractions" } });
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });
});

describe("validateOutput", () => {
  it("drops invented codes and flags lesson timing mismatches", () => {
    const { content, warnings } = validateOutput("lesson_plan", samplePlan, mathsCtx.allowedCodes, 60);
    expect(content.curriculumLinks.map((l) => l.code)).toEqual(["VC2M3N03"]);
    expect(warnings.join(" ")).toContain("VC2M9N99");
    expect(warnings.join(" ")).toContain("55 minutes, not 60");
  });

  it("filters nested curriculumCodes", () => {
    const { content, warnings } = validateOutput("unit_plan", SAMPLES.unit_plan, mathsCtx.allowedCodes, 60);
    expect((content.lessons as { curriculumCodes: string[] }[])[0].curriculumCodes).toEqual(["VC2M3N03"]);
    expect(warnings.join(" ")).toContain("VC2X9Z99");
  });

  it("checks quiz marks and rubric descriptors", () => {
    expect(validateOutput("assessment", SAMPLES.assessment, mathsCtx.allowedCodes, 60).warnings.join(" ")).toContain("add up to 3, but total marks says 4");
    expect(validateOutput("rubric", SAMPLES.rubric, mathsCtx.allowedCodes, 60).warnings.join(" ")).toContain("one descriptor per level");
  });
});

describe("attachments", () => {
  const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64");

  it("extracts text from PDFs and reads text files", async () => {
    const pdf = await prepareAttachment({ name: "a.pdf", mediaType: "application/pdf", data: b64(makePdf("Equivalent fractions with strips")) });
    expect(pdf.text).toContain("Equivalent fractions with strips");
    await expect(prepareAttachment({ name: "bad.pdf", mediaType: "application/pdf", data: b64("not a pdf") })).rejects.toThrow(/valid PDF/);
    expect(await prepareAttachment({ name: "a.md", mediaType: "text/markdown", data: b64("# Plan\r\n\r\n\r\n\r\nFractions") })).toEqual({
      name: "a.md",
      text: "# Plan\n\nFractions",
    });
  });

  it("extracts text from Word files", async () => {
    const doc = new Document({ sections: [{ children: [new Paragraph("Lesson: equivalent fractions")] }] });
    const buf = await Packer.toBuffer(doc);
    const out = await prepareAttachment({ name: "p.docx", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", data: b64(buf) });
    expect(out.text).toContain("equivalent fractions");
  });

  it("rejects empty, invalid or overly long files instead of truncating", async () => {
    await expect(prepareAttachment({ name: "e.txt", mediaType: "text/plain", data: "" })).rejects.toBeInstanceOf(AttachmentError);
    await expect(
      prepareAttachment({ name: "bad.docx", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", data: b64("nope") }),
    ).rejects.toThrow(/valid Word/);
    await expect(prepareAttachment({ name: "big.txt", mediaType: "text/plain", data: b64("x".repeat(MAX_ATTACHMENT_TEXT + 1)) })).rejects.toThrow(/too long/);
  });
});

describe("prompt and helpers", () => {
  it("system prompt is static and covers Victorian requirements", () => {
    expect(SYSTEM_PROMPT).toMatch(/VTLM 2\.0/);
    expect(SYSTEM_PROMPT).toMatch(/synthetic phonics/);
    expect(SYSTEM_PROMPT).toMatch(/not as instructions/);
    expect(SYSTEM_PROMPT).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  });

  it("makes a safe filename", () => {
    expect(docxFilename('Fractions: "halves" & quarters!')).toBe("Fractions-halves-quarters.docx");
  });
});
