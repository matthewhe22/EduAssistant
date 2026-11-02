import { getSubject } from "@/lib/curriculum";
import { prepareAttachment } from "@/lib/generator/attachments";
import { resolveAiConfig } from "@/lib/ai/config";
import { generateStructured } from "@/lib/generator/llm";
import { buildCurriculumContext, buildTeacherRequest } from "@/lib/generator/context";
import { OUTPUTS } from "@/lib/generator/outputs";
import { GenerateRequestSchema, type StoredTeacherInput } from "@/lib/generator/schema";
import { ndjsonResponse } from "@/lib/generator/stream";
import { validateOutput } from "@/lib/generator/validate";
import { insertGeneration } from "@/lib/data/generations";
import { budgetGuard, optionalUser, recordUsage } from "@/lib/library/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await optionalUser();
  if (!auth.ok) return auth.error;
  const { db, user } = auth;

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

  if (db && user) {
    const blocked = await budgetGuard(db, user.id);
    if (blocked) return blocked;
  }

  return ndjsonResponse(async (send, progress) => {
    const ai = await resolveAiConfig(db, user?.id ?? null);
    const attachment = req.attachment ? await prepareAttachment(req.attachment) : undefined;
    const result = await generateStructured({
      schema: def.schema,
      ai,
      curriculumText: ctx.text,
      requestText: buildTeacherRequest(req, subject, ctx, attachment),
      onProgress: progress,
      signal: request.signal,
    });
    const { content, warnings } = validateOutput(req.outputType, result.content, ctx.allowedCodes, req.lessonMinutes);

    let generationId: string | null = null;
    if (db && user) {
      const { attachment: _file, ...rest } = req;
      const teacherInput: StoredTeacherInput = { ...rest, ...(req.attachment ? { attachmentName: req.attachment.name } : {}) };
      try {
        generationId = await insertGeneration(db, user.id, {
          title: String(content.title),
          level: req.level,
          subjectSlug: subject.slug,
          outputType: req.outputType,
          difficulty: req.difficulty,
          teacherInput,
          curriculumCodes: (content.curriculumLinks as { code: string }[]).map((l) => l.code),
          content: { output: content, warnings },
          model: result.model,
          inputTokens: result.usage.inputTokens + result.usage.cacheWriteTokens,
          cacheWriteTokens: result.usage.cacheWriteTokens,
          cacheReadTokens: result.usage.cacheReadTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: result.usage.costUsd,
        });
      } catch (err) {
        console.error("save failed", err);
        warnings.push("This could not be saved to your library.");
      }
      await recordUsage(db, { userId: user.id, generationId, kind: "generate", outputType: req.outputType, model: result.model, usage: result.usage });
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
