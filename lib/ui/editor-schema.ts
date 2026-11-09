/** Schema helpers for the hand-editing form (components/Editor.tsx). */
import type { z } from "zod";

export type Schema = z.ZodType;
export type Json = unknown;

export interface Def {
  type: string;
  element?: Schema;
  shape?: Record<string, Schema>;
  entries?: Record<string, string>;
}
const rawDef = (s: Schema) => (s as unknown as { _zod: { def: Def & { innerType?: Schema } } })._zod.def;
/** A field with a default value (e.g. a field added later) is edited like the field itself. */
export const unwrap = (s: Schema): Schema => {
  let cur = s;
  while (rawDef(cur).type === "default" && rawDef(cur).innerType) cur = rawDef(cur).innerType!;
  return cur;
};
export const defOf = (s: Schema) => rawDef(unwrap(s));
export const shapeOf = (s: Schema): Record<string, Schema> => (unwrap(s) as unknown as { shape?: Record<string, Schema> }).shape ?? defOf(s).shape ?? {};
export const optionsOf = (s: Schema): string[] => (unwrap(s) as unknown as { options?: string[] }).options ?? Object.values(defOf(s).entries ?? {});

/** Fields teachers shouldn't hand-edit: codes are checked against the curriculum, numbering is automatic. */
export const HIDDEN = new Set(["curriculumCodes", "number"]);

export const LABELS: Record<string, string> = {
  ealD: "Learning English",
  teacher: "Teacher does",
  students: "Students do",
  checkForUnderstanding: "Check for understanding",
  studentFriendlyDefinition: "Meaning",
  term: "Word",
  answerLines: "Lines for writing",
  markingNotes: "Marking notes",
  keyActivities: "Key activities",
  preAssessment: "Before the unit",
  formative: "Along the way",
  summativeTask: "End-of-unit task",
  summativeCriteria: "End-of-unit criteria",
  exitTicket: "Exit ticket",
  whoItIsFor: "Who it is for",
  studentInstructions: "Student instructions",
  teacherRole: "Teacher's role",
  successLooksLike: "Success looks like",
  levelLabels: "Level names",
  bullets: "Points on the slide",
  secondColumn: "Right-hand column",
  imageIdea: "Picture idea",
  speakerNotes: "Speaker notes",
  imageSearch: "Photo search words",
  learningLink: "Link to the learning",
  call: "Teacher reads out",
  answer: "Answer",
};

export const SINGULAR: Record<string, string> = {
  phases: "phase",
  lessons: "lesson",
  questions: "question",
  sections: "section",
  tiers: "tier",
  criteria: "criterion",
  vocabulary: "word",
  activities: "activity",
  homeActivities: "activity",
  successCriteria: "criterion",
  options: "option",
  descriptors: "descriptor",
  wordBank: "word",
  teacher: "teacher step",
  students: "student step",
  steps: "step",
  studentInstructions: "instruction",
  keyActivities: "activity",
  resources: "resource",
  materials: "material",
  support: "idea",
  extension: "idea",
  ealD: "idea",
  ealDAdjustments: "adjustment",
  scaffolds: "scaffold",
  formative: "check",
  bigIdeas: "big idea",
  teacherNotes: "note",
  moderationNotes: "note",
  managementTips: "tip",
  markingGuide: "point",
  nextSteps: "step",
  studentChecklist: "statement",
  crossCurriculum: "link",
  conversationStarters: "question",
  keyVocabulary: "word",
  summativeCriteria: "criterion",
  slides: "slide",
  bullets: "point",
  secondColumn: "point",
  words: "word",
  items: "item",
  brainBreaks: "brain break",
};

export function fieldLabel(key: string) {
  if (LABELS[key]) return LABELS[key];
  const words = key.replace(/([A-Z])/g, " $1").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** An empty value of the schema's shape, for "Add" buttons. */
export function emptyValue(s: Schema): Json {
  const d = defOf(s);
  switch (d.type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "enum":
      return optionsOf(s)[0] ?? "";
    case "array":
      return [];
    case "object":
      return Object.fromEntries(Object.entries(shapeOf(s)).map(([k, v]) => [k, emptyValue(v)]));
    default:
      return "";
  }
}

/** Keeps `number` fields of list items as 1, 2, 3… after adding, removing or moving. */
export function renumber(items: Json[]): Json[] {
  return items.map((it, i) => (it && typeof it === "object" && "number" in (it as object) ? { ...(it as object), number: i + 1 } : it));
}

