import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CurriculumIndex, PrimaryLevel, SubjectCurriculum } from "./types";

const DATA_DIR = path.join(process.cwd(), "data/curriculum/vc2");

export async function getCurriculumIndex(): Promise<CurriculumIndex | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, "index.json"), "utf8")) as CurriculumIndex;
  } catch {
    return null; // dataset not built yet — run `npm run curriculum:scrape`
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

export async function getSubjectLevel(slug: string, level: PrimaryLevel) {
  const subject = await getSubject(slug);
  return subject?.levels.find((l) => l.level === level) ?? null;
}
