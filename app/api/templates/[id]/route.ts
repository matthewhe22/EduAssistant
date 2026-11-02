import { deleteTemplate } from "@/lib/data/templates";
import { isUuid, requireUser } from "@/lib/library/server";

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  if (!isUuid(params.id) || !(await deleteTemplate(auth.db, auth.user.id, params.id))) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
