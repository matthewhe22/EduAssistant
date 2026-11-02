import { z } from "zod";
import { MODEL_ID_PATTERN } from "@/lib/ai/models";
import { canEncrypt } from "@/lib/crypto/secret";
import { clearApiKey, saveApiKey, saveDefaultModel } from "@/lib/data/settings";
import { checkApiKey } from "@/lib/generator/llm";
import { requireUser } from "@/lib/library/server";

const BodySchema = z.object({
  apiKey: z.string().trim().min(8).max(300).optional(),
  removeKey: z.boolean().optional(),
  model: z.string().trim().regex(MODEL_ID_PATTERN).optional(),
});

/** Saves the teacher's Tenon API key (encrypted) and/or default model. */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "That doesn't look like a valid key or model." }, { status: 400 });
  const { apiKey, removeKey, model } = body.data;
  const notes: string[] = [];

  if (removeKey) await clearApiKey(auth.db, auth.user.id);
  if (apiKey) {
    if (!canEncrypt()) {
      return Response.json({ error: "The server can't store keys yet: ask the site owner to set SETTINGS_SECRET." }, { status: 503 });
    }
    const check = await checkApiKey(apiKey);
    if (check === "invalid") return Response.json({ error: "Tenon rejected that key. Copy it again from mytenon.com → API keys." }, { status: 400 });
    if (check === "unreachable") notes.push("Saved, but Tenon couldn't be reached to check the key.");
    await saveApiKey(auth.db, auth.user.id, apiKey);
  }
  if (model) await saveDefaultModel(auth.db, auth.user.id, model);
  return Response.json({ ok: true, notes });
}
