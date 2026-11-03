/**
 * The animated demos on the home page are driven by one clock: 160 ticks of 90 ms, about 14 seconds a loop.
 * Everything is computed from the tick number, so the pure function below is easy to test, and the
 * finished state (STILL_TICK) is what server rendering, no-JavaScript visitors and visitors who
 * prefer reduced motion see.
 */
export const TICK_MS = 90;
export const TICKS = 160;
export const STILL_TICK = 140;

export const LESSON_PHASES = [
  { name: "Daily review", minutes: 5, text: "Short retrieval practice of earlier learning, so knowledge sticks." },
  { name: "Focus the learning", minutes: 5, text: "Share the learning intention and success criteria, and connect to what students know." },
  { name: "Explicit teaching", minutes: 15, text: "Clear explanation and modelling with worked examples, in small steps." },
  { name: "Guided practice", minutes: 15, text: "Scaffolded practice with frequent checks for understanding." },
  { name: "Independent practice", minutes: 15, text: "Supported application, with differentiation for each learner." },
  { name: "Reflection", minutes: 5, text: "Students check themselves against the success criteria, with an exit ticket." },
] as const;

export const HERO_IDEA = ["Equivalent fractions with paper strips.", "A few mixed up halves and quarters last week, so start with a quick review."] as const;
export const YEAR_BUTTONS = ["Prep", "1", "2", "3", "4", "5", "6"] as const;
export const PICK_OUTPUTS = ["lesson_plan", "worksheet", "rubric", "assessment"] as const;
export const FAN_OUTPUTS = ["lesson_plan", "worksheet", "assessment", "rubric", "parent_note"] as const;
export const MATCH_LABELS = ["Worksheet", "Quiz", "Note home"] as const;
export const CHECK_TEXTS = [
  "Curriculum codes checked against the curriculum",
  "Timings add up to your lesson length",
  "Student copy with the answers left out",
  "Every change can be undone",
] as const;
export const DOC_SAMPLES = [
  { kind: "Lesson plan", pre: "Name the", term: "denominator", post: "as the number of equal parts." },
  { kind: "Worksheet", pre: "Circle the", term: "denominator", post: "in each fraction." },
  { kind: "Quiz", pre: "What does the", term: "denominator", post: "tell you?" },
] as const;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function frame(t: number) {
  const p = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const fade = r2(1 - p(146, 158));
  const longestPhase = Math.max(...LESSON_PHASES.map((x) => x.minutes));

  const hero = {
    fade,
    typed1: HERO_IDEA[0].slice(0, Math.round(HERO_IDEA[0].length * p(4, 26))),
    typed2: HERO_IDEA[1].slice(0, Math.round(HERO_IDEA[1].length * p(28, 62))),
    chipOpacity: r2(p(64, 68)),
    sheetOpacity: r2(p(70, 78)),
    sheetOffset: Math.round((1 - p(70, 78)) * 28),
    phases: LESSON_PHASES.map((ph, i) => ({
      name: ph.name,
      minutes: ph.minutes,
      percent: Math.round((ph.minutes / longestPhase) * 100),
      grow: r2(p(80 + 5 * i, 85 + 5 * i)),
    })),
    totalOpacity: r2(p(112, 116)),
    matches: MATCH_LABELS.map((label, j) => ({ label, opacity: r2(p(120 + 6 * j, 126 + 6 * j)) })),
  };

  const yearSelected = t === STILL_TICK ? 3 : [3, 4, 5][Math.floor(t / 22) % 3];
  const pickSelected = t === STILL_TICK ? 0 : Math.floor(t / 30) % 4;
  const edited = t === STILL_TICK ? true : t >= 40 && t < 100;
  const undone = t !== STILL_TICK && t >= 100 && t < 124;
  const phaseSelected = t === STILL_TICK ? 2 : Math.floor(t / 26) % 6;

  return {
    hero,
    fade,
    yearSelected,
    pickSelected,
    edit: { edited, undone },
    fan: FAN_OUTPUTS.map((_, i) => ({ opacity: r2(p(10 + 9 * i, 18 + 9 * i)), offset: Math.round((1 - p(10 + 9 * i, 18 + 9 * i)) * -28) })),
    docHighlight: [r2(p(22, 30) * 0.75), r2(p(54, 62) * 0.75), r2(p(86, 94) * 0.75)],
    checks: CHECK_TEXTS.map((_, i) => r2(p(15 + 22 * i, 22 + 22 * i))),
    phaseSelected,
  };
}

export type Frame = ReturnType<typeof frame>;
