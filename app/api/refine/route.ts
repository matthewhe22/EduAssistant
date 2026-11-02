import { getSubject } from "@/lib/curriculum";
import { generateStructured } from "@/lib/generator/claude";
import { buildCurriculumContext } from "@/lib/generator/context";
import { OUTPUTS } from "@/lib/generator/outputs";
import { RefineRequestSchema } from "@/lib/generator/schema";
import { ndjsonResponse } from "@/lib/generator/stream";
import { validateOutput } from "@/lib/generator/validate";
import { budgetGuard, recordUsage } from "@/lib/library/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rewrites one top-level section of generated content following the teacher's instruction.
 * Only that section is taken from the model's answer; everything else is kept as it was.
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (supabase && !user) return Response.json({ error: "Please sign in." }, { status: 401 });

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

  if (supabase && user) {
    const blocked = await budgetGuard(supabase, user.id);
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
      curriculumText: ctx.text, // same cached block as the original generation
      requestBlocks: [{ type: "text", text: instructions }],
      onProgress: progress,
      signal: request.signal,
    });

    const merged = { ...current.data, [req.section]: (result.content as Record<string, unknown>)[req.section] };
    const { content, warnings } = validateOutput(req.outputType, merged, ctx.allowedCodes, req.lessonMinutes);

    let generationId: string | null = null;
    if (supabase && user && req.generationId) {
      const { data, error } = await supabase
        .from("generations")
        .update({ content: { output: content, warnings }, title: String(content.title), updated_at: new Date().toISOString() })
        .eq("id", req.generationId)
        .select("id")
        .maybeSingle();
      if (error || !data) warnings.push("The change could not be saved to your library.");
      else generationId = data.id;
    }
    if (supabase && user) {
      await recordUsage(supabase, { userId: user.id, generationId, kind: "refine", outputType: req.outputType, model: result.model, usage: result.usage });
    }

    send({ type: "result", outputType: req.outputType, content, warnings, generationId, usage: { ...result.usage, model: result.model } });
  });
}
