import { isUuid, requireUser } from "@/lib/library/server";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  if (!isUuid(params.id)) return Response.json({ error: "Not found." }, { status: 404 });
  const { data, error } = await auth.supabase.from("generations").delete().eq("id", params.id).select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data?.length) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}
