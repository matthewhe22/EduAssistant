import PptxGenJS from "pptxgenjs";
import type { SlideDeck } from "../generator/schema";

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
const HEAD_FONT = "Calibri";

/** 16:9, 13.333 × 7.5 inches. */
const W = 13.333;
const H = 7.5;
const M = 0.6;

export interface PptxMeta {
  subject: string;
  levelLabel: string;
  lessonMinutes: number;
  /** code → content description text, for the notes on the learning intention slide. */
  codeText: Record<string, string>;
}

type Slide = ReturnType<PptxGenJS["addSlide"]>;
type Content = SlideDeck["slides"][number];

const bulletRuns = (items: string[], fontSize: number, color = C.ink) =>
  items
    .filter((t) => t.trim())
    .map((text) => ({ text, options: { bullet: { indent: fontSize * 0.9 }, fontSize, color, breakLine: true, paraSpaceAfter: fontSize * 0.45 } }));

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
    slide.addText(tag.toUpperCase(), { x: M + 0.3, y: 0.32, w: 6, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.euc, charSpacing: 2 });
  }
  slide.addText(text, { x: M + 0.3, y: 0.55, w: W - 2 * M - 0.3, h: 0.8, fontFace: HEAD_FONT, fontSize: 34, bold: true, color: C.eucDark, valign: "middle", fit: "shrink" });
}

/** A dashed box suggesting a picture; the teacher replaces it with their own image. */
function picture(slide: Slide, idea: string, x: number, y: number, w: number, h: number) {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.12, fill: { color: C.eucTint }, line: { color: C.euc, width: 1.25, dashType: "dash" } });
  slide.addText([
    { text: "Picture idea", options: { bold: true, fontSize: 14, color: C.euc, breakLine: true } },
    { text: idea, options: { fontSize: 14, color: C.soft } },
  ], { x: x + 0.25, y: y + 0.25, w: w - 0.5, h: h - 0.5, fontFace: FONT, align: "center", valign: "middle", fit: "shrink" });
}

function contentSlide(pptx: PptxGenJS, s: Content, footText: string, n: number) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  const top = 1.65;
  const bodyH = H - top - 0.8;
  const hasPicture = Boolean(s.imageIdea.trim()) && s.layout !== "Two columns";
  const textW = hasPicture ? 7.4 : W - 2 * M;

  switch (s.layout) {
    case "Question": {
      heading(slide, s.heading, "Think about it");
      slide.addShape("roundRect", { x: M, y: top, w: textW, h: bodyH, rectRadius: 0.2, fill: { color: C.wattleTint }, line: { color: C.wattle, width: 1.5 } });
      const [question, ...rest] = s.bullets.filter((b) => b.trim());
      slide.addText(
        [
          { text: question ?? s.heading, options: { fontSize: 32, bold: true, color: C.ink, breakLine: rest.length > 0, paraSpaceAfter: 14 } },
          ...rest.map((t, i) => ({ text: t, options: { fontSize: 22, color: C.soft, breakLine: i < rest.length - 1 } })),
        ],
        { x: M + 0.4, y: top + 0.3, w: textW - 0.8, h: bodyH - 0.6, fontFace: FONT, align: "center", valign: "middle", fit: "shrink" },
      );
      break;
    }
    case "Big idea": {
      heading(slide, s.heading, "Big idea");
      const [idea, ...rest] = s.bullets.filter((b) => b.trim());
      slide.addText(
        [
          { text: idea ?? s.heading, options: { fontSize: 38, bold: true, color: C.eucDark, breakLine: rest.length > 0, paraSpaceAfter: 16 } },
          ...rest.map((t, i) => ({ text: t, options: { fontSize: 22, color: C.soft, breakLine: i < rest.length - 1 } })),
        ],
        { x: M, y: top, w: textW, h: bodyH, fontFace: HEAD_FONT, align: "center", valign: "middle", fit: "shrink" },
      );
      break;
    }
    case "Activity": {
      heading(slide, s.heading, "Your turn");
      slide.addText(numberedRuns(s.bullets, fitSize(s.bullets, 24)), { x: M, y: top, w: textW, h: bodyH, fontFace: FONT, valign: "top", fit: "shrink" });
      break;
    }
    case "Two columns": {
      heading(slide, s.heading);
      const colW = (W - 2 * M - 0.5) / 2;
      const size = fitSize([...s.bullets, ...s.secondColumn], 24);
      slide.addShape("roundRect", { x: M, y: top, w: colW, h: bodyH, rectRadius: 0.15, fill: { color: C.paper }, line: { color: C.line } });
      slide.addShape("roundRect", { x: M + colW + 0.5, y: top, w: colW, h: bodyH, rectRadius: 0.15, fill: { color: C.paper }, line: { color: C.line } });
      slide.addText(bulletRuns(s.bullets, size), { x: M + 0.25, y: top + 0.2, w: colW - 0.5, h: bodyH - 0.4, fontFace: FONT, valign: "top", fit: "shrink" });
      slide.addText(bulletRuns(s.secondColumn, size), { x: M + colW + 0.75, y: top + 0.2, w: colW - 0.5, h: bodyH - 0.4, fontFace: FONT, valign: "top", fit: "shrink" });
      break;
    }
    default: {
      heading(slide, s.heading);
      slide.addText(bulletRuns(s.bullets, fitSize(s.bullets, 26)), { x: M, y: top, w: textW, h: bodyH, fontFace: FONT, valign: "top", fit: "shrink" });
    }
  }
  if (hasPicture) picture(slide, s.imageIdea, M + textW + 0.4, top, W - 2 * M - textW - 0.4, bodyH);
  if (s.speakerNotes.trim()) slide.addNotes(s.speakerNotes);
  footer(slide, footText, n);
}

/** Builds an editable PowerPoint (.pptx) from a slide deck. */
export function buildPresentation(deck: SlideDeck, m: PptxMeta): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title;
  pptx.subject = `${m.subject} · ${m.levelLabel}`;
  pptx.company = "Lessonroo";
  pptx.author = "Lessonroo";
  const footText = `${deck.title} · ${m.levelLabel} ${m.subject}`;

  // Title slide.
  const title = pptx.addSlide();
  title.background = { color: C.eucDark };
  title.addShape("rect", { x: M, y: 2.35, w: 1.4, h: 0.12, fill: { color: C.wattle }, line: { color: C.wattle } });
  title.addText(deck.title, { x: M, y: 2.6, w: W - 2 * M, h: 1.6, fontFace: HEAD_FONT, fontSize: 48, bold: true, color: C.white, valign: "top", fit: "shrink" });
  if (deck.subtitle.trim()) {
    title.addText(deck.subtitle, { x: M, y: 4.25, w: W - 2 * M, h: 0.8, fontFace: FONT, fontSize: 24, color: C.wattle, valign: "top", fit: "shrink" });
  }
  title.addText(`${m.levelLabel} · ${m.subject}`, { x: M, y: H - 1.2, w: W - 2 * M, h: 0.5, fontFace: FONT, fontSize: 16, color: "DCE8E1" });
  if (deck.overview.trim()) title.addNotes(deck.overview);

  // Learning intention and success criteria.
  const li = pptx.addSlide();
  li.background = { color: C.white };
  heading(li, "Today we are learning", "Learning intention");
  li.addShape("roundRect", { x: M, y: 1.65, w: W - 2 * M, h: 1.3, rectRadius: 0.15, fill: { color: C.eucTint }, line: { color: C.eucTint } });
  li.addText(deck.learningIntention, { x: M + 0.3, y: 1.7, w: W - 2 * M - 0.6, h: 1.2, fontFace: FONT, fontSize: 26, bold: true, color: C.eucDark, valign: "middle", fit: "shrink" });
  li.addText("Success criteria", { x: M, y: 3.2, w: 6, h: 0.45, fontFace: FONT, fontSize: 18, bold: true, color: C.euc });
  li.addText(
    deck.successCriteria.filter((c) => c.trim()).map((text) => ({ text, options: { bullet: { code: "2610", indent: 26 }, fontSize: 22, color: C.ink, breakLine: true, paraSpaceAfter: 8 } })),
    { x: M, y: 3.7, w: W - 2 * M, h: H - 3.7 - 0.8, fontFace: FONT, valign: "top", fit: "shrink" },
  );
  const curriculumNotes = deck.curriculumLinks.map((l) => `${l.code}: ${[m.codeText[l.code], l.howAddressed].filter(Boolean).join(" ")}`);
  if (curriculumNotes.length) li.addNotes(`Victorian Curriculum 2.0\n${curriculumNotes.join("\n")}`);
  footer(li, footText, 2);

  deck.slides.forEach((s, i) => contentSlide(pptx, s, footText, i + 3));
  return pptx;
}

export async function deckToPptx(deck: SlideDeck, m: PptxMeta): Promise<Buffer> {
  const out = await buildPresentation(deck, m).write({ outputType: "nodebuffer" });
  return out as Buffer;
}

export function pptxFilename(title: string) {
  return `${title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "lessonroo"}.pptx`;
}
