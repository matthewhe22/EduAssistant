import { z } from "zod";
import type { OutputType } from "./outputs";

/**
 * The teacher's own lesson framework: seven fixed sections, each with standing requirements
 * (or wording to keep as written). It replaces the default VTLM 2.0 phase names, so a school's
 * usual lesson structure is set once (and saved in a template) and only the idea changes each time.
 */

export const FRAMEWORK_SECTIONS = [
  "learningIntention",
  "priorKnowledge",
  "conceptDevelopment",
  "guidedPractice",
  "relevance",
  "skillClosure",
  "independentTask",
] as const;
export type FrameworkSection = (typeof FRAMEWORK_SECTIONS)[number];

/** Phase names used in lesson plans (also accepted by LessonPlanSchema's phase enum). */
export const FRAMEWORK_PHASES = [
  "Learning intention",
  "Activate prior knowledge",
  "Concept development",
  "Guided practice",
  "Relevance",
  "Skill closure",
  "Independent task",
] as const;

export const FRAMEWORK_INFO: Record<FrameworkSection, { label: (typeof FRAMEWORK_PHASES)[number]; purpose: string; placeholder: string }> = {
  learningIntention: {
    label: "Learning intention",
    purpose: "Share the learning intention and success criteria in student-friendly words; students say them back in their own words.",
    placeholder: "e.g. Always start with “We are learning to…”. Students read it chorally, then tell a partner.",
  },
  priorKnowledge: {
    label: "Activate prior knowledge",
    purpose: "Briefly review the knowledge or skill students need for today and connect it to the new learning.",
    placeholder: "e.g. 3 quick questions on mini whiteboards about last lesson.",
  },
  conceptDevelopment: {
    label: "Concept development",
    purpose: "Explicitly teach the new concept: definition, examples and non-examples, modelling, worked examples and think-alouds, with checks for understanding.",
    placeholder: "e.g. Use a concrete material first, then a diagram. Include one non-example.",
  },
  guidedPractice: {
    label: "Guided practice",
    purpose: "Teacher and students work through examples together step by step, with frequent checks (mini whiteboards, cold calling), gradually releasing responsibility.",
    placeholder: "e.g. 3 problems, I do / we do / you do together. Students show answers on whiteboards.",
  },
  relevance: {
    label: "Relevance",
    purpose: "Why this matters: personal, school and real-world reasons to learn it; students discuss or give their own example.",
    placeholder: "e.g. Link to something from students' daily lives or our current class inquiry.",
  },
  skillClosure: {
    label: "Skill closure",
    purpose: "Before independent work, every student shows they can do it (e.g. one final problem) and summarises the key point; decide who needs more help.",
    placeholder: "e.g. One final question on whiteboards, then students complete “Today I learned…”.",
  },
  independentTask: {
    label: "Independent task",
    purpose: "Students practise on their own, with support and extension options.",
    placeholder: "e.g. 3 levels: mild, spicy, hot. Early finishers do a challenge card.",
  },
};

export const FRAMEWORK_MODES = ["guide", "keep", "skip"] as const;
export type FrameworkMode = (typeof FRAMEWORK_MODES)[number];
export const FRAMEWORK_MODE_LABELS: Record<FrameworkMode, string> = {
  guide: "My requirements",
  keep: "Keep my wording",
  skip: "Leave out",
};

export const FrameworkSectionSchema = z.object({
  mode: z.enum(FRAMEWORK_MODES).default("guide"),
  /** Requirements for this section, or the wording to keep. Empty: Lessonroo decides. */
  text: z.string().trim().max(1500).default(""),
  /** Fixed minutes for this section; 0 lets Lessonroo decide. */
  minutes: z.coerce.number().int().min(0).max(180).default(0),
});
export type FrameworkSectionInput = z.infer<typeof FrameworkSectionSchema>;

export const FrameworkSchema = z.object({
  /** Off keeps the requirements (e.g. in a template) but uses the default VTLM 2.0 sequence. */
  enabled: z.boolean().default(true),
  sections: z.object(Object.fromEntries(FRAMEWORK_SECTIONS.map((k) => [k, FrameworkSectionSchema.optional()])) as Record<FrameworkSection, z.ZodOptional<typeof FrameworkSectionSchema>>),
});
export type Framework = z.infer<typeof FrameworkSchema>;

/** Output types whose lesson structure the framework shapes. */
export const FRAMEWORK_OUTPUTS: readonly OutputType[] = ["lesson_plan", "slides", "unit_plan"];
export const usesFramework = (t: OutputType) => FRAMEWORK_OUTPUTS.includes(t);

export function emptyFramework(): Framework {
  return { enabled: true, sections: Object.fromEntries(FRAMEWORK_SECTIONS.map((k) => [k, { mode: "guide", text: "", minutes: 0 }])) as Framework["sections"] };
}

export function sectionOf(fw: Framework, key: FrameworkSection): FrameworkSectionInput {
  return fw.sections[key] ?? { mode: "guide", text: "", minutes: 0 };
}

/** The sections that stay in the lesson, in order. */
export function activeSections(fw: Framework) {
  return FRAMEWORK_SECTIONS.filter((k) => sectionOf(fw, k).mode !== "skip").map((k) => ({ key: k, ...FRAMEWORK_INFO[k], ...sectionOf(fw, k) }));
}

/** Minutes the teacher fixed, across the sections that stay in. */
export function fixedMinutes(fw: Framework) {
  return activeSections(fw).reduce((n, s) => n + s.minutes, 0);
}

/** Text added to the teacher request, telling the model to follow the framework. */
export function frameworkInstructions(fw: Framework | undefined, outputType: OutputType, lessonMinutes: number): string {
  if (!fw?.enabled || !usesFramework(outputType)) return "";
  const sections = activeSections(fw);
  if (!sections.length) return "";
  const lines = sections.map((s, i) => {
    const parts = [`${i + 1}. ${s.label}${s.minutes ? ` (${s.minutes} minutes)` : ""}. Purpose: ${s.purpose}`];
    if (s.text && s.mode === "keep") {
      parts.push(`   The teacher's wording for this section, to use as written (only fill in any [square-bracket] placeholders for this lesson):\n   """\n   ${s.text.replace(/\n/g, "\n   ")}\n   """`);
    } else if (s.text) {
      parts.push(`   The teacher's requirements for this section (follow them; be creative within them):\n   """\n   ${s.text.replace(/\n/g, "\n   ")}\n   """`);
    } else {
      parts.push(`   No extra requirements: plan this section to suit the idea.`);
    }
    return parts.join("\n");
  });
  const skipped = FRAMEWORK_SECTIONS.filter((k) => sectionOf(fw, k).mode === "skip").map((k) => FRAMEWORK_INFO[k].label);
  const names = sections.map((s) => `"${s.label}"`).join(", ");
  const fixed = fixedMinutes(fw);
  const how: Partial<Record<OutputType, string>> = {
    lesson_plan: `Use exactly these phases in this order as the lesson sequence (phase names ${names}), one phase each.${fixed ? ` Keep the minutes the teacher fixed and share the remaining ${Math.max(0, lessonMinutes - fixed)} minutes between the other phases.` : ""} Put the exit ticket in assessment.exitTicket.`,
    slides: `Order the content slides by these sections. The learning intention section is the automatic learning intention slide, so its requirements apply to learningIntention and successCriteria. Start each slide's speakerNotes with the section name in square brackets, e.g. "[Guided practice]".`,
    unit_plan: `Every lesson in the unit follows this structure: write each lesson's keyActivities in this order, starting each with the section name and a colon (e.g. "Activate prior knowledge: …"). Apply the teacher's requirements to every lesson.`,
  };
  return [
    `The teacher uses their own lesson framework. It replaces the default VTLM 2.0 lesson sequence (keep VTLM 2.0's explicit teaching principles within it). The sections, in order:`,
    ...lines,
    skipped.length ? `Leave out: ${skipped.join(", ")}.` : "",
    how[outputType] ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Warnings when a lesson plan doesn't follow the framework the teacher asked for. */
export function frameworkWarnings(fw: Framework | undefined, outputType: OutputType, content: Record<string, unknown>): string[] {
  if (!fw?.enabled || outputType !== "lesson_plan" || !Array.isArray(content.phases)) return [];
  const phases = (content.phases as { phase: string; minutes: number }[]).map((p) => p.phase);
  const warnings: string[] = [];
  const missing = activeSections(fw).filter((s) => !phases.includes(s.label)).map((s) => s.label);
  if (missing.length) warnings.push(`Your framework section${missing.length === 1 ? "" : "s"} ${missing.map((m) => `“${m}”`).join(", ")} ${missing.length === 1 ? "is" : "are"} missing from the lesson sequence.`);
  return warnings;
}
