import type { LearningArea, PrimaryLevel } from "./types";

/** Maps the CSV "Learning area/Capability" column to the app's learning area. */
const AREA_MAP: Record<string, LearningArea> = {
  English: "English",
  Mathematics: "Mathematics",
  Science: "Science",
  Humanities: "Humanities",
  "The Arts": "The Arts",
  Technologies: "Technologies",
  "Health and Physical Education": "Health and Physical Education",
  Languages: "Languages",
  "Critical and Creative Thinking": "Capabilities",
  "Ethical Capability": "Capabilities",
  "Intercultural Capability": "Capabilities",
  "Personal and Social Capability": "Capabilities",
};

export function learningAreaFor(csvArea: string): LearningArea | null {
  return AREA_MAP[csvArea.trim()] ?? null;
}

export function slugify(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const LEVEL_TOKEN: Record<string, PrimaryLevel> = {
  foundation: "F",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
};
const ORDER: PrimaryLevel[] = ["F", "1", "2", "3", "4", "5", "6"];

/**
 * Converts a VCAA level/band label into the primary levels it covers.
 *   "Foundation" → [F]; "Level 3" → [3]; "Levels 5 and 6" → [5, 6];
 *   "Foundation to Level 2" → [F, 1, 2]. Labels beyond Level 6 return [].
 */
export function levelsForBand(band: string): PrimaryLevel[] {
  const tokens = band
    .toLowerCase()
    .replace(/levels?/g, " ")
    .split(/\s+(?:to|and|–|-)\s+|\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const parsed = tokens.map((t) => LEVEL_TOKEN[t]);
  if (parsed.length === 0 || parsed.some((p) => p === undefined)) return [];
  const isRange = /\bto\b|–/.test(band.toLowerCase());
  if (isRange && parsed.length === 2) {
    return ORDER.slice(ORDER.indexOf(parsed[0]), ORDER.indexOf(parsed[1]) + 1);
  }
  return [...new Set(parsed)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}
