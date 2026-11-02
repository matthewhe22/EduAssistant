import type { PrimaryLevel } from "../curriculum/types";
import type { OutputType } from "../generator/outputs";

/** Friendly labels for the interface. Prompts keep the precise curriculum terms. */
export const YEAR_LABELS: Record<PrimaryLevel, string> = {
  F: "Prep",
  "1": "Year 1",
  "2": "Year 2",
  "3": "Year 3",
  "4": "Year 4",
  "5": "Year 5",
  "6": "Year 6",
};
export const YEAR_SHORT: Record<PrimaryLevel, string> = { F: "Prep", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6" };

export const DIFFICULTY_UI = {
  below: "More support",
  at: "At level",
  above: "Extension",
  mixed: "Mixed tiers",
} as const;

/** Card label, one-line hint, button verb, colour and a 24×24 stroke icon path per output type. */
export const OUTPUT_UI: Record<OutputType, { label: string; hint: string; make: string; pill: string; icon: string }> = {
  lesson_plan: { label: "Lesson plan", hint: "Timed, ready to teach", make: "Make the lesson plan", pill: "bg-euc-tint text-euc-dark", icon: "M4 5h16M4 10h16M4 15h10M4 20h7" },
  unit_plan: { label: "Unit plan", hint: "Weeks of connected lessons", make: "Make the unit plan", pill: "bg-plum-tint text-plum-ink", icon: "M3 5h18v15H3zM3 9h18M8 3v4M16 3v4" },
  activities: { label: "Activities", hint: "Stations and games", make: "Make the activities", pill: "bg-wattle-tint text-wattle-ink", icon: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" },
  worksheet: { label: "Worksheet + answers", hint: "Printable, with a key", make: "Make the worksheet", pill: "bg-wattle-tint text-wattle-ink", icon: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" },
  differentiation: { label: "Three-level task", hint: "Support, core, extension", make: "Make the three-level task", pill: "bg-euc-tint text-euc-dark", icon: "M4 20h4v-6H4zM10 20h4V9h-4zM16 20h4V4h-4z" },
  rubric: { label: "Rubric", hint: "Four levels, clear criteria", make: "Make the rubric", pill: "bg-sky-tint text-sky-ink", icon: "M3 4h18v16H3zM3 10h18M3 15h18M9 4v16" },
  assessment: { label: "Quiz", hint: "Marks and answers", make: "Make the quiz", pill: "bg-sky-tint text-sky-ink", icon: "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 18h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" },
  parent_note: { label: "Note home", hint: "For families", make: "Make the note home", pill: "bg-plum-tint text-plum-ink", icon: "M3 6h18v12H3zM3 7l9 6 9-6" },
};
