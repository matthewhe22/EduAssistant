import { z } from "zod";
import { getSubject } from "@/lib/curriculum";
import { PRIMARY_LEVELS } from "@/lib/curriculum/types";
import { findImages } from "@/lib/export/images";
import { outputToPptx, pptxFilename } from "@/lib/export/pptx";
import { THEME_IDS } from "@/lib/export/themes";
import { OUTPUT_TYPES, OUTPUTS } from "@/lib/generator/outputs";
import { classLabel } from "@/lib/ui/labels";

export const runtime = "nodejs";
/** Finding photos can take a few seconds per slide. */
export const maxDuration = 60;

const BodySchema = z.object({
  outputType: z.enum(OUTPUT_TYPES).default("slides"),
  content: z.record(z.string(), z.unknown()),
  subjectSlug: z.string().regex(/^[a-z0-9-]+$/),
  level: z.enum(PRIMARY_LEVELS),
  secondLevel: z.enum(PRIMARY_LEVELS).optional(),
  lessonMinutes: z.number().int(),
  /** Leave out answers and teacher notes (worksheets, quizzes, tiered tasks). */
  studentOnly: z.boolean().optional(),
  /** Look of the deck (lib/export/themes.ts). */
  theme: z.enum(THEME_IDS).optional(),
  /** Add free, openly licensed photos where the slides have photo search words. */
  photos: z.boolean().optional(),
});

/** Downloads any output type as an editable PowerPoint file. */
export async function POST(request: Request) {
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { outputType, subjectSlug, level, secondLevel, lessonMinutes, studentOnly, theme, photos } = body.data;
  const content = OUTPUTS[outputType].schema.safeParse(body.data.content);
  if (!content.success) return Response.json({ error: "Invalid content." }, { status: 400 });

  const subject = await getSubject(subjectSlug);
  const codeText: Record<string, string> = {};
  for (const band of subject?.bands ?? []) for (const cd of band.contentDescriptions) codeText[cd.code] = cd.text;

  const buffer = await outputToPptx(outputType, content.data, {
    subject: subject?.subject ?? subjectSlug,
    levelLabel: classLabel(level, secondLevel),
    lessonMinutes,
    codeText,
    studentOnly,
    level,
    theme,
    findPhotos: photos ? (queries) => findImages(queries) : undefined,
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${pptxFilename(String(content.data.title) + (studentOnly ? " student copy" : ""))}"`,
    },
  });
}
