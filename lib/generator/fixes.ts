/**
 * Instant, deterministic fixes for problems the validator reports. These run in the browser,
 * so they're free and don't call the AI.
 */
import type { OutputType } from "./outputs";

type Content = Record<string, unknown>;

/**
 * Scales phase minutes so they add up to exactly `target`, keeping their proportions.
 * Uses largest-remainder rounding and keeps every phase at least 1 minute.
 */
export function rescaleMinutes(minutes: number[], target: number): number[] {
  const n = minutes.length;
  if (n === 0) return [];
  if (target < n) return minutes.map((_, i) => (i < target ? 1 : 0));
  const safe = minutes.map((m) => Math.max(0, Number(m) || 0));
  const total = safe.reduce((a, b) => a + b, 0);
  const weights = total > 0 ? safe : safe.map(() => 1);
  const wTotal = weights.reduce((a, b) => a + b, 0);
  // Reserve 1 minute per phase, share the rest proportionally.
  const spare = target - n;
  const exact = weights.map((w) => (w / wTotal) * spare);
  const out = exact.map((x) => 1 + Math.floor(x));
  let left = target - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) out[order[k].i] += 1;
  return out;
}

export interface Fix {
  id: "timings" | "marks";
  label: string;
  /** Prefix of the validator warning this fix resolves. */
  warningPrefix: string;
  apply: (content: Content) => Content;
}

export function phaseTotal(content: Content) {
  return Array.isArray(content.phases) ? (content.phases as { minutes: number }[]).reduce((n, p) => n + (Number(p.minutes) || 0), 0) : 0;
}

export function marksTotal(content: Content) {
  return Array.isArray(content.questions) ? (content.questions as { marks: number }[]).reduce((n, q) => n + (Number(q.marks) || 0), 0) : 0;
}

/** Fixes that apply to this content right now. */
export function availableFixes(outputType: OutputType, content: Content, lessonMinutes: number): Fix[] {
  const fixes: Fix[] = [];
  if (outputType === "lesson_plan" && Array.isArray(content.phases) && phaseTotal(content) !== lessonMinutes) {
    fixes.push({
      id: "timings",
      label: `Fix the timings to ${lessonMinutes} minutes`,
      warningPrefix: "Phase timings add up",
      apply: (c) => {
        const phases = c.phases as { minutes: number }[];
        const scaled = rescaleMinutes(phases.map((p) => p.minutes), lessonMinutes);
        return { ...c, phases: phases.map((p, i) => ({ ...p, minutes: scaled[i] })) };
      },
    });
  }
  if (outputType === "assessment" && Array.isArray(content.questions) && marksTotal(content) !== Number(content.totalMarks)) {
    fixes.push({
      id: "marks",
      label: `Set total marks to ${marksTotal(content)}`,
      warningPrefix: "Question marks add up",
      apply: (c) => ({ ...c, totalMarks: marksTotal(c) }),
    });
  }
  return fixes;
}
