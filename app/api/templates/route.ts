import { z } from "zod";
import { FormSettingsSchema } from "@/lib/library/settings";
import { requireUser } from "@/lib/library/server";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const { data, error } = await auth.supabase.from("templates").select("id, name, settings, created_at").order("name");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ templates: data });
}

const CreateSchema = z.object({ name: z.string().trim().min(1).max(100), settings: FormSettingsSchema });

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const body = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Give the template a name (up to 100 characters)." }, { status: 400 });
  const { data, error } = await auth.supabase
    .from("templates")
    .insert({ user_id: auth.user.id, name: body.data.name, settings: body.data.settings })
    .select("id, name, settings, created_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ template: data }, { status: 201 });
}
