import type { CurriculumBand, PrimaryLevel, SubjectCurriculum } from "../curriculum/types";
import { LEVEL_LABELS, PRIMARY_LEVELS } from "../curriculum/types";
import type { GenerateRequest } from "./schema";

export interface CurriculumContext {
  /** Band the class is working in. */
  band: CurriculumBand;
  /** Previous / next band, included for below / above / mixed difficulty. */
  previous: CurriculumBand | null;
  next: CurriculumBand | null;
  /** Codes the model may cite. */
  allowedCodes: Set<string>;
  /** Text block sent to Claude (stable per subject + band + difficulty, so it caches). */
  text: string;
}

function bandIndex(subject: SubjectCurriculum, level: PrimaryLevel) {
  return subject.bands.findIndex((b) => b.levels.includes(level));
}

function renderBand(subject: SubjectCurriculum, band: CurriculumBand, withElaborations: boolean) {
  const lines: string[] = [];
  lines.push(`### ${subject.subject}: ${band.band}`);
  lines.push("");
  lines.push("Achievement standard:");
  lines.push(band.achievementStandard);
  lines.push("");
  lines.push("Content descriptions:");
  let strandKey = "";
  for (const cd of band.contentDescriptions) {
    const key = [cd.strand, cd.subStrand].filter(Boolean).join(" › ");
    if (key !== strandKey) {
      lines.push(`- Strand: ${key}`);
      strandKey = key;
    }
    lines.push(`  - [${cd.code}] ${cd.text}`);
    if (withElaborations) {
      for (const e of cd.elaborations) lines.push(`    - elaboration: ${e}`);
    }
  }
  return lines.join("\n");
}

export function buildCurriculumContext(
  subject: SubjectCurriculum,
  level: GenerateRequest["level"],
  difficulty: GenerateRequest["difficulty"],
): CurriculumContext | null {
  const i = bandIndex(subject, level);
  if (i < 0) return null;
  const band = subject.bands[i];
  const previous = difficulty === "below" || difficulty === "mixed" ? subject.bands[i - 1] ?? null : null;
  const next = difficulty === "above" || difficulty === "mixed" ? subject.bands[i + 1] ?? null : null;

  const parts = [
    `## Victorian Curriculum F–10 Version 2.0: ${subject.subject} (${subject.learningArea})`,
    band.levels.length > 1
      ? `This subject is written as a band covering ${band.levels.map((l) => LEVEL_LABELS[l]).join(" and ")}.`
      : "",
    "",
    "## Curriculum for this class",
    renderBand(subject, band, true),
  ];
  if (previous) parts.push("", "## Previous level/band (for scaffolding only)", renderBand(subject, previous, false));
  if (next) parts.push("", "## Next level/band (for extension only)", renderBand(subject, next, false));

  const allowedCodes = new Set(
    [band, previous, next].filter((b): b is CurriculumBand => !!b).flatMap((b) => b.contentDescriptions.map((c) => c.code)),
  );
  return { band, previous, next, allowedCodes, text: parts.filter((p) => p !== undefined).join("\n") };
}

export function buildTeacherRequest(req: GenerateRequest, subject: SubjectCurriculum, ctx: CurriculumContext) {
  const levelLabel = LEVEL_LABELS[req.level];
  const yearInBand =
    ctx.band.levels.length > 1
      ? ` This is year ${ctx.band.levels.indexOf(req.level) + 1} of the ${ctx.band.levels.length}-year band "${ctx.band.band}".`
      : "";
  const focus = req.focusCodes.filter((c) => ctx.allowedCodes.has(c));
  return [
    `Write one lesson plan.`,
    ``,
    `- Year level: ${levelLabel}.${yearInBand}`,
    `- Subject: ${subject.subject}`,
    `- Lesson length: ${req.lessonMinutes} minutes`,
    `- Difficulty: ${req.difficulty}`,
    focus.length ? `- Focus content descriptions chosen by the teacher: ${focus.join(", ")}` : "",
    req.classContext ? `- Class context: ${req.classContext}` : "",
    ``,
    `Teacher's idea or rough plan:`,
    `"""`,
    req.idea,
    `"""`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export const levelOrder = PRIMARY_LEVELS;
