import PptxGenJS from "pptxgenjs";
import type { OutputType } from "../generator/outputs";
import { OUTPUTS } from "../generator/outputs";
import { outputToDeck } from "./pptx-outputs";

/** Same palette as the app (tailwind.config.ts), without the leading #. */
const C = {
  ink: "17202A",
  soft: "3D4852",
  muted: "55606B",
  paper: "FBFBF8",
  line: "C9CDC4",
  euc: "1E5A43",
  eucDark: "123B2B",
  eucTint: "E6F0EA",
  wattle: "F2B53A",
  wattleTint: "FDF1D8",
  white: "FFFFFF",
};
const FONT = "Calibri";

/** 16:9, 13.333 × 7.5 inches. */
const W = 13.333;
const H = 7.5;
const M = 0.6;
const TOP = 1.65;
const BODY_H = H - TOP - 0.8;

export interface PptxMeta {
  subject: string;
  levelLabel: string;
  lessonMinutes: number;
  /** code → content description text, for the notes on the opening slides. */
  codeText: Record<string, string>;
  /** Student copy: no answers, marking guides or teacher notes. */
  studentOnly?: boolean;
}

export const EXPORT_LAYOUTS = ["Bullets", "Two columns", "Question", "Activity", "Big idea", "Table"] as const;

/** One slide of an exported deck. Every output type is converted to these (see pptx-outputs.ts). */
export interface ExportSlide {
  layout: (typeof EXPORT_LAYOUTS)[number];
  heading: string;
  /** Small label above the heading; defaults to one based on the layout. */
  tag?: string;
  bullets: string[];
  /** Right-hand column (Two columns), or a side panel (Bullets and Activity). */
  secondColumn?: string[];
  /** Title of the side panel, e.g. "You need". */
  sideTitle?: string;
  /** Rows for the Table layout; the first row is the header. */
  table?: string[][];
  imageIdea?: string;
  speakerNotes?: string;
}

export interface ExportDeck {
  title: string;
  subtitle: string;
  /** Speaker notes on the title slide. */
  titleNotes: string;
  /** With success criteria, makes the second slide; skipped when both are empty. */
  learningIntention: string;
  successCriteria: string[];
  curriculumLinks: { code: string; howAddressed: string }[];
  slides: ExportSlide[];
}

type Slide = ReturnType<PptxGenJS["addSlide"]>;

const LAYOUT_TAGS: Partial<Record<ExportSlide["layout"], string>> = { Question: "Think about it", Activity: "Your turn", "Big idea": "Big idea" };

const bulletRuns = (items: string[], fontSize: number, color = C.ink) =>
  items
    .filter((t) => t.trim())
    // Checklist items ("☐ I can…") carry their own box instead of a bullet.
    .map((text) => ({ text, options: { bullet: text.startsWith("☐") ? false : { indent: fontSize * 0.9 }, fontSize, color, breakLine: true, paraSpaceAfter: fontSize * 0.45 } }));

const numberedRuns = (items: string[], fontSize: number) =>
  items
    .filter((t) => t.trim())
    .map((text) => ({ text, options: { bullet: { type: "number" as const, indent: fontSize * 1.1 }, fontSize, color: C.ink, breakLine: true, paraSpaceAfter: fontSize * 0.45 } }));

/** Smaller text when there is more of it, so slides don't overflow. */
function fitSize(items: string[], base: number) {
  const chars = items.join(" ").length;
  if (chars > 520) return base - 8;
  if (chars > 380) return base - 6;
  if (chars > 260) return base - 3;
  return base;
}

function footer(slide: Slide, text: string, n: number) {
  slide.addShape("rect", { x: 0, y: H - 0.12, w: W, h: 0.12, fill: { color: C.euc }, line: { color: C.euc } });
  slide.addText(text, { x: M, y: H - 0.55, w: W - 2 * M - 1, h: 0.35, fontFace: FONT, fontSize: 11, color: C.muted });
  slide.addText(String(n), { x: W - M - 1, y: H - 0.55, w: 1, h: 0.35, fontFace: FONT, fontSize: 11, color: C.muted, align: "right" });
}

function heading(slide: Slide, text: string, tag?: string) {
  slide.addShape("rect", { x: M, y: 0.55, w: 0.12, h: 0.75, fill: { color: C.wattle }, line: { color: C.wattle } });
  if (tag) {
    slide.addText(tag.toUpperCase(), { x: M + 0.3, y: 0.32, w: 9, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.euc, charSpacing: 2 });
  }
  slide.addText(text, { x: M + 0.3, y: 0.55, w: W - 2 * M - 0.3, h: 0.8, fontFace: FONT, fontSize: 34, bold: true, color: C.eucDark, valign: "middle", fit: "shrink" });
}

/** A dashed box suggesting a picture; the teacher replaces it with their own image. */
function picture(slide: Slide, idea: string, x: number, y: number, w: number, h: number) {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.12, fill: { color: C.eucTint }, line: { color: C.euc, width: 1.25, dashType: "dash" } });
  slide.addText(
    [
      { text: "Picture idea", options: { bold: true, fontSize: 14, color: C.euc, breakLine: true } },
      { text: idea, options: { fontSize: 14, color: C.soft } },
    ],
    { x: x + 0.25, y: y + 0.25, w: w - 0.5, h: h - 0.5, fontFace: FONT, align: "center", valign: "middle", fit: "shrink" },
  );
}

/** A tinted panel with a title and a list, e.g. "You need" next to activity steps. */
function sidePanel(slide: Slide, title: string, items: string[], x: number, y: number, w: number, h: number) {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.12, fill: { color: C.wattleTint }, line: { color: C.wattle, width: 1 } });
  slide.addText(
    [{ text: title, options: { bold: true, fontSize: 16, color: C.ink, breakLine: true, paraSpaceAfter: 6 } }, ...bulletRuns(items, fitSize(items, 18), C.soft)],
    { x: x + 0.2, y: y + 0.2, w: w - 0.4, h: h - 0.4, fontFace: FONT, valign: "top", fit: "shrink" },
  );
}

function table(slide: Slide, rows: string[][]) {
  const cols = Math.max(...rows.map((r) => r.length));
  const longest = Math.max(...rows.flat().map((c) => c.length));
  const size = cols > 4 || longest > 140 ? 11 : cols > 3 || longest > 90 ? 13 : 15;
  const colW = (W - 2 * M) / cols;
  slide.addTable(
    rows.map((r, i) =>
      Array.from({ length: cols }, (_, j) => ({
        text: r[j] ?? "",
        options: {
          bold: i === 0 || j === 0,
          color: i === 0 ? C.white : C.ink,
          fill: { color: i === 0 ? C.euc : j === 0 ? C.eucTint : C.white },
        },
      })),
    ),
    { x: M, y: TOP, w: W - 2 * M, colW: Array(cols).fill(colW), fontFace: FONT, fontSize: size, valign: "top", border: { type: "solid", pt: 0.75, color: C.line }, margin: 0.08, autoPage: false },
  );
}

function contentSlide(pptx: PptxGenJS, s: ExportSlide, footText: string, n: number) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  const second = (s.secondColumn ?? []).filter((t) => t.trim());
  const idea = s.imageIdea?.trim() ?? "";
  const side = s.layout !== "Two columns" && s.layout !== "Table" && (second.length > 0 || Boolean(idea));
  const textW = side ? 7.4 : W - 2 * M;
  heading(slide, s.heading, s.tag ?? LAYOUT_TAGS[s.layout]);

  switch (s.layout) {
    case "Question": {
      slide.addShape("roundRect", { x: M, y: TOP, w: textW, h: BODY_H, rectRadius: 0.2, fill: { color: C.wattleTint }, line: { color: C.wattle, width: 1.5 } });
      const [question, ...rest] = s.bullets.filter((b) => b.trim());
      const qSize = (question ?? "").length > 160 ? 24 : 30;
      slide.addText(
        [
          { text: question ?? s.heading, options: { fontSize: qSize, bold: true, color: C.ink, breakLine: rest.length > 0, paraSpaceAfter: 14 } },
          ...rest.map((t, i) => ({ text: t, options: { fontSize: 22, color: C.soft, breakLine: i < rest.length - 1 } })),
        ],
        { x: M + 0.4, y: TOP + 0.3, w: textW - 0.8, h: BODY_H - 0.6, fontFace: FONT, align: "center", valign: "middle", fit: "shrink" },
      );
      break;
    }
    case "Big idea": {
      const [first, ...rest] = s.bullets.filter((b) => b.trim());
      slide.addText(
        [
          { text: first ?? s.heading, options: { fontSize: (first ?? "").length > 120 ? 28 : 38, bold: true, color: C.eucDark, breakLine: rest.length > 0, paraSpaceAfter: 16 } },
          ...rest.map((t, i) => ({ text: t, options: { fontSize: 22, color: C.soft, breakLine: i < rest.length - 1 } })),
        ],
        { x: M, y: TOP, w: textW, h: BODY_H, fontFace: FONT, align: "center", valign: "middle", fit: "shrink" },
      );
      break;
    }
    case "Activity":
      slide.addText(numberedRuns(s.bullets, fitSize(s.bullets, 24)), { x: M, y: TOP, w: textW, h: BODY_H, fontFace: FONT, valign: "top", fit: "shrink" });
      break;
    case "Two columns": {
      const colW = (W - 2 * M - 0.5) / 2;
      const size = fitSize([...s.bullets, ...second], 24);
      for (const [k, items] of [s.bullets, second].entries()) {
        const x = M + k * (colW + 0.5);
        slide.addShape("roundRect", { x, y: TOP, w: colW, h: BODY_H, rectRadius: 0.15, fill: { color: C.paper }, line: { color: C.line } });
        slide.addText(bulletRuns(items, size), { x: x + 0.25, y: TOP + 0.2, w: colW - 0.5, h: BODY_H - 0.4, fontFace: FONT, valign: "top", fit: "shrink" });
      }
      break;
    }
    case "Table":
      if (s.table?.length) table(slide, s.table);
      break;
    default:
      slide.addText(bulletRuns(s.bullets, fitSize(s.bullets, 26)), { x: M, y: TOP, w: textW, h: BODY_H, fontFace: FONT, valign: "top", fit: "shrink" });
  }
  if (side) {
    const x = M + textW + 0.4;
    const w = W - 2 * M - textW - 0.4;
    if (second.length && idea) {
      sidePanel(slide, s.sideTitle ?? "", second, x, TOP, w, BODY_H / 2 - 0.1);
      picture(slide, idea, x, TOP + BODY_H / 2 + 0.1, w, BODY_H / 2 - 0.1);
    } else if (second.length) sidePanel(slide, s.sideTitle ?? "", second, x, TOP, w, BODY_H);
    else picture(slide, idea, x, TOP, w, BODY_H);
  }
  if (s.speakerNotes?.trim()) slide.addNotes(s.speakerNotes);
  footer(slide, footText, n);
}

/** Builds an editable PowerPoint (.pptx) from a deck. */
export function buildPresentation(deck: ExportDeck, m: PptxMeta): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title;
  pptx.subject = `${m.subject} · ${m.levelLabel}`;
  pptx.company = "Lessonroo";
  pptx.author = "Lessonroo";
  const footText = `${deck.title} · ${m.levelLabel} ${m.subject}`;
  let n = 1;

  // Title slide.
  const title = pptx.addSlide();
  title.background = { color: C.eucDark };
  title.addShape("rect", { x: M, y: 2.35, w: 1.4, h: 0.12, fill: { color: C.wattle }, line: { color: C.wattle } });
  title.addText(deck.title, { x: M, y: 2.6, w: W - 2 * M, h: 1.6, fontFace: FONT, fontSize: 48, bold: true, color: C.white, valign: "top", fit: "shrink" });
  if (deck.subtitle.trim()) {
    title.addText(deck.subtitle, { x: M, y: 4.25, w: W - 2 * M, h: 0.8, fontFace: FONT, fontSize: 24, color: C.wattle, valign: "top", fit: "shrink" });
  }
  title.addText(`${m.levelLabel} · ${m.subject}`, { x: M, y: H - 1.2, w: W - 2 * M, h: 0.5, fontFace: FONT, fontSize: 16, color: "DCE8E1" });
  const curriculumNotes = m.studentOnly ? [] : deck.curriculumLinks.map((l) => `${l.code}: ${[m.codeText[l.code], l.howAddressed].filter(Boolean).join(" ")}`);
  const titleNotes = [deck.titleNotes, curriculumNotes.length ? `Victorian Curriculum 2.0\n${curriculumNotes.join("\n")}` : ""].filter((t) => t.trim()).join("\n\n");
  if (titleNotes) title.addNotes(titleNotes);

  // Learning intention and success criteria.
  const criteria = deck.successCriteria.filter((c) => c.trim());
  if (deck.learningIntention.trim() || criteria.length) {
    const li = pptx.addSlide();
    li.background = { color: C.white };
    heading(li, "Today we are learning", "Learning intention");
    let y = TOP;
    if (deck.learningIntention.trim()) {
      li.addShape("roundRect", { x: M, y, w: W - 2 * M, h: 1.3, rectRadius: 0.15, fill: { color: C.eucTint }, line: { color: C.eucTint } });
      li.addText(deck.learningIntention, { x: M + 0.3, y: y + 0.05, w: W - 2 * M - 0.6, h: 1.2, fontFace: FONT, fontSize: 26, bold: true, color: C.eucDark, valign: "middle", fit: "shrink" });
      y += 1.55;
    }
    if (criteria.length) {
      li.addText("Success criteria", { x: M, y, w: 6, h: 0.45, fontFace: FONT, fontSize: 18, bold: true, color: C.euc });
      li.addText(
        criteria.map((text) => ({ text, options: { bullet: { code: "2610", indent: 26 }, fontSize: 22, color: C.ink, breakLine: true, paraSpaceAfter: 8 } })),
        { x: M, y: y + 0.5, w: W - 2 * M, h: H - y - 0.5 - 0.8, fontFace: FONT, valign: "top", fit: "shrink" },
      );
    }
    footer(li, footText, ++n);
  }

  for (const s of deck.slides) contentSlide(pptx, s, footText, ++n);
  return pptx;
}

/** Any output type as an editable PowerPoint file. */
export async function outputToPptx(outputType: OutputType, content: Record<string, unknown>, m: PptxMeta): Promise<Buffer> {
  const deck = outputToDeck(outputType, content, { studentOnly: Boolean(m.studentOnly), lessonMinutes: m.lessonMinutes, typeLabel: OUTPUTS[outputType].label });
  const out = await buildPresentation(deck, m).write({ outputType: "nodebuffer" });
  return out as Buffer;
}

export function pptxFilename(title: string) {
  return `${title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "lessonroo"}.pptx`;
}
