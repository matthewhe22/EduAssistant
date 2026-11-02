import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { LessonPlan } from "../generator/schema";

export interface PlanMeta {
  subject: string;
  levelLabel: string;
  lessonMinutes: number;
  /** code → content description text, for the curriculum table. */
  codeText: Record<string, string>;
}

const h = (text: string, heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) =>
  new Paragraph({ text, heading, spacing: { before: 240, after: 80 } });
const p = (text: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
  new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 80 } });
const bullets = (items: string[]) => items.filter(Boolean).map((t) => new Paragraph({ text: t, bullet: { level: 0 } }));

function cell(children: Paragraph[], widthPct: number) {
  return new TableCell({ children, width: { size: widthPct, type: WidthType.PERCENTAGE } });
}

export function buildLessonPlanDocument(plan: LessonPlan, meta: PlanMeta): Document {
  const curriculumRows = plan.curriculumLinks.map(
    (l) =>
      new TableRow({
        children: [
          cell([p(l.code, { bold: true })], 18),
          cell([p(meta.codeText[l.code] ?? ""), p(l.howAddressed, { italics: true })], 82),
        ],
      }),
  );

  const phaseRows = [
    new TableRow({
      tableHeader: true,
      children: [
        cell([p("Phase", { bold: true })], 18),
        cell([p("Teacher", { bold: true })], 41),
        cell([p("Students", { bold: true })], 41),
      ],
    }),
    ...plan.phases.map(
      (ph) =>
        new TableRow({
          children: [
            cell([p(ph.phase, { bold: true }), p(`${ph.minutes} min`)], 18),
            cell(
              [...bullets(ph.teacher), ...(ph.checkForUnderstanding ? [p(`Check: ${ph.checkForUnderstanding}`, { italics: true })] : [])],
              41,
            ),
            cell(bullets(ph.students), 41),
          ],
        }),
    ),
  ];

  return new Document({
    creator: "EdAssistant",
    title: plan.title,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [
      {
        children: [
          new Paragraph({ text: plan.title, heading: HeadingLevel.TITLE }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: `${meta.subject} · ${meta.levelLabel} · ${meta.lessonMinutes} minutes`, italics: true })],
          }),
          p(plan.overview),

          h("Victorian Curriculum 2.0"),
          ...(curriculumRows.length
            ? [new Table({ rows: curriculumRows, width: { size: 100, type: WidthType.PERCENTAGE } })]
            : [p("No curriculum code cited. Check alignment before teaching.", { italics: true })]),

          h("Learning intention"),
          p(plan.learningIntention),
          h("Success criteria"),
          ...bullets(plan.successCriteria),

          h("Vocabulary"),
          ...plan.vocabulary.map((v) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `${v.term}: `, bold: true }), new TextRun(v.studentFriendlyDefinition)] })),
          h("Resources"),
          ...bullets(plan.resources),

          h("Lesson sequence"),
          new Table({ rows: phaseRows, width: { size: 100, type: WidthType.PERCENTAGE } }),

          h("Differentiation"),
          p("Support", { bold: true }),
          ...bullets(plan.differentiation.support),
          p("Extension", { bold: true }),
          ...bullets(plan.differentiation.extension),
          p("EAL/D", { bold: true }),
          ...bullets(plan.differentiation.ealD),

          h("Assessment"),
          ...bullets(plan.assessment.formative),
          p(`Exit ticket: ${plan.assessment.exitTicket}`, { bold: true }),

          ...(plan.crossCurriculum.length ? [h("Capabilities and cross-curriculum priorities"), ...bullets(plan.crossCurriculum)] : []),
          h("Teacher notes"),
          ...bullets(plan.teacherNotes),

          new Paragraph({
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: "Generated with EdAssistant. Curriculum content © Victorian Curriculum and Assessment Authority (VCAA). Review before teaching.",
                size: 16,
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });
}

export async function lessonPlanToDocx(plan: LessonPlan, meta: PlanMeta): Promise<Buffer> {
  return Packer.toBuffer(buildLessonPlanDocument(plan, meta));
}

export function docxFilename(title: string) {
  return `${title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "lesson-plan"}.docx`;
}
