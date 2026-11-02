import { getSubject } from "@/lib/curriculum";
import { resolveAiConfig } from "@/lib/ai/config";
import { generateStructured } from "@/lib/generator/llm";
import { buildCurriculumContext } from "@/lib/generator/context";
import { OUTPUTS } from "@/lib/generator/outputs";
import { RefineRequestSchema } from "@/lib/generator/schema";
import { ndjsonResponse } from "@/lib/generator/stream";
import { validateOutput } from "@/lib/generator/validate";
import { updateGenerationContent } from "@/lib/data/generations";
import { budgetGuard, optionalUser, recordUsage } from "@/lib/library/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rewrites one top-level section of generated content following the teacher's instruction.
 * Only that section is taken from the model's answer; everything else is kept as it was.
 */
export async function POST(request: Request) {
  const auth = await optionalUser();
  if (!auth.ok) return auth.error;
  const { db, user } = auth;

  const parsed = RefineRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const req = parsed.data;
  const def = OUTPUTS[req.outputType];
  const sectionLabel = def.sections[req.section];
  if (!sectionLabel) return Response.json({ error: "That section can't be refined." }, { status: 400 });
  const current = def.schema.safeParse(req.content);
  if (!current.success) return Response.json({ error: "The current content is not valid." }, { status: 400 });

  const subject = await getSubject(req.subjectSlug);
  const ctx = subject && buildCurriculumContext(subject, req.level, req.difficulty);
  if (!subject || !ctx) return Response.json({ error: "Unknown subject or level." }, { status: 400 });

  if (db && user) {
    const blocked = await budgetGuard(db, user.id);
    if (blocked) return blocked;
  }

  return ndjsonResponse(async (send, progress) => {
    const instructions = [
      `Output: ${def.label} (revision of one section).`,
      `Here is the current ${def.label.toLowerCase()} as JSON:`,
      `<current>`,
      JSON.stringify(current.data, null, 1),
      `</current>`,
      ``,
      `Rewrite only the "${req.section}" field (${sectionLabel}) following the teacher's instruction below. Keep it consistent with the rest of the document and with the curriculum. Return the complete JSON object and copy every other field exactly as it is.`,
      `Teacher's instruction:`,
      `"""`,
      req.instruction,
      `"""`,
    ].join("\n");

    const result = await generateStructured({
      schema: def.schema,
      ai: await resolveAiConfig(db, user?.id ?? null),
      curriculumText: ctx.text, // same prefix as the original generation, so it can hit the cache
      requestText: instructions,
      onProgress: progress,
      signal: request.signal,
    });

    const merged = { ...current.data, [req.section]: (result.content as Record<string, unknown>)[req.section] };
    const { content, warnings } = validateOutput(req.outputType, merged, ctx.allowedCodes, req.lessonMinutes);

    let generationId: string | null = null;
    if (db && user) {
      if (req.generationId) {
        generationId = await updateGenerationContent(db, user.id, req.generationId, String(content.title), { output: content, warnings }).catch(() => null);
        if (!generationId) warnings.push("The change could not be saved to your library.");
      }
      await recordUsage(db, { userId: user.id, generationId, kind: "refine", outputType: req.outputType, model: result.model, usage: result.usage });
    }

    send({ type: "result", outputType: req.outputType, content, warnings, generationId, usage: { ...result.usage, model: result.model } });
  });
}
