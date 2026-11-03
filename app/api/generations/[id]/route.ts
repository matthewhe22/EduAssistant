import { z } from "zod";
import { countVersions, deleteGeneration, getGeneration, updateGenerationContent } from "@/lib/data/generations";
import { OUTPUTS, isOutputType } from "@/lib/generator/outputs";
import { isUuid, requireUser } from "@/lib/library/server";

const PutSchema = z.object({
  content: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string().max(500)).max(50).default([]),
  note: z.string().max(100).optional(),
});

/** Saves edited content (e.g. after a quick fix), keeping the previous version for undo. */
export async function PUT(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const row = isUuid(params.id) ? await getGeneration(auth.db, auth.user.id, params.id) : null;
  if (!row || !isOutputType(row.output_type)) return Response.json({ error: "Not found." }, { status: 404 });
  const body = PutSchema.safeParse(await request.json().catch(() => null));
  const content = body.success ? OUTPUTS[row.output_type].schema.safeParse(body.data.content) : null;
  if (!body.success || !content?.success) return Response.json({ error: "Invalid content." }, { status: 400 });
  await updateGenerationContent(auth.db, auth.user.id, row.id, String(content.data.title), { output: content.data, warnings: body.data.warnings }, { note: body.data.note });
  return Response.json({ ok: true, versions: await countVersions(auth.db, auth.user.id, row.id) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  if (!isUuid(params.id) || !(await deleteGeneration(auth.db, auth.user.id, params.id))) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
