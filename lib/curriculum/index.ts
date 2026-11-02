import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CurriculumBand, CurriculumIndex, PrimaryLevel, SubjectCurriculum } from "./types";

const DATA_DIR = path.join(process.cwd(), "data/curriculum/vc2");

export async function getCurriculumIndex(): Promise<CurriculumIndex | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, "index.json"), "utf8")) as CurriculumIndex;
  } catch {
    return null; // dataset not built yet: run the "Build curriculum dataset" workflow
  }
}

export async function getSubject(slug: string): Promise<SubjectCurriculum | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, `${slug}.json`), "utf8")) as SubjectCurriculum;
  } catch {
    return null;
  }
}

/** The band (or single level) of a subject that covers the given year level. */
export function bandForLevel(subject: SubjectCurriculum, level: PrimaryLevel): CurriculumBand | null {
  return subject.bands.find((b) => b.levels.includes(level)) ?? null;
}

/** Looks up a content description by code across all subjects (for validating generated plans). */
export async function findContentDescription(code: string) {
  const index = await getCurriculumIndex();
  if (!index) return null;
  for (const entry of index.subjects) {
    const s = await getSubject(entry.slug);
    for (const band of s?.bands ?? []) {
      const cd = band.contentDescriptions.find((c) => c.code === code);
      if (cd) return { subject: s!, band, contentDescription: cd };
    }
  }
  return null;
}
