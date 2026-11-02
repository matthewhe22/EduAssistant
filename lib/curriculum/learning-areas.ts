import type { LearningArea } from "./types";

/** Maps a VCAA subject (domain) name to its learning area. */
const SUBJECT_TO_AREA: Record<string, LearningArea> = {
  English: "English",
  "English as an Additional Language": "English",
  Mathematics: "Mathematics",
  Science: "Science",
  "Civics and Citizenship": "Humanities",
  "Economics and Business": "Humanities",
  Geography: "Humanities",
  History: "Humanities",
  Dance: "The Arts",
  Drama: "The Arts",
  "Media Arts": "The Arts",
  Music: "The Arts",
  "Visual Arts": "The Arts",
  "Visual Communication Design": "The Arts",
  "Design and Technologies": "Technologies",
  "Digital Technologies": "Technologies",
  "Health and Physical Education": "Health and Physical Education",
  "Critical and Creative Thinking": "Capabilities",
  "Ethical Capability": "Capabilities",
  "Intercultural Capability": "Capabilities",
  "Personal and Social Capability": "Capabilities",
};

/** Anything not listed above on the VCAA site is a language (Chinese, French, Auslan, ...). */
export function learningAreaFor(subject: string): LearningArea {
  return SUBJECT_TO_AREA[subject] ?? "Languages";
}

export function slugify(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
