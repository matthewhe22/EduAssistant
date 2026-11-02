import { z } from "zod";
import { getSubject } from "@/lib/curriculum";
import { LEVEL_LABELS, PRIMARY_LEVELS } from "@/lib/curriculum/types";
import { docxFilename, lessonPlanToDocx } from "@/lib/export/docx";
import { LessonPlanSchema } from "@/lib/generator/schema";

export const runtime = "nodejs";

const BodySchema = z.object({
  plan: LessonPlanSchema,
  subjectSlug: z.string().regex(/^[a-z0-9-]+$/),
  level: z.enum(PRIMARY_LEVELS),
  lessonMinutes: z.number().int(),
});

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid plan." }, { status: 400 });
  const { plan, subjectSlug, level, lessonMinutes } = parsed.data;

  const subject = await getSubject(subjectSlug);
  const codeText: Record<string, string> = {};
  for (const band of subject?.bands ?? []) for (const cd of band.contentDescriptions) codeText[cd.code] = cd.text;

  const buffer = await lessonPlanToDocx(plan, {
    subject: subject?.subject ?? subjectSlug,
    levelLabel: LEVEL_LABELS[level],
    lessonMinutes,
    codeText,
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${docxFilename(plan.title)}"`,
    },
  });
}
