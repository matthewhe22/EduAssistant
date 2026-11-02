import { getSubject } from "@/lib/curriculum";
import { prepareAttachment } from "@/lib/generator/attachments";
import { generateStructured } from "@/lib/generator/claude";
import { buildCurriculumContext, buildTeacherRequest } from "@/lib/generator/context";
import { OUTPUTS } from "@/lib/generator/outputs";
import { GenerateRequestSchema, type StoredTeacherInput } from "@/lib/generator/schema";
import { ndjsonResponse } from "@/lib/generator/stream";
import { validateOutput } from "@/lib/generator/validate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (supabase && !user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const parsed = GenerateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const req = parsed.data;
  const def = OUTPUTS[req.outputType];
  const subject = await getSubject(req.subjectSlug);
  if (!subject) return Response.json({ error: "Unknown subject." }, { status: 400 });
  const ctx = buildCurriculumContext(subject, req.level, req.difficulty);
  if (!ctx) {
    return Response.json({ error: `${subject.subject} has no curriculum content at this year level.` }, { status: 400 });
  }

  return ndjsonResponse(async (send, progress) => {
    const attachment = req.attachment ? await prepareAttachment(req.attachment) : undefined;
    const teacherRequest = buildTeacherRequest(
      req,
      subject,
      ctx,
      attachment && (attachment.kind === "text" ? { name: attachment.name, text: attachment.text } : { name: attachment.name }),
    );

    const result = await generateStructured({
      schema: def.schema,
      curriculumText: ctx.text,
      requestBlocks: [
        ...(attachment?.kind === "pdf"
          ? [{ type: "document" as const, title: attachment.name, source: { type: "base64" as const, media_type: "application/pdf" as const, data: attachment.data } }]
          : []),
        { type: "text", text: teacherRequest },
      ],
      onProgress: progress,
      signal: request.signal,
    });
    const { content, warnings } = validateOutput(req.outputType, result.content, ctx.allowedCodes, req.lessonMinutes);

    let generationId: string | null = null;
    if (supabase && user) {
      const { attachment: _file, ...rest } = req;
      const teacherInput: StoredTeacherInput = { ...rest, ...(req.attachment ? { attachmentName: req.attachment.name } : {}) };
      const { data, error } = await supabase
        .from("generations")
        .insert({
          user_id: user.id,
          title: String(content.title),
          level: req.level,
          subject_slug: subject.slug,
          output_type: req.outputType,
          difficulty: req.difficulty,
          teacher_input: teacherInput,
          curriculum_codes: (content.curriculumLinks as { code: string }[]).map((l) => l.code),
          content: { output: content, warnings },
          model: result.model,
          input_tokens: result.usage.inputTokens + result.usage.cacheReadTokens,
          output_tokens: result.usage.outputTokens,
        })
        .select("id")
        .single();
      if (error) {
        console.error("save failed", error);
        warnings.push("This could not be saved to your library.");
      } else {
        generationId = data.id;
      }
    }

    send({
      type: "result",
      outputType: req.outputType,
      content,
      warnings,
      generationId,
      usage: { ...result.usage, model: result.model },
    });
  });
}
