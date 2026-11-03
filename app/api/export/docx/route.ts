import { z } from "zod";
import { getSubject } from "@/lib/curriculum";
import { PRIMARY_LEVELS } from "@/lib/curriculum/types";
import { classLabel } from "@/lib/ui/labels";
import { docxFilename, outputToDocx } from "@/lib/export/docx";
import { OUTPUT_TYPES, OUTPUTS } from "@/lib/generator/outputs";

export const runtime = "nodejs";

const BodySchema = z.object({
  outputType: z.enum(OUTPUT_TYPES),
  content: z.record(z.string(), z.unknown()),
  subjectSlug: z.string().regex(/^[a-z0-9-]+$/),
  level: z.enum(PRIMARY_LEVELS),
  secondLevel: z.enum(PRIMARY_LEVELS).optional(),
  lessonMinutes: z.number().int(),
  /** Leave out answers and teacher notes (worksheets, quizzes, tiered tasks). */
  studentOnly: z.boolean().optional(),
});

export async function POST(request: Request) {
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { outputType, subjectSlug, level, secondLevel, lessonMinutes, studentOnly } = body.data;
  const content = OUTPUTS[outputType].schema.safeParse(body.data.content);
  if (!content.success) return Response.json({ error: "Invalid content." }, { status: 400 });

  const subject = await getSubject(subjectSlug);
  const codeText: Record<string, string> = {};
  for (const band of subject?.bands ?? []) for (const cd of band.contentDescriptions) codeText[cd.code] = cd.text;

  const buffer = await outputToDocx(outputType, content.data, {
    subject: subject?.subject ?? subjectSlug,
    levelLabel: classLabel(level, secondLevel),
    lessonMinutes,
    codeText,
    studentOnly,
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${docxFilename(String(content.data.title) + (studentOnly ? " student copy" : ""))}"`,
    },
  });
}
