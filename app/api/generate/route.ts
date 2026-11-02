import { getSubject } from "@/lib/curriculum";
import { buildCurriculumContext, buildTeacherRequest } from "@/lib/generator/context";
import { Anthropic, GenerationError, generateLessonPlan } from "@/lib/generator/claude";
import { GenerateRequestSchema, type GenerateEvent } from "@/lib/generator/schema";
import { validatePlan } from "@/lib/generator/validate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function errorMessage(err: unknown): string {
  if (err instanceof GenerationError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key is missing or invalid (ANTHROPIC_API_KEY).";
  if (err instanceof Anthropic.RateLimitError) return "Too many requests right now. Please wait a minute and try again.";
  if (err instanceof Anthropic.BadRequestError) return `The request was rejected: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the AI service. Check the server's internet connection and try again.";
  if (err instanceof Anthropic.APIError) return `The AI service returned an error (${err.status ?? "unknown"}). Please try again.`;
  if (err instanceof Error && err.name === "AbortError") return "Generation cancelled.";
  console.error(err);
  return "Something went wrong while generating the plan.";
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (supabase && !user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const parsed = GenerateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const req = parsed.data;
  const subject = await getSubject(req.subjectSlug);
  if (!subject) return Response.json({ error: "Unknown subject." }, { status: 400 });
  const ctx = buildCurriculumContext(subject, req.level, req.difficulty);
  if (!ctx) {
    return Response.json({ error: `${subject.subject} has no curriculum content at this year level.` }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: GenerateEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let lastSent = 0;
      try {
        const result = await generateLessonPlan(
          ctx.text,
          buildTeacherRequest(req, subject, ctx),
          (characters) => {
            if (characters - lastSent >= 200) {
              lastSent = characters;
              send({ type: "progress", characters });
            }
          },
          request.signal,
        );
        const { plan, warnings } = validatePlan(result.plan, ctx.allowedCodes, req.lessonMinutes);

        let generationId: string | null = null;
        if (supabase && user) {
          const { data, error } = await supabase
            .from("generations")
            .insert({
              user_id: user.id,
              title: plan.title,
              level: req.level,
              subject_slug: subject.slug,
              output_type: "lesson_plan",
              difficulty: req.difficulty,
              teacher_input: req,
              curriculum_codes: plan.curriculumLinks.map((l) => l.code),
              content: { plan, warnings },
              model: result.model,
              input_tokens: result.usage.inputTokens + result.usage.cacheReadTokens,
              output_tokens: result.usage.outputTokens,
            })
            .select("id")
            .single();
          if (error) {
            console.error("save failed", error);
            warnings.push("The plan could not be saved to your library.");
          } else {
            generationId = data.id;
          }
        }

        send({ type: "result", plan, warnings, generationId, usage: { ...result.usage, model: result.model } });
      } catch (err) {
        send({ type: "error", message: errorMessage(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
