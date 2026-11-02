import { z } from "zod";
import { isUuid, requireUser } from "@/lib/library/server";

const FeedbackSchema = z.object({
  rating: z.union([z.literal(1), z.literal(-1), z.null()]),
  comment: z.string().trim().max(2000).default(""),
});

export async function POST(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  if (!isUuid(params.id)) return Response.json({ error: "Not found." }, { status: 404 });
  const body = FeedbackSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid feedback." }, { status: 400 });

  const { data, error } = await auth.supabase
    .from("generations")
    .update({
      rating: body.data.rating,
      feedback_comment: body.data.comment || null,
      rated_at: body.data.rating === null ? null : new Date().toISOString(),
    })
    .eq("id", params.id)
    .select("id")
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}
