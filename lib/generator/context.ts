import type { CurriculumBand, PrimaryLevel, SubjectCurriculum } from "../curriculum/types";
import { LEVEL_LABELS, PRIMARY_LEVELS } from "../curriculum/types";
import type { GenerateRequest } from "./schema";
import { OUTPUTS } from "./outputs";

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

export function resolveItemCount(req: Pick<GenerateRequest, "outputType" | "itemCount">) {
  const opt = OUTPUTS[req.outputType].itemCount;
  if (!opt) return 0;
  return Math.min(opt.max, Math.max(opt.min, req.itemCount ?? opt.default));
}

export function buildTeacherRequest(
  req: GenerateRequest,
  subject: SubjectCurriculum,
  ctx: CurriculumContext,
  attachment?: { name: string; text?: string },
) {
  const def = OUTPUTS[req.outputType];
  const levelLabel = LEVEL_LABELS[req.level];
  const yearInBand =
    ctx.band.levels.length > 1
      ? ` This is year ${ctx.band.levels.indexOf(req.level) + 1} of the ${ctx.band.levels.length}-year band "${ctx.band.band}".`
      : "";
  const focus = req.focusCodes.filter((c) => ctx.allowedCodes.has(c));
  return [
    `Output: ${def.label}.`,
    def.instructions({ lessonMinutes: req.lessonMinutes, itemCount: resolveItemCount(req) }),
    ``,
    `- Year level: ${levelLabel}.${yearInBand}`,
    `- Subject: ${subject.subject}`,
    def.usesLessonLength ? `- Lesson length: ${req.lessonMinutes} minutes` : "",
    `- Difficulty: ${req.difficulty}`,
    focus.length ? `- Focus content descriptions chosen by the teacher: ${focus.join(", ")}` : "",
    req.classContext ? `- Class context: ${req.classContext}` : "",
    ``,
    req.idea ? `Teacher's idea or rough plan:\n"""\n${req.idea}\n"""` : "",
    attachment
      ? attachment.text !== undefined
        ? `The teacher uploaded an existing plan ("${attachment.name}"). Use it as source material:\n<uploaded_plan>\n${attachment.text}\n</uploaded_plan>`
        : `The teacher uploaded an existing plan ("${attachment.name}", attached above as a PDF). Use it as source material.`
      : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export const levelOrder = PRIMARY_LEVELS;
