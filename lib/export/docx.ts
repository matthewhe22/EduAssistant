import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  PageBreak,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type FileChild,
} from "docx";
import type { PrimaryLevel } from "../curriculum/types";
import { BINGO_CARDS, buildPuzzles, wordSearchAnswerCells } from "../puzzles";
import type { OutputType } from "../generator/outputs";
import { OUTPUTS } from "../generator/outputs";
import type {
  Activities,
  Assessment,
  LessonPlan,
  ParentNote,
  PuzzlePack,
  Rubric,
  SlideDeck,
  TieredTask,
  UnitPlan,
  Worksheet,
} from "../generator/schema";

export interface ExportMeta {
  subject: string;
  levelLabel: string;
  lessonMinutes: number;
  /** code → content description text. */
  codeText: Record<string, string>;
  /** Student copy: leave out answers, marking guides and teacher notes. */
  studentOnly?: boolean;
  /** Year level of the class (games and puzzles are laid out for it). */
  level?: PrimaryLevel;
}

/* ------------------------------ helpers ------------------------------ */

type Heading = (typeof HeadingLevel)[keyof typeof HeadingLevel];
const h = (text: string, heading: Heading = HeadingLevel.HEADING_2) => new Paragraph({ text, heading, spacing: { before: 240, after: 80 } });
const p = (text: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
  new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 80 } });
const labelled = (label: string, text: string) =>
  new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(text)], spacing: { after: 80 } });
const bullets = (items: string[]) => items.filter(Boolean).map((t) => new Paragraph({ text: t, bullet: { level: 0 } }));
const numbered = (items: string[]) => items.filter(Boolean).map((t, i) => p(`${i + 1}. ${t}`));
const lines = (n: number) => Array.from({ length: Math.min(n, 10) }, () => p("_".repeat(80)));
const cell = (children: Paragraph[], widthPct: number) => new TableCell({ children: children.length ? children : [p("")], width: { size: widthPct, type: WidthType.PERCENTAGE } });
const table = (rows: TableRow[]) => new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
const codes = (c: string[]) => (c.length ? ` (${c.join(", ")})` : "");

function header(title: string, meta: string, overview?: string): FileChild[] {
  return [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: meta, italics: true })] }),
    ...(overview ? [p(overview)] : []),
  ];
}

function curriculum(links: { code: string; howAddressed: string }[], meta: ExportMeta): FileChild[] {
  if (!links.length) return [h("Victorian Curriculum 2.0"), p("No curriculum code cited. Check alignment before teaching.", { italics: true })];
  return [
    h("Victorian Curriculum 2.0"),
    table(links.map((l) => new TableRow({ children: [cell([p(l.code, { bold: true })], 18), cell([p(meta.codeText[l.code] ?? ""), p(l.howAddressed, { italics: true })], 82)] }))),
  ];
}

function differentiation(d: { support: string[]; extension: string[]; ealD: string[] }): FileChild[] {
  return [h("Differentiation"), p("Support", { bold: true }), ...bullets(d.support), p("Extension", { bold: true }), ...bullets(d.extension), p("EAL/D", { bold: true }), ...bullets(d.ealD)];
}

const footer = () =>
  new Paragraph({
    spacing: { before: 400 },
    children: [new TextRun({ text: "Generated with Lessonroo. Review before use.", size: 16, italics: true })],
  });

/* ----------------------------- per type ------------------------------ */

function lessonPlan(x: LessonPlan, m: ExportMeta, meta: string): FileChild[] {
  return [
    ...header(x.title, meta, x.overview),
    ...curriculum(x.curriculumLinks, m),
    h("Learning intention"),
    p(x.learningIntention),
    h("Success criteria"),
    ...bullets(x.successCriteria),
    h("Vocabulary"),
    ...x.vocabulary.map((v) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `${v.term}: `, bold: true }), new TextRun(v.studentFriendlyDefinition)] })),
    h("Resources"),
    ...bullets(x.resources),
    h("Lesson sequence"),
    table([
      new TableRow({ tableHeader: true, children: [cell([p("Phase", { bold: true })], 18), cell([p("Teacher", { bold: true })], 41), cell([p("Students", { bold: true })], 41)] }),
      ...x.phases.map(
        (ph) =>
          new TableRow({
            children: [
              cell([p(ph.phase, { bold: true }), p(`${ph.minutes} min`)], 18),
              cell([...bullets(ph.teacher), ...(ph.checkForUnderstanding ? [p(`Check: ${ph.checkForUnderstanding}`, { italics: true })] : [])], 41),
              cell(bullets(ph.students), 41),
            ],
          }),
      ),
    ]),
    ...differentiation(x.differentiation),
    h("Assessment"),
    ...bullets(x.assessment.formative),
    labelled("Exit ticket", x.assessment.exitTicket),
    ...(x.crossCurriculum.length ? [h("Capabilities and cross-curriculum priorities"), ...bullets(x.crossCurriculum)] : []),
    h("Teacher notes"),
    ...bullets(x.teacherNotes),
  ];
}

function unitPlan(x: UnitPlan, m: ExportMeta, meta: string): FileChild[] {
  return [
    ...header(x.title, meta, x.overview),
    ...curriculum(x.curriculumLinks, m),
    h("Big ideas"),
    ...bullets(x.bigIdeas),
    h("Success criteria"),
    ...bullets(x.successCriteria),
    labelled("Vocabulary", x.vocabulary.join(", ")),
    h("Lesson sequence"),
    table([
      new TableRow({ tableHeader: true, children: [cell([p("Lesson", { bold: true })], 22), cell([p("Key activities", { bold: true })], 52), cell([p("Resources", { bold: true })], 26)] }),
      ...x.lessons.map(
        (l) =>
          new TableRow({
            children: [
              cell([p(`${l.number}. ${l.title}`, { bold: true }), p(l.learningIntention, { italics: true }), ...(l.curriculumCodes.length ? [p(l.curriculumCodes.join(", "))] : [])], 22),
              cell(bullets(l.keyActivities), 52),
              cell(bullets(l.resources), 26),
            ],
          }),
      ),
    ]),
    h("Assessment"),
    labelled("Pre-assessment", x.assessment.preAssessment),
    p("Formative", { bold: true }),
    ...bullets(x.assessment.formative),
    labelled("Summative task", x.assessment.summativeTask),
    ...bullets(x.assessment.summativeCriteria),
    ...differentiation(x.differentiation),
    ...(x.crossCurriculum.length ? [h("Capabilities and cross-curriculum priorities"), ...bullets(x.crossCurriculum)] : []),
    h("Teacher notes"),
    ...bullets(x.teacherNotes),
  ];
}

function activities(x: Activities, m: ExportMeta, meta: string): FileChild[] {
  return [
    ...header(x.title, meta, x.overview),
    ...curriculum(x.curriculumLinks, m),
    labelled("Learning intention", x.learningIntention),
    ...x.activities.flatMap((a, i) => [
      h(`${i + 1}. ${a.name} (${a.format}, ${a.minutes} min)`, HeadingLevel.HEADING_3),
      labelled("Materials", a.materials.join(", ")),
      ...numbered(a.steps),
      labelled("Teacher", a.teacherRole),
      labelled("Success looks like", a.successLooksLike),
      labelled("Easier", a.support),
      labelled("Harder", a.extension),
    ]),
    h("Management tips"),
    ...bullets(x.managementTips),
    h("Teacher notes"),
    ...bullets(x.teacherNotes),
  ];
}

function worksheet(x: Worksheet, m: ExportMeta, meta: string): FileChild[] {
  const question = (q: Worksheet["sections"][number]["questions"][number], answers: boolean) => [
    p(`${q.number}. ${q.prompt}`),
    ...q.options.map((o, i) => p(`    ${String.fromCharCode(97 + i)}) ${o}`)),
    ...(answers ? [p(`Answer: ${q.answer}${q.markingNotes ? ` (${q.markingNotes})` : ""}`, { italics: true })] : lines(q.answerLines)),
  ];
  return [
    ...header(x.title, "Name: ______________________    Date: ____________"),
    p(x.studentInstructions),
    ...(x.wordBank.length ? [labelled("Word bank", x.wordBank.join("  ·  "))] : []),
    ...x.sections.flatMap((s) => [h(s.heading), p(s.instructions, { italics: true }), ...s.questions.flatMap((q) => question(q, false))]),
    ...(m.studentOnly ? [] : answerKey()),
  ];
  function answerKey(): FileChild[] {
    return [
    new Paragraph({ children: [new PageBreak()] }),
    ...header(`Answer key: ${x.title}`, meta, x.overview),
    ...curriculum(x.curriculumLinks, m),
    ...x.sections.flatMap((s) => [h(s.heading), ...s.questions.flatMap((q) => question(q, true))]),
    h("Teacher notes"),
    ...bullets(x.teacherNotes),
    ];
  }
}

function tiered(x: TieredTask, m: ExportMeta, meta: string): FileChild[] {
  if (m.studentOnly) {
    return [
      ...header(x.title, "Name: ______________________    Date: ____________"),
      ...x.tiers.flatMap((t, i) => [
        ...(i > 0 ? [new Paragraph({ children: [new PageBreak()] })] : []),
        h(t.tier === "Support" ? "Level 1" : t.tier === "Core" ? "Level 2" : "Level 3"),
        ...numbered(t.studentInstructions),
        ...(t.scaffolds.length ? [p("Helpful hints", { bold: true }), ...bullets(t.scaffolds)] : []),
        ...t.questions.flatMap((q, n) => [p(`${n + 1}. ${q.prompt}`), ...lines(3)]),
        p("I can…", { bold: true }),
        ...t.successCriteria.map((c) => p(`☐ ${c}`)),
      ]),
    ];
  }
  return [
    ...header(x.title, meta, x.overview),
    ...curriculum(x.curriculumLinks, m),
    labelled("Learning intention", x.learningIntention),
    labelled("Common task", x.commonTask),
    ...x.tiers.flatMap((t) => [
      h(`${t.tier}: ${t.whoItIsFor}`),
      p("Instructions", { bold: true }),
      ...numbered(t.studentInstructions),
      p("Scaffolds", { bold: true }),
      ...bullets(t.scaffolds),
      p("Questions", { bold: true }),
      ...t.questions.flatMap((q, i) => [p(`${i + 1}. ${q.prompt}`), p(`Answer: ${q.answer}`, { italics: true })]),
      p("Success criteria", { bold: true }),
      ...bullets(t.successCriteria),
    ]),
    h("EAL/D adjustments"),
    ...bullets(x.ealDAdjustments),
    h("Teacher notes"),
    ...bullets(x.teacherNotes),
  ];
}

function rubric(x: Rubric, m: ExportMeta, meta: string): FileChild[] {
  const w = Math.floor(80 / Math.max(1, x.levelLabels.length));
  return [
    ...header(x.title, meta, x.overview),
    ...curriculum(x.curriculumLinks, m),
    labelled("Task", x.task),
    table([
      new TableRow({ tableHeader: true, children: [cell([p("Criterion", { bold: true })], 20), ...x.levelLabels.map((l) => cell([p(l, { bold: true })], w))] }),
      ...x.criteria.map((c) => new TableRow({ children: [cell([p(c.criterion + codes(c.curriculumCodes), { bold: true })], 20), ...x.levelLabels.map((_, j) => cell([p(c.descriptors[j] ?? "")], w))] })),
    ]),
    h("Student checklist"),
    ...x.studentChecklist.map((s) => p(`☐ ${s}`)),
    h("Moderation notes"),
    ...bullets(x.moderationNotes),
  ];
}

function assessment(x: Assessment, m: ExportMeta, meta: string): FileChild[] {
  const q = (item: Assessment["questions"][number], answers: boolean) => [
    p(`${item.number}. ${item.prompt} (${item.marks} mark${item.marks === 1 ? "" : "s"})`),
    ...item.options.map((o, i) => p(`    ${String.fromCharCode(97 + i)}) ${o}`)),
    ...(answers ? [p(`Answer: ${item.answer}${codes(item.curriculumCodes)}`, { italics: true })] : item.options.length ? [] : lines(3)),
  ];
  return [
    ...header(x.title, "Name: ______________________    Date: ____________"),
    p(x.studentInstructions),
    ...x.questions.flatMap((item) => q(item, false)),
    p(`Total: ____ / ${x.totalMarks}`, { bold: true }),
    ...(m.studentOnly ? [] : markingGuide()),
  ];
  function markingGuide(): FileChild[] {
    return [
    new Paragraph({ children: [new PageBreak()] }),
    ...header(`Marking guide: ${x.title}`, meta, x.overview),
    ...curriculum(x.curriculumLinks, m),
    ...x.questions.flatMap((item) => q(item, true)),
    h("Marking guide"),
    ...bullets(x.markingGuide),
    h("Next steps"),
    ...bullets(x.nextSteps),
    ];
  }
}

function parentNote(x: ParentNote, _m: ExportMeta, _meta: string): FileChild[] {
  return [
    new Paragraph({ text: x.title, heading: HeadingLevel.TITLE }),
    ...x.newsletterText.split(/\n+/).map((t) => p(t)),
    labelled("Words we are learning", x.keyVocabulary.join(", ")),
    h("Try at home"),
    ...x.homeActivities.map((a) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `${a.name}: `, bold: true }), new TextRun(`${a.description} (${a.materials})`)] })),
    h("Conversation starters"),
    ...bullets(x.conversationStarters),
  ];
}

function slides(x: SlideDeck, m: ExportMeta, meta: string): FileChild[] {
  return [
    ...header(x.title, meta, x.overview),
    ...(x.subtitle ? [p(x.subtitle, { italics: true })] : []),
    ...curriculum(x.curriculumLinks, m),
    labelled("Learning intention", x.learningIntention),
    h("Success criteria"),
    ...bullets(x.successCriteria),
    h("Slides"),
    ...x.slides.flatMap((s, i) => [
      h(`Slide ${i + 3}: ${s.heading}`, HeadingLevel.HEADING_3),
      ...bullets(s.bullets),
      ...(s.secondColumn.length ? [p("Right-hand column", { bold: true }), ...bullets(s.secondColumn)] : []),
      ...(s.imageIdea ? [labelled("Picture idea", s.imageIdea)] : []),
      ...(s.speakerNotes ? [labelled("Speaker notes", s.speakerNotes)] : []),
    ]),
    h("Teacher notes"),
    ...bullets(x.teacherNotes),
  ];
}

/** A grid of square cells (word search, crossword, bingo card). `null` cells are left blank with no border. */
function letterGrid(rows: (string | null)[][], cellCm: number, opts: { shade?: (r: number, c: number) => boolean; corner?: (r: number, c: number) => string; size?: number } = {}) {
  const twips = Math.round((cellCm / 2.54) * 1440);
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const line = { style: BorderStyle.SINGLE, size: 6, color: "17202A" };
  return new Table({
    columnWidths: Array(rows[0]?.length ?? 0).fill(twips),
    rows: rows.map(
      (row, r) =>
        new TableRow({
          height: { value: twips, rule: "exact" },
          children: row.map((ch, c) => {
            const corner = opts.corner?.(r, c) ?? "";
            const b = ch === null ? none : line;
            return new TableCell({
              width: { size: twips, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              borders: { top: b, bottom: b, left: b, right: b },
              shading: opts.shade?.(r, c) ? { type: ShadingType.CLEAR, color: "auto", fill: "FDF1D8" } : undefined,
              margins: { top: 0, bottom: 0, left: 30, right: 30 },
              children: [
                new Paragraph({
                  alignment: corner ? AlignmentType.LEFT : AlignmentType.CENTER,
                  children: [
                    ...(corner ? [new TextRun({ text: `${corner} `, size: 12, bold: true })] : []),
                    new TextRun({ text: ch ?? "", bold: true, size: opts.size ?? 26 }),
                  ],
                }),
              ],
            });
          }),
        }),
    ),
  });
}

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

function puzzles(x: PuzzlePack, m: ExportMeta, meta: string): FileChild[] {
  const pz = buildPuzzles(x, m.level ?? "3", BINGO_CARDS);
  const ws = pz.wordSearch;
  const cw = pz.crossword;
  const display = new Map(pz.entries.map((e) => [e.word, e.display]));
  const name = p("Name: ______________________    Date: ____________");
  const wsCell = Math.min(1.2, 16.5 / ws.grid.length);
  const cwCell = Math.min(1.1, 16.5 / Math.max(cw.cols, 1));
  const clueList = (answers: boolean) =>
    (["across", "down"] as const).flatMap((dir) => [
      p(dir === "across" ? "Across" : "Down", { bold: true }),
      ...cw[dir].map((c) => p(`${c.number}. ${c.clue} (${c.length})${answers ? `  ${c.answer}` : ""}`)),
    ]);
  const cards = pz.bingo.cards;
  const cardCell = pz.bingo.size === 3 ? 2.6 : 2.0;

  const student: FileChild[] = [
    ...header(`${x.title}: word search`, meta),
    name,
    p(`Find these ${ws.placed.length} words. They go ${ws.directions}.`),
    letterGrid(ws.grid, wsCell, { size: ws.grid.length > 12 ? 22 : 26 }),
    p(""),
    p(ws.placed.map((pl) => `☐ ${display.get(pl.word) ?? pl.word}`).join("     ")),
    ...(cw.rows
      ? [
          pageBreak(),
          ...header(`${x.title}: crossword`, meta),
          name,
          letterGrid(cw.cells.map((row) => row.map((ch) => (ch === null ? null : ""))), cwCell, { corner: (r, c) => String(cw.numbers[r][c] ?? "") }),
          ...clueList(false),
        ]
      : []),
    ...(cards.length
      ? [
          pageBreak(),
          ...header(`${x.title}: bingo`, meta),
          p(x.bingo.instructions),
          ...cards.flatMap((card, k) => [
            ...(k > 0 && k % 2 === 0 ? [pageBreak()] : []),
            p(`BINGO · Card ${k + 1}`, { bold: true }),
            letterGrid(card, cardCell, { size: 22 }),
            p(""),
          ]),
        ]
      : []),
  ];
  if (m.studentOnly) return student;
  const answers = wordSearchAnswerCells(ws);
  return [
    ...header(x.title, meta, x.overview),
    ...curriculum(x.curriculumLinks, m),
    h("Words and clues"),
    ...x.words.map((w) => labelled(w.word, w.clue)),
    h("Bingo calling list"),
    p(x.bingo.instructions),
    ...x.bingo.items.map((it, i) => p(`☐ ${i + 1}. ${it.call}  →  ${it.answer}`)),
    h("Brain breaks"),
    ...x.brainBreaks.flatMap((b) => [p(`${b.name} (${b.minutes} min)`, { bold: true }), ...numbered(b.steps), p(b.learningLink, { italics: true })]),
    h("Teacher notes"),
    ...bullets(x.teacherNotes),
    pageBreak(),
    h("Answers: word search"),
    letterGrid(ws.grid, wsCell, { shade: (r, c) => answers.has(`${r},${c}`), size: ws.grid.length > 12 ? 22 : 26 }),
    ...(cw.rows
      ? [
          h("Answers: crossword"),
          letterGrid(cw.cells, cwCell, { corner: (r, c) => String(cw.numbers[r][c] ?? "") }),
          ...clueList(true),
          ...(cw.missing.length ? [p(`Not in the crossword: ${cw.missing.map((w) => display.get(w) ?? w).join(", ")}`, { italics: true })] : []),
        ]
      : []),
    pageBreak(),
    ...student,
  ];
}

/* ------------------------------- entry -------------------------------- */

export function buildDocument(outputType: OutputType, content: Record<string, unknown>, m: ExportMeta): Document {
  const def = OUTPUTS[outputType];
  const meta = `${def.label} · ${m.subject} · ${m.levelLabel}${def.usesLessonLength ? ` · ${m.lessonMinutes} minutes` : ""}`;
  const builders: Record<OutputType, (x: never, m: ExportMeta, meta: string) => FileChild[]> = {
    lesson_plan: lessonPlan,
    unit_plan: unitPlan,
    activities,
    worksheet,
    differentiation: tiered,
    rubric,
    assessment,
    parent_note: parentNote,
    slides,
    puzzles,
  };
  return new Document({
    creator: "Lessonroo",
    title: String(content.title),
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children: [...builders[outputType](content as never, m, meta), footer()] }],
  });
}

export async function outputToDocx(outputType: OutputType, content: Record<string, unknown>, m: ExportMeta): Promise<Buffer> {
  return Packer.toBuffer(buildDocument(outputType, content, m));
}

export function docxFilename(title: string) {
  return `${title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "lessonroo"}.docx`;
}
