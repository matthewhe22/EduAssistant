import { z } from "zod";
import { getSubject } from "@/lib/curriculum";
import { PRIMARY_LEVELS } from "@/lib/curriculum/types";
import { deckToPptx, pptxFilename } from "@/lib/export/pptx";
import { SlideDeckSchema } from "@/lib/generator/schema";
import { classLabel } from "@/lib/ui/labels";

export const runtime = "nodejs";

const BodySchema = z.object({
  content: z.record(z.string(), z.unknown()),
  subjectSlug: z.string().regex(/^[a-z0-9-]+$/),
  level: z.enum(PRIMARY_LEVELS),
  secondLevel: z.enum(PRIMARY_LEVELS).optional(),
  lessonMinutes: z.number().int(),
});

/** Downloads a slide deck as an editable PowerPoint file. */
export async function POST(request: Request) {
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const deck = SlideDeckSchema.safeParse(body.data.content);
  if (!deck.success) return Response.json({ error: "Invalid content." }, { status: 400 });
  const { subjectSlug, level, secondLevel, lessonMinutes } = body.data;

  const subject = await getSubject(subjectSlug);
  const codeText: Record<string, string> = {};
  for (const band of subject?.bands ?? []) for (const cd of band.contentDescriptions) codeText[cd.code] = cd.text;

  const buffer = await deckToPptx(deck.data, {
    subject: subject?.subject ?? subjectSlug,
    levelLabel: classLabel(level, secondLevel),
    lessonMinutes,
    codeText,
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${pptxFilename(deck.data.title)}"`,
    },
  });
}
