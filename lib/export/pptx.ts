import PptxGenJS from "pptxgenjs";
import type { PrimaryLevel } from "../curriculum/types";
import type { OutputType } from "../generator/outputs";
import { OUTPUTS } from "../generator/outputs";
import type { SlideImage } from "./images";
import { outputToDeck } from "./pptx-outputs";
import { themeById, type DeckTheme } from "./themes";

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
  /** Year level of the class (games and puzzles are laid out for it). */
  level?: PrimaryLevel;
  /** Look of the deck (lib/export/themes.ts). */
  theme?: string;
  /** Finds photos for slides that have photo search words (see images.ts). */
  findPhotos?: (queries: string[]) => Promise<(SlideImage | null)[]>;
}

export const EXPORT_LAYOUTS = ["Bullets", "Two columns", "Question", "Activity", "Big idea", "Table", "Grid"] as const;

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
  /** Letter grid for the Grid layout (word search, crossword, bingo card); null = no square. */
  grid?: (string | null)[][];
  /** Grid squares to shade (answers). */
  shade?: boolean[][];
  /** Clue numbers in the corner of grid squares. */
  numbers?: (number | null)[][];
  imageIdea?: string;
  /** Keywords for a real photo (slide decks). */
  imageSearch?: string;
  /** The photo found for imageSearch, drawn in place of the picture idea. */
  image?: SlideImage | null;
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

const bulletRuns = (t: DeckTheme, items: string[], fontSize: number, color = t.ink) =>
  items
    .filter((x) => x.trim())
    // Checklist items ("☐ I can…") carry their own box instead of a bullet.
    .map((text) => ({ text, options: { bullet: text.startsWith("☐") ? false : { indent: fontSize * 0.9 }, fontSize, color, breakLine: true, paraSpaceAfter: fontSize * 0.45 } }));

const numberedRuns = (t: DeckTheme, items: string[], fontSize: number) =>
  items
    .filter((x) => x.trim())
    .map((text) => ({ text, options: { bullet: { type: "number" as const, indent: fontSize * 1.1 }, fontSize, color: t.ink, breakLine: true, paraSpaceAfter: fontSize * 0.45 } }));

/** Smaller text when there is more of it, so slides don't overflow. */
function fitSize(items: string[], base: number) {
  const chars = items.join(" ").length;
  if (chars > 520) return base - 8;
  if (chars > 380) return base - 6;
  if (chars > 260) return base - 3;
  return base;
}

function footer(t: DeckTheme, slide: Slide, text: string, n: number) {
  slide.addShape("rect", { x: 0, y: H - 0.12, w: W, h: 0.12, fill: { color: t.accent }, line: { color: t.accent } });
  slide.addText(text, { x: M, y: H - 0.55, w: W - 2 * M - 1, h: 0.35, fontFace: t.font, fontSize: 11, color: t.muted });
  slide.addText(String(n), { x: W - M - 1, y: H - 0.55, w: 1, h: 0.35, fontFace: t.font, fontSize: 11, color: t.muted, align: "right" });
}

function heading(t: DeckTheme, slide: Slide, text: string, tag?: string) {
  slide.addShape("rect", { x: M, y: 0.55, w: 0.12, h: 0.75, fill: { color: t.highlight }, line: { color: t.highlight } });
  if (tag) {
    slide.addText(tag.toUpperCase(), { x: M + 0.3, y: 0.32, w: 9, h: 0.3, fontFace: t.font, fontSize: 12, bold: true, color: t.accent, charSpacing: 2 });
  }
  slide.addText(text, { x: M + 0.3, y: 0.55, w: W - 2 * M - 0.3, h: 0.8, fontFace: t.font, fontSize: 34, bold: true, color: t.accentDark, valign: "middle", fit: "shrink" });
}

/** A dashed box suggesting a picture; the teacher replaces it with their own image. */
function picture(t: DeckTheme, slide: Slide, idea: string, x: number, y: number, w: number, h: number) {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.12, fill: { color: t.accentTint }, line: { color: t.accent, width: 1.25, dashType: "dash" } });
  slide.addText(
    [
      { text: "Picture idea", options: { bold: true, fontSize: 14, color: t.accent, breakLine: true } },
      { text: idea, options: { fontSize: 14, color: t.soft } },
    ],
    { x: x + 0.25, y: y + 0.25, w: w - 0.5, h: h - 0.5, fontFace: t.font, align: "center", valign: "middle", fit: "shrink" },
  );
}

/** A photo fitted inside the box (keeping its shape), with its licence credit underneath. */
function photo(t: DeckTheme, slide: Slide, img: SlideImage, x: number, y: number, w: number, h: number) {
  const captionH = 0.32;
  const boxH = h - captionH;
  const ratio = img.width / img.height;
  const pw = Math.min(w, boxH * ratio);
  const ph = pw / ratio;
  slide.addImage({ data: img.data, x: x + (w - pw) / 2, y: y + (boxH - ph) / 2, w: pw, h: ph, altText: img.credit });
  slide.addText(img.credit, { x, y: y + boxH + 0.02, w, h: captionH, fontFace: t.font, fontSize: 9, color: t.muted, align: "center", valign: "top", fit: "shrink" });
}

/** A tinted panel with a title and a list, e.g. "You need" next to activity steps. */
function sidePanel(t: DeckTheme, slide: Slide, title: string, items: string[], x: number, y: number, w: number, h: number) {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.12, fill: { color: t.highlightTint }, line: { color: t.highlight, width: 1 } });
  slide.addText(
    [{ text: title, options: { bold: true, fontSize: 16, color: t.ink, breakLine: true, paraSpaceAfter: 6 } }, ...bulletRuns(t, items, fitSize(items, 18), t.soft)],
    { x: x + 0.2, y: y + 0.2, w: w - 0.4, h: h - 0.4, fontFace: t.font, valign: "top", fit: "shrink" },
  );
}

function table(t: DeckTheme, slide: Slide, rows: string[][]) {
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
          color: i === 0 ? "FFFFFF" : t.ink,
          fill: { color: i === 0 ? t.accent : j === 0 ? t.accentTint : t.background },
        },
      })),
    ),
    { x: M, y: TOP, w: W - 2 * M, colW: Array(cols).fill(colW), fontFace: t.font, fontSize: size, valign: "top", border: { type: "solid", pt: 0.75, color: t.line }, margin: 0.08, autoPage: false },
  );
}

/** Square letter grid on the left, with an optional list (e.g. the words to find) on the right. */
function letterGrid(t: DeckTheme, slide: Slide, s: ExportSlide) {
  const grid = s.grid ?? [];
  const rows = grid.length;
  const cols = Math.max(0, ...grid.map((r) => r.length));
  if (!rows || !cols) return;
  const list = (s.bullets ?? []).filter((x) => x.trim());
  const areaW = list.length ? Math.min(W - 2 * M - 4, BODY_H * 1.4) : W - 2 * M;
  // Bigger squares for small grids (bingo cards), and text sized to the longest entry.
  const cell = Math.min(areaW / cols, BODY_H / rows, cols <= 5 ? 1.2 : 0.75);
  const x0 = M + (areaW - cell * cols) / 2;
  const y0 = TOP + (BODY_H - cell * rows) / 2;
  const longest = Math.max(1, ...grid.flat().map((ch) => (ch ?? "").length));
  const size = Math.max(8, Math.round(Math.min(cell * 40, (cell * 100) / longest)));
  grid.forEach((row, r) =>
    row.forEach((ch, c) => {
      if (ch === null) return;
      const x = x0 + c * cell;
      const y = y0 + r * cell;
      slide.addText(ch, {
        x, y, w: cell, h: cell, fontFace: t.font, fontSize: size, bold: true, color: t.ink, align: "center", valign: "middle", margin: 0, fit: "shrink",
        fill: { color: s.shade?.[r]?.[c] ? t.highlightTint : t.background },
        line: { color: t.ink, width: 0.75 },
      });
      const num = s.numbers?.[r]?.[c];
      if (num) slide.addText(String(num), { x: x + 0.02, y: y + 0.01, w: cell * 0.6, h: cell * 0.4, fontFace: t.font, fontSize: Math.max(6, Math.round(size * 0.45)), bold: true, color: t.soft, margin: 0, valign: "top" });
    }),
  );
  if (list.length) {
    const x = M + areaW + 0.4;
    sidePanel(t, slide, s.sideTitle ?? "", list, x, TOP, W - M - x, BODY_H);
  }
}

function contentSlide(t: DeckTheme, pptx: PptxGenJS, s: ExportSlide, footText: string, n: number) {
  const slide = pptx.addSlide();
  slide.background = { color: t.background };
  const second = (s.secondColumn ?? []).filter((x) => x.trim());
  const idea = s.imageIdea?.trim() ?? "";
  const img = s.image ?? null;
  const side = s.layout !== "Two columns" && s.layout !== "Table" && s.layout !== "Grid" && (second.length > 0 || Boolean(idea) || Boolean(img));
  const textW = side ? 7.4 : W - 2 * M;
  heading(t, slide, s.heading, s.tag ?? LAYOUT_TAGS[s.layout]);

  switch (s.layout) {
    case "Question": {
      slide.addShape("roundRect", { x: M, y: TOP, w: textW, h: BODY_H, rectRadius: 0.2, fill: { color: t.highlightTint }, line: { color: t.highlight, width: 1.5 } });
      const [question, ...rest] = s.bullets.filter((b) => b.trim());
      const qSize = (question ?? "").length > 160 ? 24 : 30;
      slide.addText(
        [
          { text: question ?? s.heading, options: { fontSize: qSize, bold: true, color: t.ink, breakLine: rest.length > 0, paraSpaceAfter: 14 } },
          ...rest.map((line, i) => ({ text: line, options: { fontSize: 22, color: t.soft, breakLine: i < rest.length - 1 } })),
        ],
        { x: M + 0.4, y: TOP + 0.3, w: textW - 0.8, h: BODY_H - 0.6, fontFace: t.font, align: "center", valign: "middle", fit: "shrink" },
      );
      break;
    }
    case "Big idea": {
      const [first, ...rest] = s.bullets.filter((b) => b.trim());
      slide.addText(
        [
          { text: first ?? s.heading, options: { fontSize: (first ?? "").length > 120 ? 28 : 38, bold: true, color: t.accentDark, breakLine: rest.length > 0, paraSpaceAfter: 16 } },
          ...rest.map((line, i) => ({ text: line, options: { fontSize: 22, color: t.soft, breakLine: i < rest.length - 1 } })),
        ],
        { x: M, y: TOP, w: textW, h: BODY_H, fontFace: t.font, align: "center", valign: "middle", fit: "shrink" },
      );
      break;
    }
    case "Activity":
      slide.addText(numberedRuns(t, s.bullets, fitSize(s.bullets, 24)), { x: M, y: TOP, w: textW, h: BODY_H, fontFace: t.font, valign: "top", fit: "shrink" });
      break;
    case "Two columns": {
      const colW = (W - 2 * M - 0.5) / 2;
      const size = fitSize([...s.bullets, ...second], 24);
      for (const [k, items] of [s.bullets, second].entries()) {
        const x = M + k * (colW + 0.5);
        slide.addShape("roundRect", { x, y: TOP, w: colW, h: BODY_H, rectRadius: 0.15, fill: { color: t.paper }, line: { color: t.line } });
        slide.addText(bulletRuns(t, items, size), { x: x + 0.25, y: TOP + 0.2, w: colW - 0.5, h: BODY_H - 0.4, fontFace: t.font, valign: "top", fit: "shrink" });
      }
      break;
    }
    case "Table":
      if (s.table?.length) table(t, slide, s.table);
      break;
    case "Grid":
      letterGrid(t, slide, s);
      break;
    default:
      slide.addText(bulletRuns(t, s.bullets, fitSize(s.bullets, 26)), { x: M, y: TOP, w: textW, h: BODY_H, fontFace: t.font, valign: "top", fit: "shrink" });
  }
  if (side) {
    const x = M + textW + 0.4;
    const w = W - 2 * M - textW - 0.4;
    const visual = (y: number, h: number) => (img ? photo(t, slide, img, x, y, w, h) : picture(t, slide, idea, x, y, w, h));
    if (second.length && (idea || img)) {
      sidePanel(t, slide, s.sideTitle ?? "", second, x, TOP, w, BODY_H / 2 - 0.1);
      visual(TOP + BODY_H / 2 + 0.1, BODY_H / 2 - 0.1);
    } else if (second.length) sidePanel(t, slide, s.sideTitle ?? "", second, x, TOP, w, BODY_H);
    else visual(TOP, BODY_H);
  }
  const notesText = [s.speakerNotes?.trim() ?? "", img ? `${img.credit}. Source and licence: ${img.sourceUrl}` : ""].filter(Boolean).join("\n\n");
  if (notesText) slide.addNotes(notesText);
  footer(t, slide, footText, n);
}

/** Builds an editable PowerPoint (.pptx) from a deck. */
export function buildPresentation(deck: ExportDeck, m: PptxMeta): PptxGenJS {
  const t = themeById(m.theme);
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
  title.background = { color: t.accentDark };
  title.addShape("rect", { x: M, y: 2.35, w: 1.4, h: 0.12, fill: { color: t.highlight }, line: { color: t.highlight } });
  title.addText(deck.title, { x: M, y: 2.6, w: W - 2 * M, h: 1.6, fontFace: t.font, fontSize: 48, bold: true, color: "FFFFFF", valign: "top", fit: "shrink" });
  if (deck.subtitle.trim()) {
    title.addText(deck.subtitle, { x: M, y: 4.25, w: W - 2 * M, h: 0.8, fontFace: t.font, fontSize: 24, color: t.highlight, valign: "top", fit: "shrink" });
  }
  title.addText(`${m.levelLabel} · ${m.subject}`, { x: M, y: H - 1.2, w: W - 2 * M, h: 0.5, fontFace: t.font, fontSize: 16, color: t.titleMeta });
  const curriculumNotes = m.studentOnly ? [] : deck.curriculumLinks.map((l) => `${l.code}: ${[m.codeText[l.code], l.howAddressed].filter(Boolean).join(" ")}`);
  const titleNotes = [deck.titleNotes, curriculumNotes.length ? `Victorian Curriculum 2.0\n${curriculumNotes.join("\n")}` : ""].filter((x) => x.trim()).join("\n\n");
  if (titleNotes) title.addNotes(titleNotes);

  // Learning intention and success criteria.
  const criteria = deck.successCriteria.filter((c) => c.trim());
  if (deck.learningIntention.trim() || criteria.length) {
    const li = pptx.addSlide();
    li.background = { color: t.background };
    heading(t, li, "Today we are learning", "Learning intention");
    let y = TOP;
    if (deck.learningIntention.trim()) {
      li.addShape("roundRect", { x: M, y, w: W - 2 * M, h: 1.3, rectRadius: 0.15, fill: { color: t.accentTint }, line: { color: t.accentTint } });
      li.addText(deck.learningIntention, { x: M + 0.3, y: y + 0.05, w: W - 2 * M - 0.6, h: 1.2, fontFace: t.font, fontSize: 26, bold: true, color: t.accentDark, valign: "middle", fit: "shrink" });
      y += 1.55;
    }
    if (criteria.length) {
      li.addText("Success criteria", { x: M, y, w: 6, h: 0.45, fontFace: t.font, fontSize: 18, bold: true, color: t.accent });
      li.addText(
        criteria.map((text) => ({ text, options: { bullet: { code: "2610", indent: 26 }, fontSize: 22, color: t.ink, breakLine: true, paraSpaceAfter: 8 } })),
        { x: M, y: y + 0.5, w: W - 2 * M, h: H - y - 0.5 - 0.8, fontFace: t.font, valign: "top", fit: "shrink" },
      );
    }
    footer(t, li, footText, ++n);
  }

  for (const s of deck.slides) contentSlide(t, pptx, s, footText, ++n);
  return pptx;
}

/** Any output type as an editable PowerPoint file. */
export async function outputToPptx(outputType: OutputType, content: Record<string, unknown>, m: PptxMeta): Promise<Buffer> {
  const deck = outputToDeck(outputType, content, { studentOnly: Boolean(m.studentOnly), lessonMinutes: m.lessonMinutes, typeLabel: OUTPUTS[outputType].label, level: m.level });
  if (m.findPhotos) {
    const photos = await m.findPhotos(deck.slides.map((s) => (s.layout === "Two columns" || s.layout === "Table" ? "" : s.imageSearch ?? "")));
    deck.slides = deck.slides.map((s, i) => (photos[i] ? { ...s, image: photos[i] } : s));
  }
  const out = await buildPresentation(deck, m).write({ outputType: "nodebuffer" });
  return out as Buffer;
}

export function pptxFilename(title: string) {
  return `${title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "lessonroo"}.pptx`;
}
