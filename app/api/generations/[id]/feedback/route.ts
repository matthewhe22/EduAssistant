import { z } from "zod";
import { setFeedback } from "@/lib/data/generations";
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
  if (!(await setFeedback(auth.db, auth.user.id, params.id, body.data.rating, body.data.comment))) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
