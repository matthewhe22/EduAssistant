/**
 * Adapting an existing plan, such as a Victorian Lesson Plan (VLP) downloaded from the
 * Department's Arc site, instead of writing something new. The uploaded plan stays the
 * backbone; only what the teacher ticks is changed, and the changes are listed for them.
 */
import { z } from "zod";
import type { OutputType } from "./outputs";

/** Where teachers find the official Victorian Lesson Plans. */
export const ARC_LESSON_PLANS_URL = "https://arc.educationapps.vic.gov.au/learning/sites/lesson-plans";

export const ADAPT_GOALS = {
  fit_class: {
    label: "Fit my year level and class",
    prompt: "Pitch the content, language and examples to this year level and the class context. For a composite class, add clear adjustments for each year level.",
  },
  fit_length: {
    label: "Fit my lesson length",
    prompt: "Fit the lesson length given above. Trim or combine steps rather than rushing them, and keep the explicit teaching and practice.",
  },
  more_support: {
    label: "More support",
    prompt: "Add scaffolds for students who need more support (worked examples, sentence starters, manipulatives, smaller steps) without lowering the learning intention.",
  },
  extension: {
    label: "Add extension",
    prompt: "Add extension for students ready for more: reasoning, transfer and open problems, not just more of the same.",
  },
  eald: {
    label: "Support students learning English",
    prompt: "Add EAL/D support: pre-taught key vocabulary with visuals, sentence frames and time for talk before writing.",
  },
  hands_on: {
    label: "More hands-on",
    prompt: "Make the practice more hands-on and active, using cheap, common classroom materials.",
  },
  low_prep: {
    label: "Less preparation",
    prompt: "Cut preparation: swap hard-to-get resources for common ones and avoid anything that needs printing in colour, cutting out or laminating.",
  },
  simpler_language: {
    label: "Simpler student language",
    prompt: "Rewrite everything students read in shorter sentences and simpler words, keeping the key subject vocabulary.",
  },
} as const;

export type AdaptGoal = keyof typeof ADAPT_GOALS;
export const ADAPT_GOAL_IDS = Object.keys(ADAPT_GOALS) as [AdaptGoal, ...AdaptGoal[]];

export const AdaptSchema = z.object({
  goals: z.array(z.enum(ADAPT_GOAL_IDS)).max(ADAPT_GOAL_IDS.length).default([]),
});
export type Adapt = z.infer<typeof AdaptSchema>;

/** The field where the model lists its changes, per output type (none for a note home). */
const CHANGES_FIELD: Partial<Record<OutputType, string>> = {
  lesson_plan: "teacherNotes",
  unit_plan: "teacherNotes",
  activities: "teacherNotes",
  worksheet: "teacherNotes",
  differentiation: "teacherNotes",
  rubric: "moderationNotes",
  slides: "teacherNotes",
  puzzles: "teacherNotes",
};

/** Instructions for adapting the uploaded plan(s); empty when not adapting. */
export function adaptInstructions(adapt: Adapt | undefined, outputType: OutputType, fileNames: string[]): string {
  if (!adapt || !fileNames.length) return "";
  const names = fileNames.map((n) => `"${n}"`).join(", ");
  const field = CHANGES_FIELD[outputType];
  const goals = adapt.goals.map((g) => `- ${ADAPT_GOALS[g].prompt}`);
  return [
    `ADAPT, DON'T REPLACE: the teacher's uploaded plan (${names}) is the starting point. It may be an official Victorian Lesson Plan from the Department of Education's Arc site, already aligned to the Victorian Curriculum 2.0 and the VTLM 2.0.`,
    `Keep its learning intention, success criteria, teaching sequence, worked examples, key vocabulary, texts, contexts and curriculum focus unless a change below needs them altered. Do not invent a different lesson or topic, and keep its curriculum codes where they appear in the provided curriculum.`,
    goals.length ? `Make only these changes:\n${goals.join("\n")}` : `Change only what is needed to fit this class, year level and output type.`,
    field
      ? `Make the first item of ${field} start with "Adapted from ${fileNames[0].replace(/"/g, "'")}:" and say in one or two sentences what you kept and what you changed.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
