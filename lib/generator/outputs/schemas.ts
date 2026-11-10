/**
 * Structured-output schemas for every output type. Keep to features structured outputs
 * support (no min/max/length constraints); describe expectations in .describe() instead.
 *
 * Every schema has `title` and `curriculumLinks`; any `curriculumCodes` array anywhere in
 * the object is also validated against the curriculum (see validate.ts).
 */
import { z } from "zod";
import { FRAMEWORK_PHASES } from "../framework";

export const CurriculumLinks = z
  .array(
    z.object({
      code: z.string().describe("A content description code copied exactly from the provided curriculum"),
      howAddressed: z.string().describe("One sentence on how this is addressed"),
    }),
  )
  .describe("1–4 content descriptions addressed, taken only from the provided curriculum");

const Differentiation = z.object({
  support: z.array(z.string()),
  extension: z.array(z.string()),
  ealD: z.array(z.string()).describe("Support for EAL/D learners"),
});

const Codes = z.array(z.string()).describe("Content description codes from the provided curriculum");

/* ---------------------------- Lesson plan ---------------------------- */

export const PHASES = [
  "Daily review",
  "Focus the learning",
  "Explicit teaching",
  "Guided practice",
  "Independent practice",
  "Reflection",
] as const;

/** Default VTLM 2.0 phases plus the teacher's own framework sections (lib/generator/framework.ts). */
export const PHASE_NAMES = [...PHASES, ...FRAMEWORK_PHASES.filter((p) => !(PHASES as readonly string[]).includes(p))] as [string, ...string[]];

export const LessonPlanSchema = z.object({
  title: z.string().describe("Short, teacher-facing lesson title"),
  overview: z.string().describe("Two or three sentences: what students learn and why it matters"),
  curriculumLinks: CurriculumLinks,
  learningIntention: z.string().describe("'We are learning to…' statement"),
  successCriteria: z.array(z.string()).describe("3–4 'I can…' statements drawn from the achievement standard"),
  vocabulary: z.array(z.object({ term: z.string(), studentFriendlyDefinition: z.string() })),
  resources: z.array(z.string()).describe("Materials and preparation the teacher needs"),
  phases: z
    .array(
      z.object({
        phase: z.enum(PHASE_NAMES).describe("VTLM 2.0 phase, or the teacher's own framework section when one is given"),
        minutes: z.number().int(),
        teacher: z.array(z.string()).describe("What the teacher does and says, including worked examples"),
        students: z.array(z.string()).describe("What students do"),
        checkForUnderstanding: z.string().describe("How the teacher checks understanding in this phase; empty string if none"),
      }),
    )
    .describe("Lesson sequence; minutes must add up to the lesson length"),
  differentiation: Differentiation,
  assessment: z.object({
    formative: z.array(z.string()),
    exitTicket: z.string().describe("A specific exit ticket question or task"),
  }),
  crossCurriculum: z.array(z.string()).describe("Capabilities or cross-curriculum priorities genuinely addressed; empty if none"),
  teacherNotes: z.array(z.string()).describe("Misconceptions to watch for, safety notes, follow-up ideas"),
});

/* ----------------------------- Unit plan ----------------------------- */

export const UnitPlanSchema = z.object({
  title: z.string(),
  overview: z.string().describe("What the unit is about and why it matters (3–4 sentences)"),
  curriculumLinks: CurriculumLinks,
  bigIdeas: z.array(z.string()).describe("2–4 enduring understandings"),
  successCriteria: z.array(z.string()).describe("Unit-level 'I can…' statements from the achievement standard"),
  vocabulary: z.array(z.string()),
  lessons: z
    .array(
      z.object({
        number: z.number().int(),
        title: z.string(),
        learningIntention: z.string(),
        keyActivities: z.array(z.string()).describe("2–4 concrete activities, following the VTLM 2.0 lesson structure"),
        curriculumCodes: Codes,
        resources: z.array(z.string()),
      }),
    )
    .describe("A coherent, sequenced set of lessons that build knowledge cumulatively"),
  assessment: z.object({
    preAssessment: z.string().describe("How to find out what students already know"),
    formative: z.array(z.string()),
    summativeTask: z.string().describe("The end-of-unit assessment task"),
    summativeCriteria: z.array(z.string()),
  }),
  differentiation: Differentiation,
  crossCurriculum: z.array(z.string()),
  teacherNotes: z.array(z.string()),
});

/* ------------------------------ Activities --------------------------- */

export const ACTIVITY_FORMATS = ["Whole class", "Small group", "Pairs", "Individual", "Rotation station"] as const;

export const ActivitiesSchema = z.object({
  title: z.string(),
  overview: z.string(),
  curriculumLinks: CurriculumLinks,
  learningIntention: z.string(),
  activities: z.array(
    z.object({
      name: z.string(),
      format: z.enum(ACTIVITY_FORMATS),
      minutes: z.number().int(),
      materials: z.array(z.string()),
      steps: z.array(z.string()).describe("Step-by-step instructions a relief teacher could follow"),
      teacherRole: z.string().describe("What the teacher does during the activity"),
      successLooksLike: z.string(),
      support: z.string().describe("How to make it easier"),
      extension: z.string().describe("How to make it harder"),
    }),
  ),
  managementTips: z.array(z.string()).describe("Grouping, transitions, noise and behaviour tips"),
  teacherNotes: z.array(z.string()),
});

/* ------------------------------ Worksheet ---------------------------- */

export const QUESTION_TYPES = [
  "Short answer",
  "Multiple choice",
  "True or false",
  "Fill in the blank",
  "Matching",
  "Extended response",
  "Drawing or diagram",
  "Calculation",
] as const;

const WorksheetQuestion = z.object({
  number: z.number().int(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().describe("The question exactly as students read it, at their reading level"),
  options: z.array(z.string()).describe("Choices for multiple choice / matching; empty otherwise"),
  answerLines: z.number().int().describe("Lines of writing space (0 for multiple choice)"),
  answer: z.string().describe("Model answer for the answer key"),
  markingNotes: z.string().describe("Acceptable alternatives or common errors; empty if none"),
});

export const WorksheetSchema = z.object({
  title: z.string().describe("Student-facing worksheet title"),
  overview: z.string().describe("Teacher-facing note: purpose and when to use it"),
  curriculumLinks: CurriculumLinks,
  studentInstructions: z.string(),
  wordBank: z.array(z.string()).describe("Key words for students; empty if not useful"),
  sections: z.array(
    z.object({
      heading: z.string(),
      instructions: z.string(),
      questions: z.array(WorksheetQuestion),
    }),
  ),
  teacherNotes: z.array(z.string()),
});

/* ---------------------- Differentiated (tiered) task ------------------ */

export const TIERS = ["Support", "Core", "Extension"] as const;

export const TieredTaskSchema = z.object({
  title: z.string(),
  overview: z.string(),
  curriculumLinks: CurriculumLinks,
  learningIntention: z.string(),
  commonTask: z.string().describe("The shared task all students work on, described for the teacher"),
  tiers: z
    .array(
      z.object({
        tier: z.enum(TIERS),
        whoItIsFor: z.string(),
        studentInstructions: z.array(z.string()),
        scaffolds: z.array(z.string()).describe("Prompts, sentence starters, worked examples or manipulatives"),
        questions: z.array(z.object({ prompt: z.string(), answer: z.string() })),
        successCriteria: z.array(z.string()),
      }),
    )
    .describe("Exactly three tiers: Support, Core, Extension, all working towards the same learning intention"),
  ealDAdjustments: z.array(z.string()),
  teacherNotes: z.array(z.string()),
});

/* -------------------------------- Rubric ------------------------------ */

export const RubricSchema = z.object({
  title: z.string(),
  overview: z.string(),
  curriculumLinks: CurriculumLinks,
  task: z.string().describe("The assessment task the rubric is for"),
  levelLabels: z
    .array(z.string())
    .describe("Exactly four achievement levels, lowest to highest, e.g. Beginning, Developing, Achieving (at standard), Extending"),
  criteria: z.array(
    z.object({
      criterion: z.string(),
      curriculumCodes: Codes,
      descriptors: z.array(z.string()).describe("One observable descriptor per level, in the same order as levelLabels"),
    }),
  ),
  studentChecklist: z.array(z.string()).describe("Student-friendly 'I can…' self-assessment statements"),
  moderationNotes: z.array(z.string()),
});

/* ---------------------------- Quiz / assessment ----------------------- */

export const AssessmentSchema = z.object({
  title: z.string(),
  overview: z.string(),
  curriculumLinks: CurriculumLinks,
  studentInstructions: z.string(),
  questions: z.array(
    z.object({
      number: z.number().int(),
      type: z.enum(QUESTION_TYPES),
      prompt: z.string(),
      options: z.array(z.string()).describe("Choices for multiple choice / matching; empty otherwise"),
      answer: z.string(),
      marks: z.number().int(),
      curriculumCodes: Codes,
    }),
  ),
  totalMarks: z.number().int(),
  markingGuide: z.array(z.string()),
  nextSteps: z.array(z.string()).describe("What to reteach or extend based on common results"),
});

/* ------------------------------ Parent note --------------------------- */

export const ParentNoteSchema = z.object({
  title: z.string(),
  curriculumLinks: CurriculumLinks,
  newsletterText: z.string().describe("120–200 words, warm and jargon-free, for families"),
  keyVocabulary: z.array(z.string()),
  homeActivities: z.array(z.object({ name: z.string(), description: z.string(), materials: z.string() })).describe("2–4 simple, low-cost ideas"),
  conversationStarters: z.array(z.string()),
});

/* ---------------------------- Slide deck (PowerPoint) ----------------- */

export const SLIDE_LAYOUTS = ["Bullets", "Two columns", "Question", "Activity", "Big idea"] as const;

export const SlideDeckSchema = z.object({
  title: z.string().describe("Student-facing deck title, shown on the title slide"),
  subtitle: z.string().describe("Short subtitle for the title slide, e.g. the lesson focus; empty if none"),
  overview: z.string().describe("Teacher-facing note: what the deck covers and how to use it"),
  curriculumLinks: CurriculumLinks,
  learningIntention: z.string().describe("'We are learning to…' statement, shown on its own slide after the title"),
  successCriteria: z.array(z.string()).describe("3–4 'I can…' statements, shown with the learning intention"),
  slides: z
    .array(
      z.object({
        layout: z.enum(SLIDE_LAYOUTS).describe("Bullets: heading + points; Two columns: compare two lists; Question: one question for the class; Activity: task instructions; Big idea: one key statement"),
        heading: z.string().describe("Slide heading, a few words"),
        bullets: z.array(z.string()).describe("Student-facing points, at most 6, short enough for this year level to read (about 12 words each)"),
        secondColumn: z.array(z.string()).describe("Right-hand column for the Two columns layout; empty otherwise"),
        imageIdea: z.string().describe("A picture, diagram or object to show on this slide; empty if none"),
        imageSearch: z
          .string()
          .default("")
          .describe("2–4 plain keywords to find a real photo of the picture idea in a free image library, e.g. 'koala eucalyptus tree'; empty when a photo wouldn't help (diagrams, worked examples)"),
        speakerNotes: z.string().describe("What the teacher says and does on this slide, including worked examples and questions to ask"),
      }),
    )
    .describe("Content slides in teaching order (the title and learning intention slides are added automatically)"),
  teacherNotes: z.array(z.string()).describe("Preparation, misconceptions to watch for, follow-up ideas"),
});

/* ------------------------- Games and puzzles (activity studio) ------------------------- */

export const PuzzlePackSchema = z.object({
  title: z.string().describe("Student-facing title, e.g. 'Fraction words'"),
  overview: z.string().describe("Teacher-facing note: what the puzzles practise and when to use them"),
  curriculumLinks: CurriculumLinks,
  words: z
    .array(
      z.object({
        word: z.string().describe("One key word from the topic, spelt correctly, letters only (no spaces, hyphens or numbers), at most 12 letters"),
        clue: z.string().describe("A short crossword clue students at this level can read, that doesn't contain the word"),
      }),
    )
    .describe("Key vocabulary for the word search and crossword, all different; mix lengths and share common letters so the words can cross"),
  bingo: z.object({
    instructions: z.string().describe("How to play, in one or two sentences students understand"),
    items: z
      .array(
        z.object({
          call: z.string().describe("What the teacher reads out: a question, definition, sum or clue"),
          answer: z.string().describe("What students mark on their card: a short answer (a number, word or short phrase), different for every item"),
        }),
      )
      .describe("Exactly 24 bingo items that practise the learning (calls the teacher reads, answers on the cards); every answer different"),
  }),
  brainBreaks: z
    .array(
      z.object({
        name: z.string(),
        minutes: z.number().int().describe("1–5 minutes"),
        steps: z.array(z.string()).describe("How to run it, in steps the teacher reads out"),
        learningLink: z.string().describe("How it revisits today's learning"),
      }),
    )
    .describe("Exactly 3 short movement or game brain breaks that need no equipment and revisit the learning"),
  teacherNotes: z.array(z.string()).describe("How to use the puzzles, differentiation ideas, words to pre-teach"),
});

export type LessonPlan = z.infer<typeof LessonPlanSchema>;
export type UnitPlan = z.infer<typeof UnitPlanSchema>;
export type Activities = z.infer<typeof ActivitiesSchema>;
export type Worksheet = z.infer<typeof WorksheetSchema>;
export type TieredTask = z.infer<typeof TieredTaskSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type ParentNote = z.infer<typeof ParentNoteSchema>;
export type SlideDeck = z.infer<typeof SlideDeckSchema>;
export type PuzzlePack = z.infer<typeof PuzzlePackSchema>;
