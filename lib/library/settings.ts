import { z } from "zod";
import { PRIMARY_LEVELS } from "../curriculum/types";
import { OUTPUT_TYPES } from "../generator/outputs";
import { DIFFICULTIES } from "../generator/schema";

/** Form settings that can be saved as a template or reused from a library item. */
export const FormSettingsSchema = z.object({
  outputType: z.enum(OUTPUT_TYPES).optional(),
  level: z.enum(PRIMARY_LEVELS).optional(),
  subjectSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  lessonMinutes: z.number().int().min(15).max(180).optional(),
  itemCount: z.number().int().min(1).max(30).optional(),
  classContext: z.string().max(1000).optional(),
  idea: z.string().max(4000).optional(),
  focusCodes: z.array(z.string().max(20)).max(10).optional(),
});
export type FormSettings = z.infer<typeof FormSettingsSchema>;

/** Picks the reusable settings out of stored teacher input, dropping anything invalid. */
export function settingsFrom(input: unknown): FormSettings {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(FormSettingsSchema.shape)) {
    const v = (input as Record<string, unknown>)[key];
    if (v !== undefined && schema.safeParse(v).success) out[key] = v;
  }
  return out as FormSettings;
}

/** Makes free text safe for a PostgREST `or=(...ilike...)` filter. */
export function sanitizeSearch(q: string): string {
  return q
    .replace(/[,()*%\\:"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function isOverBudget(spentUsd: number, budgetUsd: number | null | undefined): boolean {
  return budgetUsd !== null && budgetUsd !== undefined && spentUsd >= budgetUsd;
}
