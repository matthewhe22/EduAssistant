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

/** Uploaded plans and reference material, converted to text on the server (lib/generator/attachments.ts). */
export const ATTACHMENT_TYPES = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "text/plain": "Text",
  "text/markdown": "Markdown",
} as const;
const PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MB = 1024 * 1024;
/** PDF, Word and text files. */
export const MAX_ATTACHMENT_BYTES = 5 * MB;
/** PowerPoint files are mostly pictures, and only their text is used, so they may be larger. */
export const MAX_PPTX_BYTES = 20 * MB;
/** All files in one request together. */
export const MAX_TOTAL_ATTACHMENT_BYTES = 40 * MB;
export const maxBytesFor = (mediaType: string) => (mediaType === PPTX_TYPE ? MAX_PPTX_BYTES : MAX_ATTACHMENT_BYTES);
export const formatMb = (bytes: number) => `${Math.round(bytes / MB)} MB`;
/** Length of `bytes` bytes once base64-encoded. */
const base64Length = (bytes: number) => Math.ceil(bytes / 3) * 4;
/** Reference files per request. */
export const MAX_ATTACHMENTS = 5;

export const AttachmentSchema = z
  .object({
    name: z.string().max(200),
    mediaType: z.enum(Object.keys(ATTACHMENT_TYPES) as [keyof typeof ATTACHMENT_TYPES, ...(keyof typeof ATTACHMENT_TYPES)[]]),
    /** Base64 file contents (no data: prefix). */
    data: z
      .string()
      .max(base64Length(MAX_PPTX_BYTES), `File is larger than ${formatMb(MAX_PPTX_BYTES)}`)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/, "Invalid file encoding"),
  })
  .refine((a) => a.data.length <= base64Length(maxBytesFor(a.mediaType)), {
    message: `PDF, Word and text files can be at most ${formatMb(MAX_ATTACHMENT_BYTES)} (PowerPoint ${formatMb(MAX_PPTX_BYTES)})`,
    path: ["data"],
  });
export type Attachment = z.infer<typeof AttachmentSchema>;

/** Existing material a new item should match (e.g. a worksheet for a lesson plan). */
export const BasedOnSchema = z
  .object({
    outputType: z.enum(OUTPUT_TYPES),
    title: z.string().max(300),
    content: z.record(z.string(), z.unknown()),
    generationId: z.string().uuid().nullable().optional(),
  })
  .refine((b) => JSON.stringify(b.content).length <= 80_000, { message: "The source material is too long", path: ["content"] });
export type BasedOn = z.infer<typeof BasedOnSchema>;

export const GenerateRequestSchema = z
  .object({
    outputType: z.enum(OUTPUT_TYPES).default("lesson_plan"),
    level: z.enum(PRIMARY_LEVELS),
    /** Second year level for a composite class (e.g. Year 3/4). */
    secondLevel: z.enum(PRIMARY_LEVELS).optional(),
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
    /** A single uploaded plan (older clients). */
    attachment: AttachmentSchema.optional(),
    /** Reference material: existing plans, slides, readings or worksheets. */
    attachments: z.array(AttachmentSchema).max(MAX_ATTACHMENTS, `Upload at most ${MAX_ATTACHMENTS} files`).default([]),
    basedOn: BasedOnSchema.optional(),
  })
  .refine((r) => (r.attachment ? 1 : 0) + r.attachments.length <= MAX_ATTACHMENTS, { message: `Upload at most ${MAX_ATTACHMENTS} files`, path: ["attachments"] })
  .refine((r) => [r.attachment, ...r.attachments].reduce((n, a) => n + (a?.data.length ?? 0), 0) <= base64Length(MAX_TOTAL_ATTACHMENT_BYTES), {
    message: `Together your files are larger than ${formatMb(MAX_TOTAL_ATTACHMENT_BYTES)}`,
    path: ["attachments"],
  })
  .refine((r) => r.idea.length >= 5 || r.attachment || r.attachments.length > 0 || r.basedOn, {
    message: "Describe your idea or rough plan, or upload an existing plan",
    path: ["idea"],
  })
  .refine((r) => !r.secondLevel || r.secondLevel !== r.level, { message: "Pick two different year levels", path: ["secondLevel"] });
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/** What is stored in generations.teacher_input (the file itself is not stored). */
export type StoredTeacherInput = Omit<GenerateRequest, "attachment" | "attachments" | "basedOn"> & {
  /** Older rows: the single uploaded file. */
  attachmentName?: string;
  attachmentNames?: string[];
  basedOn?: { outputType: OutputType; title: string; generationId?: string | null };
};

/** Every uploaded file in a request (the older single `attachment` first). */
export function requestAttachments(req: Pick<GenerateRequest, "attachment" | "attachments">): Attachment[] {
  return [...(req.attachment ? [req.attachment] : []), ...req.attachments];
}

export const RefineRequestSchema = z.object({
  outputType: z.enum(OUTPUT_TYPES),
  level: z.enum(PRIMARY_LEVELS),
  secondLevel: z.enum(PRIMARY_LEVELS).optional(),
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
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

export type GenerateEvent =
  | { type: "progress"; characters: number; section?: string }
  | {
      type: "result";
      outputType: OutputType;
      content: Record<string, unknown>;
      warnings: string[];
      generationId: string | null;
      usage: Usage;
    }
  | { type: "error"; message: string };
