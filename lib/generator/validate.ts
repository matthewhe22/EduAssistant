import type { OutputType } from "./outputs";

/** Prefixes of the warnings below, so they can be replaced after an edit. */
export const CONSISTENCY_PREFIXES = ["Phase timings add up", "Question marks add up", "Some rubric criteria"];

/**
 * Checks that depend only on the content itself (timings, marks, rubric shape). Pure and
 * safe to run in the browser, e.g. again after a teacher edits the text.
 */
export function consistencyWarnings(outputType: OutputType, content: Record<string, unknown>, lessonMinutes: number): string[] {
  const warnings: string[] = [];
  if (outputType === "lesson_plan" && Array.isArray(content.phases)) {
    const total = (content.phases as { minutes: number }[]).reduce((n, p) => n + (Number(p.minutes) || 0), 0);
    if (total !== lessonMinutes) warnings.push(`Phase timings add up to ${total} minutes, not ${lessonMinutes}. Adjust as needed.`);
  }
  if (outputType === "assessment" && Array.isArray(content.questions)) {
    const sum = (content.questions as { marks: number }[]).reduce((n, q) => n + (Number(q.marks) || 0), 0);
    if (sum !== Number(content.totalMarks)) warnings.push(`Question marks add up to ${sum}, but total marks says ${String(content.totalMarks)}.`);
  }
  if (outputType === "rubric" && Array.isArray(content.criteria) && Array.isArray(content.levelLabels)) {
    const n = (content.levelLabels as unknown[]).length;
    if ((content.criteria as { descriptors: unknown[] }[]).some((c) => c.descriptors.length !== n)) {
      warnings.push("Some rubric criteria don't have one descriptor per level. Check the table.");
    }
  }
  return warnings;
}

/** Replaces the consistency warnings in `warnings` with fresh ones for `content`. */
export function refreshWarnings(outputType: OutputType, content: Record<string, unknown>, lessonMinutes: number, warnings: string[]) {
  const kept = warnings.filter((w) => !CONSISTENCY_PREFIXES.some((p) => w.startsWith(p)));
  return [...kept, ...consistencyWarnings(outputType, content, lessonMinutes)];
}

type Json = unknown;

/** Removes codes that aren't in `allowed` from every `curriculumCodes` array, recording what was removed. */
function filterNestedCodes(value: Json, allowed: Set<string>, removed: Set<string>): Json {
  if (Array.isArray(value)) return value.map((v) => filterNestedCodes(v, allowed, removed));
  if (value && typeof value === "object") {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "curriculumCodes" && Array.isArray(v)) {
        out[k] = v
          .map((c) => String(c).trim().toUpperCase())
          .filter((c) => {
            if (allowed.has(c)) return true;
            removed.add(c);
            return false;
          });
      } else {
        out[k] = filterNestedCodes(v, allowed, removed);
      }
    }
    return out;
  }
  return value;
}

/**
 * Checks generated content against the curriculum: removes curriculum codes that aren't in the
 * data provided to the model (curriculumLinks and any nested curriculumCodes), and checks
 * lesson plan timings. Returns cleaned content and human-readable warnings.
 */
export function validateOutput<T extends Record<string, unknown>>(
  outputType: OutputType,
  content: T,
  allowedCodes: Set<string>,
  lessonMinutes: number,
): { content: T; warnings: string[] } {
  const warnings: string[] = [];
  const removed = new Set<string>();

  const links = Array.isArray(content.curriculumLinks) ? (content.curriculumLinks as { code: string; howAddressed: string }[]) : [];
  const curriculumLinks = links
    .map((l) => ({ ...l, code: String(l.code).trim().toUpperCase() }))
    .filter((l) => {
      if (allowedCodes.has(l.code)) return true;
      removed.add(l.code);
      return false;
    });

  const cleaned = filterNestedCodes({ ...content, curriculumLinks }, allowedCodes, removed) as T;

  for (const code of removed) {
    warnings.push(`Removed curriculum code "${code}" because it is not in the Victorian Curriculum data for this level.`);
  }
  if (curriculumLinks.length === 0) {
    warnings.push("No valid curriculum code was cited. Check the curriculum alignment before teaching.");
  }

  warnings.push(...consistencyWarnings(outputType, content, lessonMinutes));
  return { content: cleaned, warnings };
}
