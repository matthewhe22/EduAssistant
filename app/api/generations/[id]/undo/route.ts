import { undoLastChange } from "@/lib/data/generations";
import { isUuid, requireUser } from "@/lib/library/server";

/** Restores the previous version of a library item. */
export async function POST(_req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const restored = isUuid(params.id) ? await undoLastChange(auth.db, auth.user.id, params.id) : null;
  if (!restored) return Response.json({ error: "There is nothing to undo." }, { status: 404 });
  const c = restored.content as { output?: Record<string, unknown>; plan?: Record<string, unknown>; warnings?: unknown };
  return Response.json({
    content: c.output ?? c.plan ?? {},
    warnings: Array.isArray(c.warnings) ? c.warnings : [],
    remaining: restored.remaining,
  });
}
