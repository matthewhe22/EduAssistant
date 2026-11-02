import type { LessonPlan } from "./schema";

/**
 * Removes curriculum links whose code is not in the provided curriculum and checks timings.
 * Returns the cleaned plan and human-readable warnings.
 */
export function validatePlan(plan: LessonPlan, allowedCodes: Set<string>, lessonMinutes: number) {
  const warnings: string[] = [];

  const curriculumLinks = plan.curriculumLinks.filter((link) => {
    const code = link.code.trim().toUpperCase();
    if (allowedCodes.has(code)) return true;
    warnings.push(`Removed curriculum code "${link.code}" because it is not in the Victorian Curriculum data for this level.`);
    return false;
  });
  if (curriculumLinks.length === 0) {
    warnings.push("No valid curriculum code was cited. Check the curriculum alignment before teaching.");
  }

  const total = plan.phases.reduce((n, p) => n + p.minutes, 0);
  if (total !== lessonMinutes) {
    warnings.push(`Phase timings add up to ${total} minutes, not ${lessonMinutes}. Adjust as needed.`);
  }

  return {
    plan: { ...plan, curriculumLinks: curriculumLinks.map((l) => ({ ...l, code: l.code.trim().toUpperCase() })) },
    warnings,
  };
}
