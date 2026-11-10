import type { z } from "zod";
import {
  ActivitiesSchema,
  AssessmentSchema,
  LessonPlanSchema,
  ParentNoteSchema,
  PuzzlePackSchema,
  RubricSchema,
  SlideDeckSchema,
  TieredTaskSchema,
  UnitPlanSchema,
  WorksheetSchema,
} from "./schemas";

/** Matches the `output_type` enum in db/migrations/001_init.sql. */
export const OUTPUT_TYPES = [
  "lesson_plan",
  "unit_plan",
  "activities",
  "worksheet",
  "differentiation",
  "rubric",
  "assessment",
  "parent_note",
  "slides",
  "puzzles",
] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

export interface ItemCountOption {
  label: string;
  default: number;
  min: number;
  max: number;
}

export interface OutputDefinition {
  label: string;
  description: string;
  schema: z.ZodObject;
  /** Whether the lesson length setting applies. */
  usesLessonLength: boolean;
  /** Optional "how many" setting (lessons, questions, activities). */
  itemCount?: ItemCountOption;
  /** Instructions appended to the teacher request. */
  instructions: (opts: { lessonMinutes: number; itemCount: number }) => string;
  /** Top-level fields a teacher can refine individually, with labels. */
  sections: Record<string, string>;
}

export const OUTPUTS: Record<OutputType, OutputDefinition> = {
  lesson_plan: {
    label: "Lesson plan",
    description: "A detailed VTLM 2.0 lesson with timings, differentiation and an exit ticket",
    schema: LessonPlanSchema,
    usesLessonLength: true,
    instructions: ({ lessonMinutes }) =>
      `Write one detailed lesson plan for a ${lessonMinutes}-minute lesson. Phase minutes must add up to exactly ${lessonMinutes}.`,
    sections: {
      overview: "Overview",
      learningIntention: "Learning intention",
      successCriteria: "Success criteria",
      vocabulary: "Vocabulary",
      resources: "Resources",
      phases: "Lesson sequence",
      differentiation: "Differentiation",
      assessment: "Assessment and exit ticket",
      teacherNotes: "Teacher notes",
    },
  },
  unit_plan: {
    label: "Unit plan",
    description: "A sequence of lessons with big ideas and a summative assessment",
    schema: UnitPlanSchema,
    usesLessonLength: true,
    itemCount: { label: "Number of lessons", default: 8, min: 3, max: 20 },
    instructions: ({ lessonMinutes, itemCount }) =>
      `Write a unit plan of exactly ${itemCount} lessons of about ${lessonMinutes} minutes each, numbered 1 to ${itemCount}. Sequence lessons so knowledge builds cumulatively, with retrieval of earlier lessons and a summative assessment near the end. Cover the relevant content descriptions across the unit, not all in every lesson.`,
    sections: {
      overview: "Overview",
      bigIdeas: "Big ideas",
      successCriteria: "Success criteria",
      lessons: "Lesson sequence",
      assessment: "Assessment",
      differentiation: "Differentiation",
      teacherNotes: "Teacher notes",
    },
  },
  activities: {
    label: "Activities / rotations",
    description: "Hands-on activities or rotation stations with materials and steps",
    schema: ActivitiesSchema,
    usesLessonLength: true,
    itemCount: { label: "Number of activities", default: 4, min: 1, max: 8 },
    instructions: ({ lessonMinutes, itemCount }) =>
      `Design exactly ${itemCount} engaging, purposeful activities that fit in a ${lessonMinutes}-minute session (as rotation stations if that suits the idea). Each must practise the learning intention, not just be fun. Prefer cheap, common classroom materials.`,
    sections: {
      learningIntention: "Learning intention",
      activities: "Activities",
      managementTips: "Management tips",
      teacherNotes: "Teacher notes",
    },
  },
  worksheet: {
    label: "Worksheet + answer key",
    description: "A printable worksheet with sections, questions and model answers",
    schema: WorksheetSchema,
    usesLessonLength: false,
    itemCount: { label: "Number of questions", default: 10, min: 3, max: 30 },
    instructions: ({ itemCount }) =>
      `Write a student worksheet with exactly ${itemCount} questions in total, grouped into 2–3 sections that move from fluency to reasoning or application. Number questions consecutively from 1. Use language students at this level can read independently. Every question needs a model answer for the answer key.`,
    sections: {
      studentInstructions: "Student instructions",
      wordBank: "Word bank",
      sections: "Questions",
      teacherNotes: "Teacher notes",
    },
  },
  differentiation: {
    label: "Differentiated task (3 tiers)",
    description: "One task in Support, Core and Extension versions",
    schema: TieredTaskSchema,
    usesLessonLength: false,
    itemCount: { label: "Questions per tier", default: 4, min: 2, max: 10 },
    instructions: ({ itemCount }) =>
      `Write one task in exactly three tiers (Support, Core, Extension), each with ${itemCount} questions and answers. All tiers work towards the same learning intention. Support adds scaffolds without lowering the goal; Extension adds depth or transfer, not just more work.`,
    sections: {
      commonTask: "Common task",
      tiers: "Tiers",
      ealDAdjustments: "EAL/D adjustments",
      teacherNotes: "Teacher notes",
    },
  },
  rubric: {
    label: "Assessment rubric",
    description: "A four-level rubric linked to the achievement standard",
    schema: RubricSchema,
    usesLessonLength: false,
    itemCount: { label: "Number of criteria", default: 4, min: 2, max: 8 },
    instructions: ({ itemCount }) =>
      `Write an assessment task and a rubric with exactly ${itemCount} criteria and exactly four levels. "Achieving" must describe the achievement standard for this level; descriptors must be observable and distinct between levels (avoid vague words like "good" or "some"). Include a student-friendly checklist.`,
    sections: {
      task: "Task",
      criteria: "Criteria",
      studentChecklist: "Student checklist",
      moderationNotes: "Moderation notes",
    },
  },
  assessment: {
    label: "Quiz / assessment",
    description: "Questions with marks, answers and a marking guide",
    schema: AssessmentSchema,
    usesLessonLength: false,
    itemCount: { label: "Number of questions", default: 10, min: 3, max: 30 },
    instructions: ({ itemCount }) =>
      `Write a quiz with exactly ${itemCount} questions, numbered from 1, mixing question types and difficulty. Tag each question with the content description code(s) it assesses. totalMarks must equal the sum of question marks.`,
    sections: {
      studentInstructions: "Student instructions",
      questions: "Questions",
      markingGuide: "Marking guide",
      nextSteps: "Next steps",
    },
  },
  parent_note: {
    label: "Parent / newsletter note",
    description: "A family-friendly summary with home learning ideas",
    schema: ParentNoteSchema,
    usesLessonLength: false,
    instructions: () =>
      `Write a short note for families explaining what the class is learning and how they can help at home. Warm, plain English, no jargon or curriculum codes in the newsletter text. Home activities must be free or low cost and suit diverse families.`,
    sections: {
      newsletterText: "Newsletter text",
      keyVocabulary: "Key vocabulary",
      homeActivities: "Home activities",
      conversationStarters: "Conversation starters",
    },
  },
  slides: {
    label: "PowerPoint slides",
    description: "A classroom slide deck with speaker notes, downloadable as an editable PowerPoint",
    schema: SlideDeckSchema,
    usesLessonLength: true,
    itemCount: { label: "Number of slides", default: 10, min: 4, max: 25 },
    instructions: ({ lessonMinutes, itemCount }) =>
      `Write a classroom slide deck with exactly ${itemCount} content slides for a ${lessonMinutes}-minute lesson. Do not include a title slide or a learning intention slide; those are made automatically from title, subtitle, learningIntention and successCriteria. Follow the VTLM 2.0 lesson sequence across the slides: daily review, explicit teaching with worked examples (I do), guided practice (we do), an independent task (you do) and a reflection or exit ticket. Slide text is for students: short points, at most 6 per slide, in language this year level can read. Put everything the teacher says, explains or asks in speakerNotes, not on the slide.`,
    sections: {
      successCriteria: "Success criteria",
      slides: "Slides",
      teacherNotes: "Teacher notes",
    },
  },
  puzzles: {
    label: "Games and puzzles",
    description: "A word search, crossword, bingo game and brain breaks built from the key vocabulary",
    schema: PuzzlePackSchema,
    usesLessonLength: false,
    itemCount: { label: "Number of words", default: 12, min: 6, max: 20 },
    instructions: ({ itemCount }) =>
      `Write a low-prep games pack for this topic: exactly ${itemCount} key words with crossword clues, a bingo game with exactly 24 items, and exactly 3 brain breaks. The word search, crossword grid and bingo cards are made automatically from your words and answers, so do not draw grids. Choose words students need to know and can read at this level; single words only, no spaces. Clues and calls must practise the learning (meanings, examples, questions), not just spelling. Bingo answers must all be different and short enough to fit in a small square.`,
    sections: {
      words: "Words and clues",
      bingo: "Bingo",
      brainBreaks: "Brain breaks",
      teacherNotes: "Teacher notes",
    },
  },
};

export function isOutputType(v: unknown): v is OutputType {
  return typeof v === "string" && (OUTPUT_TYPES as readonly string[]).includes(v);
}
