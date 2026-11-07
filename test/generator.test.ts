import { readFileSync } from "node:fs";
import path from "node:path";
import { Document, Packer, Paragraph } from "docx";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { SubjectCurriculum } from "@/lib/curriculum/types";
import { AttachmentError, MAX_ATTACHMENT_TEXT, MAX_TOTAL_ATTACHMENT_TEXT, prepareAttachment, prepareAttachments } from "@/lib/generator/attachments";
import { buildCurriculumContext, buildTeacherRequest, classLevelLabel, resolveItemCount } from "@/lib/generator/context";
import { availableFixes, rescaleMinutes } from "@/lib/generator/fixes";
import { sectionTracker } from "@/lib/generator/stream";
import { classLabel, progressMessage } from "@/lib/ui/labels";
import { exampleIdeas } from "@/lib/ui/examples";
import { OUTPUT_TYPES, OUTPUTS } from "@/lib/generator/outputs";
import { SYSTEM_PROMPT } from "@/lib/generator/pedagogy";
import { GenerateRequestSchema, type GenerateRequest } from "@/lib/generator/schema";
import { validateOutput } from "@/lib/generator/validate";
import JSZip from "jszip";
import { docxFilename, outputToDocx } from "@/lib/export/docx";
import { outputToPptx, pptxFilename } from "@/lib/export/pptx";
import { chunk } from "@/lib/export/pptx-outputs";
import { makePdf } from "./fixtures/pdf";
import { samplePlan } from "./fixtures/sample-plan";
import { SAMPLES, slideDeck } from "./fixtures/samples";

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

  it("includes the text of every reference file", () => {
    const one = buildTeacherRequest(request(), maths, mathsCtx, [{ name: "old.docx", text: "My old plan" }]);
    expect(one).toContain("uploaded a file as reference material");
    expect(one).toContain('<reference_material name="old.docx">\nMy old plan\n</reference_material>');
    const two = buildTeacherRequest(request(), maths, mathsCtx, [
      { name: "plan.pdf", text: "Plan text" },
      { name: 'deck "v2".pptx', text: "Slide 1\nHalves" },
    ]);
    expect(two).toContain("uploaded 2 files");
    expect(two).toContain(`<reference_material name="deck 'v2'.pptx">\nSlide 1\nHalves\n</reference_material>`);
    expect(buildTeacherRequest(request(), maths, mathsCtx)).not.toContain("reference_material");
  });

  it("asks for a slide deck without the automatic slides", () => {
    const text = buildTeacherRequest(request({ outputType: "slides", itemCount: 8 }), maths, mathsCtx);
    expect(text).toContain("exactly 8 content slides");
    expect(text).toContain("speakerNotes");
    expect(resolveItemCount({ outputType: "slides", itemCount: undefined })).toBe(10);
  });
});

describe("request schema", () => {
  it("accepts up to five reference files, including PowerPoint", () => {
    const base = { level: "3", subjectSlug: "mathematics", difficulty: "at", lessonMinutes: 60, idea: "" };
    const pptx = { name: "deck.pptx", mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", data: "aGk=" };
    expect(GenerateRequestSchema.safeParse({ ...base, attachments: [pptx] }).success).toBe(true);
    expect(GenerateRequestSchema.safeParse({ ...base, attachments: Array(5).fill(pptx) }).success).toBe(true);
    expect(GenerateRequestSchema.safeParse({ ...base, attachments: Array(6).fill(pptx) }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ ...base, attachment: pptx, attachments: Array(5).fill(pptx) }).success).toBe(false);
  });

  it("allows PowerPoint files up to 20 MB, other files up to 5 MB, and 40 MB in total", () => {
    const base = { level: "3", subjectSlug: "mathematics", difficulty: "at", lessonMinutes: 60, idea: "" };
    const b64 = (mb: number) => "A".repeat(Math.ceil((mb * 1024 * 1024) / 3) * 4);
    const pptx = (mb: number) => ({ name: "d.pptx", mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", data: b64(mb) });
    const pdf = (mb: number) => ({ name: "a.pdf", mediaType: "application/pdf", data: b64(mb) });
    const ok = (attachments: unknown[]) => GenerateRequestSchema.safeParse({ ...base, attachments }).success;
    expect(ok([pptx(20)])).toBe(true);
    expect(ok([pptx(20.1)])).toBe(false);
    expect(ok([pdf(5)])).toBe(true);
    expect(ok([pdf(6)])).toBe(false);
    expect(ok([pptx(19), pptx(19), pdf(1.5)])).toBe(true);
    expect(ok([pptx(19), pptx(19), pdf(3)])).toBe(false);
  });

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

  it("exports to PowerPoint, with a student copy where it applies", async () => {
    const meta = { subject: "Mathematics", levelLabel: "Year 3", lessonMinutes: 60, codeText: { VC2M3N03: "fractions" } };
    const buf = await outputToPptx(type, SAMPLES[type], meta);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const zip = await JSZip.loadAsync(buf);
    expect(Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).length).toBeGreaterThan(2);
    expect(await zip.file("ppt/slides/slide1.xml")!.async("string")).toContain(String(SAMPLES[type].title).replace(/&/g, "&amp;"));
    expect((await outputToPptx(type, SAMPLES[type], { ...meta, studentOnly: true })).subarray(0, 2).toString()).toBe("PK");
  });

  it("exports to Word", async () => {
    const buf = await outputToDocx(type, SAMPLES[type], { subject: "Mathematics", levelLabel: "Level 3", lessonMinutes: 60, codeText: { VC2M3N03: "fractions" } });
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });
});

describe("PowerPoint export", () => {
  it("makes a title slide, a learning intention slide and one slide per content slide, with notes", async () => {
    const buf = await outputToPptx("slides", slideDeck, { subject: "Mathematics", levelLabel: "Year 3", lessonMinutes: 60, codeText: { VC2M3N03: "fractions" } });
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides).toHaveLength(slideDeck.slides.length + 2);
    expect(await zip.file("ppt/slides/slide2.xml")!.async("string")).toContain("We are learning to name halves and quarters.");
    const notes = await Promise.all(Object.keys(zip.files).filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f)).map((f) => zip.file(f)!.async("string")));
    expect(notes.join(" ")).toContain("Take three answers.");
    expect(notes.join(" ")).toContain("VC2M3N03: fractions");
  });
});

describe("PowerPoint export of other types", () => {
  const meta = { subject: "Mathematics", levelLabel: "Year 3", lessonMinutes: 60, codeText: {} };
  const allText = async (buf: Buffer) => {
    const zip = await JSZip.loadAsync(buf);
    const parts = Object.keys(zip.files).filter((f) => /^ppt\/(slides|notesSlides)\/\w+\.xml$/.test(f));
    return (await Promise.all(parts.map((f) => zip.file(f)!.async("string")))).join(" ");
  };

  it("puts worksheet questions on slides and answers only in the teacher copy", async () => {
    const teacher = await allText(await outputToPptx("worksheet", SAMPLES.worksheet, meta));
    expect(teacher).toContain("Which is 1/2?");
    expect(teacher).toContain("A shape in 4 equal parts, 1 shaded");
    const student = await allText(await outputToPptx("worksheet", SAMPLES.worksheet, { ...meta, studentOnly: true }));
    expect(student).toContain("Which is 1/2?");
    expect(student).not.toContain("A shape in 4 equal parts, 1 shaded");
    expect(student).not.toContain("Answer key");
  });

  it("shows lesson phases with teacher talk in the notes, and the rubric as a table", async () => {
    const lesson = await allText(await outputToPptx("lesson_plan", SAMPLES.lesson_plan, meta));
    expect(lesson).toContain("Exit ticket");
    const rubric = await allText(await outputToPptx("rubric", SAMPLES.rubric, meta));
    expect(rubric).toContain("<a:tbl>");
  });

  it("splits long lists over several slides", () => {
    expect(chunk(["a", "b", "c", "d", "e", "f", "g"]).map((c) => c.length)).toEqual([6, 1]);
    expect(chunk(["x".repeat(300), "y".repeat(300), ""]).length).toBe(2);
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

  it("extracts slide text and speaker notes from PowerPoint files", async () => {
    const buf = await outputToPptx("slides", slideDeck, { subject: "Mathematics", levelLabel: "Year 3", lessonMinutes: 60, codeText: {} });
    const out = await prepareAttachment({ name: "d.pptx", mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", data: b64(buf) });
    expect(out.text).toMatch(/^Slide 1\nEqual parts\nHalves and quarters/);
    expect(out.text).toContain("Slide 3\nTHINK ABOUT IT\nWarm up\nIs this pizza shared fairly?");
    expect(out.text).toContain("Speaker notes: Fold a paper strip & show it.");
    expect(out.text.indexOf("Slide 4")).toBeLessThan(out.text.indexOf("Slide 7"));
    await expect(
      prepareAttachment({ name: "x.pptx", mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", data: b64("nope") }),
    ).rejects.toThrow(/valid PowerPoint/);
  });

  it("limits the combined length of several files", async () => {
    const half = b64("y".repeat(MAX_TOTAL_ATTACHMENT_TEXT / 2 - 10));
    const files = [0, 1].map((i) => ({ name: `f${i}.txt`, mediaType: "text/plain" as const, data: half }));
    expect((await prepareAttachments(files)).map((f) => f.name)).toEqual(["f0.txt", "f1.txt"]);
    await expect(prepareAttachments([...files, { name: "f2.txt", mediaType: "text/plain", data: half }])).rejects.toThrow(/Together your files are too long/);
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
    expect(pptxFilename('Fractions: "halves" & quarters!')).toBe("Fractions-halves-quarters.pptx");
  });
});

describe("composite classes", () => {
  it("merges both bands when the years are in different bands", () => {
    const ctx = buildCurriculumContext(science, "4", "at", "5")!;
    expect(ctx.band.band).toBe("Levels 3 and 4");
    expect(ctx.extra?.band).toBe("Levels 5 and 6");
    expect(ctx.allowedCodes.has("VC2S4U01")).toBe(true);
    expect(ctx.allowedCodes.has("VC2S6U01")).toBe(true);
    expect(ctx.text).toContain("composite class");
  });

  it("uses one band when both years share it, and orders levels", () => {
    const ctx = buildCurriculumContext(science, "4", "at", "3")!;
    expect(ctx.extra).toBeNull();
    expect(ctx.text).toBe(buildCurriculumContext(science, "3", "at")!.text);
  });

  it("asks for a shared lesson with adjustments for each year", () => {
    const req = request({ level: "4", secondLevel: "3" });
    const text = buildTeacherRequest(req, maths, buildCurriculumContext(maths, "4", "at", "3")!);
    expect(text).toContain("composite class of Level 3 (Year 3) and Level 4 (Year 4) students (Year 3/4)");
    expect(text).not.toContain("year 2 of the");
  });

  it("labels composite classes", () => {
    expect(classLabel("4", "3")).toBe("Year 3/4");
    expect(classLabel("1", "F")).toBe("Prep/1");
    expect(classLabel("5")).toBe("Year 5");
    expect(classLevelLabel("F", "1")).toBe("Foundation/Year 1");
  });

  it("rejects the same year twice", () => {
    expect(GenerateRequestSchema.safeParse({ ...request(), secondLevel: "3" }).success).toBe(false);
  });
});

describe("matching materials", () => {
  it("includes the source material and lets the idea be empty", () => {
    const req = request({ idea: "", outputType: "worksheet", basedOn: { outputType: "lesson_plan", title: samplePlan.title, content: samplePlan } });
    const text = buildTeacherRequest(req, maths, mathsCtx);
    expect(text).toContain(`existing lesson plan "${samplePlan.title}"`);
    expect(text).toContain(samplePlan.learningIntention);
    expect(text).not.toContain("Teacher's idea");
  });

  it("rejects oversized source material", () => {
    const big = { ...samplePlan, overview: "x".repeat(90_000) };
    expect(GenerateRequestSchema.safeParse({ ...request(), basedOn: { outputType: "lesson_plan", title: "t", content: big } }).success).toBe(false);
  });
});

describe("quick fixes", () => {
  it("rescales minutes to the exact total, keeping proportions", () => {
    const out = rescaleMinutes([5, 5, 15, 15, 20, 5], 50);
    expect(out.reduce((a, b) => a + b, 0)).toBe(50);
    expect(out[4]).toBeGreaterThan(out[0]);
    expect(rescaleMinutes([0, 0, 0], 30)).toEqual([10, 10, 10]);
    expect(rescaleMinutes([10, 10], 45).reduce((a, b) => a + b, 0)).toBe(45);
    for (const target of [15, 37, 60, 90, 180]) expect(rescaleMinutes([3, 7, 12, 20, 9, 4], target).reduce((a, b) => a + b, 0)).toBe(target);
  });

  it("offers a timing fix that clears the validator warning", () => {
    const fixes = availableFixes("lesson_plan", samplePlan, 45);
    expect(fixes.map((f) => f.id)).toEqual(["timings"]);
    const fixed = fixes[0].apply(samplePlan);
    expect(validateOutput("lesson_plan", fixed, mathsCtx.allowedCodes, 45).warnings.some((w) => w.startsWith(fixes[0].warningPrefix))).toBe(false);
    expect(availableFixes("lesson_plan", fixed, 45)).toEqual([]);
  });

  it("offers a total-marks fix for quizzes", () => {
    const quiz = { ...SAMPLES.assessment, totalMarks: 999 };
    const [fix] = availableFixes("assessment", quiz, 60);
    expect(fix.id).toBe("marks");
    expect(availableFixes("assessment", fix.apply(quiz), 60)).toEqual([]);
  });
});

describe("progress messages", () => {
  it("tracks the section being written from streamed JSON", () => {
    const track = sectionTracker(["overview", "phases", "teacherNotes"]);
    expect(track('{"title":"A","over')).toBeUndefined();
    expect(track('{"title":"A","overview":"x","vocabulary":[{"term":"a"}],"phases":[{"teacher":["')).toBe("phases");
    expect(track('{"title":"A","overview":"x","vocabulary":[{"term":"a"}],"phases":[{"teacher":["a"]}],"teacherNotes":[')).toBe("teacherNotes");
  });

  it("speaks plain English", () => {
    const labels = OUTPUTS.lesson_plan.sections;
    expect(progressMessage(labels, 0)).toBe("Reading the curriculum and planning…");
    expect(progressMessage(labels, 3000, "phases")).toBe("Writing the lesson sequence…");
    expect(progressMessage(OUTPUTS.differentiation.sections, 3000, "ealDAdjustments")).toBe("Writing the EAL/D adjustments…");
  });

  it("has example ideas for every subject and level", () => {
    for (const slug of ["mathematics", "english", "dance"]) for (const l of ["F", "4"] as const) expect(exampleIdeas(slug, l).length).toBeGreaterThan(0);
  });
});

describe("student copies in Word", () => {
  it("leaves out the answer key", async () => {
    const meta = { subject: "Maths", levelLabel: "Year 3", lessonMinutes: 60, codeText: {} };
    for (const type of ["worksheet", "assessment", "differentiation"] as const) {
      const full = await outputToDocx(type, SAMPLES[type], meta);
      const student = await outputToDocx(type, SAMPLES[type], { ...meta, studentOnly: true });
      expect(student.length).toBeLessThan(full.length);
    }
  });
});
