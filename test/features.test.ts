/** Adapting an uploaded plan, slide themes and photos, and the games and puzzles exports. */
import { readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import mammoth from "mammoth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubjectCurriculum } from "@/lib/curriculum/types";
import { outputToDocx } from "@/lib/export/docx";
import { clearImageCache, creditFor, findImage, findImages, imageInfo, MAX_PHOTOS_PER_DECK } from "@/lib/export/images";
import { outputToPptx } from "@/lib/export/pptx";
import { THEMES, themeById } from "@/lib/export/themes";
import { adaptInstructions } from "@/lib/generator/adapt";
import { buildCurriculumContext, buildTeacherRequest } from "@/lib/generator/context";
import { GenerateRequestSchema, type SlideDeck } from "@/lib/generator/schema";
import { refreshWarnings, validateOutput } from "@/lib/generator/validate";
import { defOf, unwrap } from "@/lib/ui/editor-schema";
import { SlideDeckSchema } from "@/lib/generator/schema";
import { SAMPLES, slideDeck } from "./fixtures/samples";

const maths = JSON.parse(readFileSync(path.join(__dirname, "../data/curriculum/vc2/mathematics.json"), "utf8")) as SubjectCurriculum;
const ctx = buildCurriculumContext(maths, "3", "at")!;
const vlp = { name: "VLP Maths L3 Fractions.pptx", text: "Slide 1\nLearning intention: We are learning to make equal parts\nDaily review: count by halves" };

describe("adapting an uploaded plan", () => {
  it("accepts adapt goals and rejects unknown ones", () => {
    const base = { level: "3", subjectSlug: "mathematics", idea: "", difficulty: "at", lessonMinutes: 45, attachments: [{ name: "a.txt", mediaType: "text/plain", data: "aGVsbG8=" }] };
    expect(GenerateRequestSchema.parse({ ...base, adapt: { goals: ["fit_length", "eald"] } }).adapt?.goals).toEqual(["fit_length", "eald"]);
    expect(GenerateRequestSchema.safeParse({ ...base, adapt: { goals: ["rewrite_everything"] } }).success).toBe(false);
  });

  it("tells the model to keep the plan and make only the ticked changes", () => {
    const req = GenerateRequestSchema.parse({ level: "3", subjectSlug: "mathematics", difficulty: "at", lessonMinutes: 45, idea: "", attachments: [{ name: "x.txt", mediaType: "text/plain", data: "eA==" }], adapt: { goals: ["fit_length", "eald"] } });
    const text = buildTeacherRequest(req, maths, ctx, [vlp]);
    expect(text).toContain("ADAPT, DON'T REPLACE");
    expect(text).toContain("Victorian Lesson Plan");
    expect(text).toContain("Fit the lesson length");
    expect(text).toContain("EAL/D");
    expect(text).not.toContain("more hands-on");
    expect(text).toContain('<plan_to_adapt name="VLP Maths L3 Fractions.pptx">');
    expect(text).toContain('start with "Adapted from VLP Maths L3 Fractions.pptx:"');
    expect(text).not.toContain("<reference_material");
  });

  it("uses files as ideas when not adapting, and ignores adapt without files", () => {
    const req = GenerateRequestSchema.parse({ level: "3", subjectSlug: "mathematics", difficulty: "at", lessonMinutes: 45, idea: "Fractions" });
    expect(buildTeacherRequest(req, maths, ctx, [vlp])).toContain("<reference_material");
    expect(adaptInstructions({ goals: ["eald"] }, "lesson_plan", [])).toBe("");
  });

  it("lists the changes in moderation notes for a rubric and nowhere for a note home", () => {
    expect(adaptInstructions({ goals: [] }, "rubric", ["a.docx"])).toContain("first item of moderationNotes");
    expect(adaptInstructions({ goals: [] }, "parent_note", ["a.docx"])).not.toContain("first item of");
    expect(adaptInstructions({ goals: [] }, "lesson_plan", ["a.docx"])).toContain("Change only what is needed");
  });
});

/* -------------------------------- photos -------------------------------- */

/** A 1×1 PNG with its real size header. */
function png(width: number, height: number) {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function fakeOpenverse(results: Record<string, unknown>[], image = png(400, 300)) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.startsWith("https://api.openverse.org/v1/images/?")) return new Response(JSON.stringify({ results }), { status: 200 });
    if (u.startsWith("https://api.openverse.org/v1/images/") && u.endsWith("/thumb/")) return new Response(image, { status: 200 });
    return new Response("no", { status: 404 });
  });
}

const koala = { id: "k1", title: "Koala", creator: "Jo Smith", license: "by", license_version: "2.0", foreign_landing_url: "https://flickr.com/k1", thumbnail: "https://api.openverse.org/v1/images/k1/thumb/", mature: false };

describe("photos for slides", () => {
  beforeEach(() => clearImageCache());

  it("reads image sizes from PNG and JPEG headers", () => {
    expect(imageInfo(png(640, 480))).toEqual({ mime: "image/png", width: 640, height: 480 });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03]);
    expect(imageInfo(jpeg)).toEqual({ mime: "image/jpeg", width: 640, height: 480 });
    expect(imageInfo(Buffer.from("<html>"))).toBeNull();
  });

  it("credits the photo as its licence asks", () => {
    expect(creditFor(koala)).toBe('Photo: "Koala" by Jo Smith, CC BY 2.0');
    expect(creditFor({ title: "", creator: "", license: "cc0", license_version: "1.0" })).toBe("Photo, CC0");
  });

  it("finds a photo, skipping mature results and thumbnails on other hosts", async () => {
    const f = fakeOpenverse([
      { ...koala, id: "m", mature: true },
      { ...koala, id: "evil", thumbnail: "https://evil.example/x.jpg" },
      koala,
    ]);
    const img = await findImage("koala tree", f as unknown as typeof fetch);
    expect(img?.credit).toBe('Photo: "Koala" by Jo Smith, CC BY 2.0');
    expect(img?.data.startsWith("image/png;base64,")).toBe(true);
    expect(img).toMatchObject({ width: 400, height: 300, sourceUrl: "https://flickr.com/k1" });
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("mature=false");
    expect(urls.some((u) => u.includes("evil.example"))).toBe(false);
  });

  it("gives null when Openverse fails or returns a non-image, without caching the outage", async () => {
    const down = vi.fn(async () => new Response("busy", { status: 429 }));
    expect(await findImage("koala", down as unknown as typeof fetch)).toBeNull();
    expect(await findImage("koala", fakeOpenverse([koala]) as unknown as typeof fetch)).not.toBeNull();
    expect(await findImage("wombat", fakeOpenverse([koala], Buffer.from("<html>")) as unknown as typeof fetch)).toBeNull();
  });

  it("looks up searches in order, skipping empty ones, up to the per-deck limit", async () => {
    const f = fakeOpenverse([koala]);
    const queries = ["", ...Array.from({ length: MAX_PHOTOS_PER_DECK + 3 }, (_, i) => `animal ${i}`)];
    const out = await findImages(queries, f as unknown as typeof fetch);
    expect(out[0]).toBeNull();
    expect(out.filter(Boolean)).toHaveLength(MAX_PHOTOS_PER_DECK);
  });

  it("puts photos and credits in the PowerPoint", async () => {
    const f = fakeOpenverse([koala]);
    const deck: SlideDeck = { ...slideDeck };
    const meta = { subject: "Mathematics", levelLabel: "Year 3", lessonMinutes: 60, codeText: {}, findPhotos: (q: string[]) => findImages(q, f as unknown as typeof fetch) };
    const zip = await JSZip.loadAsync(await outputToPptx("slides", deck, meta));
    expect(Object.keys(zip.files).some((n) => n.startsWith("ppt/media/"))).toBe(true);
    // Slide 3 is the first content slide, the only one with search words.
    const slide3 = await zip.file("ppt/slides/slide3.xml")!.async("string");
    expect(slide3).toContain("Photo: &quot;Koala&quot; by Jo Smith, CC BY 2.0");
    expect(slide3).not.toContain("Picture idea");
    const notes = await Promise.all(Object.keys(zip.files).filter((n) => n.startsWith("ppt/notesSlides/notesSlide")).map((n) => zip.file(n)!.async("string")));
    expect(notes.join(" ")).toContain("https://flickr.com/k1");
    // Only the slide with search words was looked up.
    expect(f.mock.calls.filter((c) => String(c[0]).includes("?q=")).map((c) => new URL(String(c[0])).searchParams.get("q"))).toEqual(["pizza slices"]);
  });

  it("keeps the picture idea box when no photo is found", async () => {
    const meta = { subject: "Mathematics", levelLabel: "Year 3", lessonMinutes: 60, codeText: {}, findPhotos: async (q: string[]) => q.map(() => null) };
    const zip = await JSZip.loadAsync(await outputToPptx("slides", slideDeck, meta));
    expect(await zip.file("ppt/slides/slide3.xml")!.async("string")).toContain("Picture idea");
  });

  it("reads older decks without photo search words", () => {
    const old = structuredClone(slideDeck) as unknown as { slides: Record<string, unknown>[] };
    for (const s of old.slides) delete s.imageSearch;
    const parsed = SlideDeckSchema.parse(old);
    expect(parsed.slides[0].imageSearch).toBe("");
    // The hand-editing form treats the defaulted field as plain text.
    const field = SlideDeckSchema.shape.slides.element.shape.imageSearch;
    expect(defOf(field).type).toBe("string");
    expect(unwrap(field)).not.toBe(field);
  });
});

/* -------------------------------- themes -------------------------------- */

/** WCAG relative luminance contrast ratio of two hex colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe("slide themes", () => {
  it.each(THEMES.map((t) => [t.id, t] as const))("%s keeps text readable", (_id, t) => {
    expect(contrast(t.ink, t.background)).toBeGreaterThanOrEqual(7);
    expect(contrast(t.soft, t.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.muted, t.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("FFFFFF", t.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("FFFFFF", t.accentDark)).toBeGreaterThanOrEqual(7);
    expect(contrast(t.accentDark, t.accentTint)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.ink, t.highlightTint)).toBeGreaterThanOrEqual(7);
    expect(contrast(t.highlight, t.accentDark)).toBeGreaterThanOrEqual(3);
  });

  it("falls back to the default theme", () => {
    expect(themeById("nope").id).toBe("eucalypt");
  });

  it("uses the theme's colours and font in the PowerPoint", async () => {
    const meta = { subject: "Mathematics", levelLabel: "Year 3", lessonMinutes: 60, codeText: {} };
    const zip = await JSZip.loadAsync(await outputToPptx("slides", slideDeck, { ...meta, theme: "playful" }));
    const title = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(title).toContain(themeById("playful").accentDark);
    expect(title).toContain("Century Gothic");
    const plain = await (await JSZip.loadAsync(await outputToPptx("slides", slideDeck, meta))).file("ppt/slides/slide1.xml")!.async("string");
    expect(plain).toContain(themeById("eucalypt").accentDark);
  });
});

/* ---------------------------- games and puzzles ---------------------------- */

describe("games and puzzles", () => {
  const pack = SAMPLES.puzzles;

  it("validates without warnings and warns after a bad edit", () => {
    const { warnings } = validateOutput("puzzles", pack, ctx.allowedCodes, 60, "3");
    expect(warnings).toEqual([]);
    const edited = { ...pack, bingo: { instructions: "", items: [] } };
    expect(refreshWarnings("puzzles", edited, 60, [], "3").some((w) => w.startsWith("Bingo needs at least"))).toBe(true);
  });

  it("prints the crossword clues, bingo cards and answers in Word", async () => {
    const meta = { subject: "Mathematics", levelLabel: "Year 3", lessonMinutes: 60, codeText: {}, level: "3" as const };
    const teacher = (await mammoth.extractRawText({ buffer: await outputToDocx("puzzles", pack, meta) })).value;
    expect(teacher).toContain("The top number in a fraction");
    expect(teacher).toContain("Card 24");
    expect(teacher).toContain("Answers: crossword");
    expect(teacher).toContain("Bingo calling list");
    const student = (await mammoth.extractRawText({ buffer: await outputToDocx("puzzles", pack, { ...meta, studentOnly: true }) })).value;
    expect(student).toContain("The top number in a fraction");
    expect(student).not.toContain("Answers: crossword");
    expect(student).not.toContain("Bingo calling list");
  });

  it("projects bingo calls one per slide with answers only in the teacher copy", async () => {
    const meta = { subject: "Mathematics", levelLabel: "Year 3", lessonMinutes: 60, codeText: {}, level: "3" as const };
    const text = async (buf: Buffer) => {
      const zip = await JSZip.loadAsync(buf);
      return (await Promise.all(Object.keys(zip.files).filter((f) => /^ppt\/(slides|notesSlides)\/\w+\.xml$/.test(f)).map((f) => zip.file(f)!.async("string")))).join(" ");
    };
    const teacher = await text(await outputToPptx("puzzles", pack, meta));
    expect(teacher).toContain("Call 24");
    expect(teacher).toContain("Word search answers");
    expect(teacher).toContain("Answer: 1/2");
    const student = await text(await outputToPptx("puzzles", pack, { ...meta, studentOnly: true }));
    expect(student).toContain("Call 24");
    expect(student).not.toContain("Word search answers");
    expect(student).not.toContain("Answer: 1/2");
  });
});
