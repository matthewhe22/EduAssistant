import { z } from "zod";
import { PRIMARY_LEVELS } from "../curriculum/types";
import { OUTPUT_TYPES, type OutputType } from "./outputs";

export * from "./outputs/schemas";

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

/** Uploaded plans: PDF goes to Claude as a document; DOCX/TXT/MD are converted to text. */
export const ATTACHMENT_TYPES = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "text/plain": "Text",
  "text/markdown": "Markdown",
} as const;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const AttachmentSchema = z.object({
  name: z.string().max(200),
  mediaType: z.enum(Object.keys(ATTACHMENT_TYPES) as [keyof typeof ATTACHMENT_TYPES, ...(keyof typeof ATTACHMENT_TYPES)[]]),
  /** Base64 file contents (no data: prefix). */
  data: z
    .string()
    .max(Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 4, "File is larger than 5 MB")
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, "Invalid file encoding"),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const GenerateRequestSchema = z
  .object({
    outputType: z.enum(OUTPUT_TYPES).default("lesson_plan"),
    level: z.enum(PRIMARY_LEVELS),
    subjectSlug: z.string().regex(/^[a-z0-9-]+$/),
    idea: z.string().trim().max(4000).default(""),
    difficulty: z.enum(DIFFICULTIES),
    lessonMinutes: z.coerce.number().int().min(15).max(180),
    /** Lessons / questions / activities, depending on the output type. */
    itemCount: z.coerce.number().int().min(1).max(30).optional(),
    /** Optional content description codes the teacher wants to focus on. */
    focusCodes: z.array(z.string().max(20)).max(10).default([]),
    /** Optional class context (no student names). */
    classContext: z.string().trim().max(1000).default(""),
    attachment: AttachmentSchema.optional(),
  })
  .refine((r) => r.idea.length >= 5 || r.attachment, {
    message: "Describe your idea or rough plan, or upload an existing plan",
    path: ["idea"],
  });
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/** What is stored in generations.teacher_input (the file itself is not stored). */
export type StoredTeacherInput = Omit<GenerateRequest, "attachment"> & { attachmentName?: string };

export const RefineRequestSchema = z.object({
  outputType: z.enum(OUTPUT_TYPES),
  level: z.enum(PRIMARY_LEVELS),
  subjectSlug: z.string().regex(/^[a-z0-9-]+$/),
  difficulty: z.enum(DIFFICULTIES),
  lessonMinutes: z.coerce.number().int().min(15).max(180),
  section: z.string().regex(/^[A-Za-z]+$/),
  instruction: z.string().trim().min(3, "Say how you want this section changed").max(1000),
  content: z.record(z.string(), z.unknown()),
  generationId: z.string().uuid().nullable().optional(),
});
export type RefineRequest = z.infer<typeof RefineRequestSchema>;

/* ------------------------------------------------------------------ */
/* Streaming protocol between the API and the browser (NDJSON)         */
/* ------------------------------------------------------------------ */

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  model: string;
}

export type GenerateEvent =
  | { type: "progress"; characters: number }
  | {
      type: "result";
      outputType: OutputType;
      content: Record<string, unknown>;
      warnings: string[];
      generationId: string | null;
      usage: Usage;
    }
  | { type: "error"; message: string };
