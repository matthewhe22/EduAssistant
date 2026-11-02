import { z } from "zod";
import { createTemplate, listTemplates } from "@/lib/data/templates";
import { requireUser } from "@/lib/library/server";
import { FormSettingsSchema } from "@/lib/library/settings";

export async function GET(): Promise<Response> {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  return Response.json({ templates: await listTemplates(auth.db, auth.user.id) });
}

const CreateSchema = z.object({ name: z.string().trim().min(1).max(100), settings: FormSettingsSchema });

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const body = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Give the template a name (up to 100 characters)." }, { status: 400 });
  const template = await createTemplate(auth.db, auth.user.id, body.data.name, body.data.settings);
  return Response.json({ template }, { status: 201 });
}
