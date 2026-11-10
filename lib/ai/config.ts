import "server-only";
import { getAiSettings } from "../data/settings";
import type { Db } from "../db";
import { FALLBACK_MODEL, usableModel } from "./models";

/** Tenon (https://mytenon.com): one OpenAI-compatible endpoint for many vendors' models. */
export const TENON_BASE_URL = process.env.TENON_BASE_URL || "https://mytenon.com/v1";
/** The server's default model. A DEFAULT_MODEL that isn't allowed in schools (e.g. DeepSeek) is ignored. */
export const DEFAULT_MODEL = usableModel(process.env.DEFAULT_MODEL, FALLBACK_MODEL);

/** The model a teacher's generations use: their saved choice if it is still allowed, else the default. */
export const effectiveModel = (saved: string | null | undefined) => usableModel(saved, DEFAULT_MODEL);

export interface AiConfig {
  apiKey: string;
  model: string;
  /** Where the key came from: the teacher's own (Usage page) or the server's TENON_API_KEY. */
  keySource: "user" | "server";
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("Add your Tenon API key on the Settings page to start generating.");
  }
}

/** The key and model to use for this teacher (falls back to the server's key and default model). */
export async function resolveAiConfig(db: Db | null, userId: string | null): Promise<AiConfig> {
  const settings = db && userId ? await getAiSettings(db, userId) : null;
  const model = effectiveModel(settings?.model);
  if (settings?.apiKey) return { apiKey: settings.apiKey, model, keySource: "user" };
  if (process.env.TENON_API_KEY) return { apiKey: process.env.TENON_API_KEY, model, keySource: "server" };
  throw new MissingApiKeyError();
}
