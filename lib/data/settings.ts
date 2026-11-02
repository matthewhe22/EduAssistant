import type { Db } from "../db";
import { decryptSecret, encryptSecret, keyHint } from "../crypto/secret";

export interface AiSettings {
  /** Decrypted key, or null if the teacher hasn't saved one (or it can't be decrypted). */
  apiKey: string | null;
  keyHint: string | null;
  model: string | null;
}

export async function getAiSettings(db: Db, userId: string): Promise<AiSettings> {
  const { rows } = await db.query<{ api_key_enc: string | null; api_key_hint: string | null; default_model: string | null }>(
    "select api_key_enc, api_key_hint, default_model from user_settings where user_id = $1",
    [userId],
  );
  const row = rows[0];
  if (!row) return { apiKey: null, keyHint: null, model: null };
  let apiKey: string | null = null;
  if (row.api_key_enc) {
    try {
      apiKey = decryptSecret(row.api_key_enc);
    } catch {
      apiKey = null; // SETTINGS_SECRET changed or missing: the teacher has to save the key again
    }
  }
  return { apiKey, keyHint: row.api_key_hint, model: row.default_model };
}

export async function saveApiKey(db: Db, userId: string, apiKey: string) {
  await db.query(
    `insert into user_settings (user_id, api_key_enc, api_key_hint) values ($1, $2, $3)
     on conflict (user_id) do update set api_key_enc = excluded.api_key_enc, api_key_hint = excluded.api_key_hint, updated_at = now()`,
    [userId, encryptSecret(apiKey), keyHint(apiKey)],
  );
}

export async function clearApiKey(db: Db, userId: string) {
  await db.query("update user_settings set api_key_enc = null, api_key_hint = null, updated_at = now() where user_id = $1", [userId]);
}

export async function saveDefaultModel(db: Db, userId: string, model: string) {
  await db.query(
    `insert into user_settings (user_id, default_model) values ($1, $2)
     on conflict (user_id) do update set default_model = excluded.default_model, updated_at = now()`,
    [userId, model],
  );
}
