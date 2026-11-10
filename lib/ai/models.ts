/**
 * Model choices for Tenon. The live list comes from GET /v1/models; this list is the fallback
 * (from https://mytenon.com/pricing, November 2026) and supplies friendly names.
 */
export interface ModelOption {
  id: string;
  label: string;
  note?: string;
}

export const KNOWN_MODELS: ModelOption[] = [
  { id: "glm-5.3-flash", label: "GLM 5.3 Flash", note: "Fast and low cost (default)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "High quality" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Highest quality, higher cost" },
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
  { id: "qwen3.8-flash", label: "Qwen 3.8 Flash" },
  { id: "glm-5.3", label: "GLM 5.3" },
  { id: "gpt-oss-120b-ultra", label: "GPT-OSS 120B Ultra" },
];

/** Models that can't write lesson plans (safety classifiers, embeddings). */
const NOT_FOR_WRITING = /guard|embed|vision-exp|whisper|tts|image/i;

/** Used when no model is chosen, or the chosen one isn't allowed. */
export const FALLBACK_MODEL = "glm-5.3-flash";

/** Models Australian education departments don't allow in schools (DeepSeek). Never offered or used. */
const NOT_ALLOWED = /deepseek/i;
export const isAllowedModel = (id: string) => !NOT_ALLOWED.test(id);

/** The saved model if it may be used, otherwise `fallback`. */
export function usableModel(saved: string | null | undefined, fallback: string = FALLBACK_MODEL) {
  return saved && isAllowedModel(saved) ? saved : fallback;
}

export function labelFor(id: string) {
  return KNOWN_MODELS.find((m) => m.id === id)?.label ?? id;
}

/** Merges the live list with known names; known models first, in our order. */
export function mergeModels(liveIds: string[] | null): ModelOption[] {
  if (!liveIds?.length) return KNOWN_MODELS;
  const live = new Set(liveIds.filter((id) => !NOT_FOR_WRITING.test(id) && isAllowedModel(id)));
  const known = KNOWN_MODELS.filter((m) => live.has(m.id));
  const others = [...live].filter((id) => !KNOWN_MODELS.some((m) => m.id === id)).sort().map((id) => ({ id, label: id }));
  return [...known, ...others];
}

export const MODEL_ID_PATTERN = /^[A-Za-z0-9._:/-]{1,100}$/;
