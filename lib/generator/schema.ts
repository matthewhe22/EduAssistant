import { z } from "zod";
import { PRIMARY_LEVELS } from "../curriculum/types";

/* ------------------------------------------------------------------ */
/* Teacher request                                                     */
/* ------------------------------------------------------------------ */

export const DIFFICULTIES = ["below", "at", "above", "mixed"] as const;
export const DIFFICULTY_LABELS: Record<(typeof DIFFICULTIES)[number], string> = {
  below: "Below level (more scaffolding)",
  at: "At level",
  above: "Above level (extension)",
  mixed: "Mixed: support, core and extension tiers",
};

export const LESSON_LENGTHS = [30, 45, 50, 60, 90] as const;

export const GenerateRequestSchema = z.object({
  level: z.enum(PRIMARY_LEVELS),
  subjectSlug: z.string().regex(/^[a-z0-9-]+$/),
  idea: z.string().trim().min(5, "Describe your idea or rough plan").max(4000),
  difficulty: z.enum(DIFFICULTIES),
  lessonMinutes: z.coerce.number().int().min(15).max(180),
  /** Optional content description codes the teacher wants to focus on. */
  focusCodes: z.array(z.string().max(20)).max(10).default([]),
  /** Optional class context (no student names), e.g. "6 EAL/D students, 2 with ADHD". */
  classContext: z.string().trim().max(1000).default(""),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/* ------------------------------------------------------------------ */
/* Lesson plan (structured output from Claude)                         */
/* Keep to features supported by structured outputs: no min/max etc.  */
/* ------------------------------------------------------------------ */

export const PHASES = [
  "Daily review",
  "Focus the learning",
  "Explicit teaching",
  "Guided practice",
  "Independent practice",
  "Reflection",
] as const;

export const LessonPlanSchema = z.object({
  title: z.string().describe("Short, teacher-facing lesson title"),
  overview: z.string().describe("Two or three sentences: what students learn and why it matters"),
  curriculumLinks: z
    .array(
      z.object({
        code: z.string().describe("A VCAA content description code copied exactly from the provided curriculum"),
        howAddressed: z.string().describe("One sentence on how this lesson addresses the content description"),
      }),
    )
    .describe("1–3 content descriptions this lesson addresses, taken only from the provided curriculum"),
  learningIntention: z.string().describe("'We are learning to…' statement"),
  successCriteria: z.array(z.string()).describe("3–4 'I can…' statements drawn from the achievement standard"),
  vocabulary: z.array(z.object({ term: z.string(), studentFriendlyDefinition: z.string() })),
  resources: z.array(z.string()).describe("Materials and preparation the teacher needs"),
  phases: z
    .array(
      z.object({
        phase: z.enum(PHASES),
        minutes: z.number().int(),
        teacher: z.array(z.string()).describe("What the teacher does and says, including worked examples"),
        students: z.array(z.string()).describe("What students do"),
        checkForUnderstanding: z.string().describe("How the teacher checks understanding in this phase; empty string if none"),
      }),
    )
    .describe("Lesson sequence; minutes must add up to the lesson length"),
  differentiation: z.object({
    support: z.array(z.string()),
    extension: z.array(z.string()),
    ealD: z.array(z.string()).describe("Support for EAL/D learners"),
  }),
  assessment: z.object({
    formative: z.array(z.string()),
    exitTicket: z.string().describe("A specific exit ticket question or task"),
  }),
  crossCurriculum: z
    .array(z.string())
    .describe("Capabilities or cross-curriculum priorities genuinely addressed; empty if none"),
  teacherNotes: z.array(z.string()).describe("Misconceptions to watch for, safety notes, follow-up lesson ideas"),
});
export type LessonPlan = z.infer<typeof LessonPlanSchema>;

/* ------------------------------------------------------------------ */
/* Streaming protocol between /api/generate and the browser (NDJSON)   */
/* ------------------------------------------------------------------ */

export type GenerateEvent =
  | { type: "progress"; characters: number }
  | {
      type: "result";
      plan: LessonPlan;
      warnings: string[];
      generationId: string | null;
      usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; model: string };
    }
  | { type: "error"; message: string };
