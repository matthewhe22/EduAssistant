import type { OutputType } from "@/lib/generator/outputs";
import type { Activities, Assessment, ParentNote, PuzzlePack, Rubric, SlideDeck, TieredTask, UnitPlan, Worksheet } from "@/lib/generator/schema";
import { samplePlan } from "./sample-plan";

const links = [{ code: "VC2M3N03", howAddressed: "Fractions" }];

const unitPlan: UnitPlan = {
  title: "Fractions unit",
  overview: "A unit on fractions.",
  curriculumLinks: links,
  bigIdeas: ["Fractions are equal parts"],
  successCriteria: ["I can name unit fractions"],
  vocabulary: ["numerator", "denominator"],
  lessons: [
    { number: 1, title: "Halves", learningIntention: "WALT halve", keyActivities: ["Fold paper"], curriculumCodes: ["VC2M3N03", "VC2X9Z99"], resources: ["Paper"] },
    { number: 2, title: "Quarters", learningIntention: "WALT quarter", keyActivities: ["Cut pizza"], curriculumCodes: [], resources: [] },
  ],
  assessment: { preAssessment: "Quick quiz", formative: ["Exit tickets"], summativeTask: "Fraction poster", summativeCriteria: ["Accurate"] },
  differentiation: { support: ["Manipulatives"], extension: ["Eighths"], ealD: ["Visuals"] },
  crossCurriculum: [],
  teacherNotes: ["Equal parts misconception"],
};

const activities: Activities = {
  title: "Fraction stations",
  overview: "Four stations.",
  curriculumLinks: links,
  learningIntention: "WALT represent fractions",
  activities: [
    { name: "Fraction wall", format: "Rotation station", minutes: 12, materials: ["Strips"], steps: ["Fold", "Label"], teacherRole: "Question", successLooksLike: "Labelled wall", support: "Pre-folded", extension: "Eighths" },
  ],
  managementTips: ["Use a timer"],
  teacherNotes: [],
};

const worksheet: Worksheet = {
  title: "Fraction fun",
  overview: "Practice sheet.",
  curriculumLinks: links,
  studentInstructions: "Answer every question.",
  wordBank: ["half", "quarter"],
  sections: [
    {
      heading: "Warm up",
      instructions: "Circle the answer",
      questions: [
        { number: 1, type: "Multiple choice", prompt: "Which is 1/2?", options: ["1 of 2 parts", "1 of 3 parts"], answerLines: 0, answer: "1 of 2 parts", markingNotes: "" },
        { number: 2, type: "Short answer", prompt: "Draw a quarter", options: [], answerLines: 3, answer: "A shape in 4 equal parts, 1 shaded", markingNotes: "Parts must be equal" },
      ],
    },
  ],
  teacherNotes: ["Check equal parts"],
};

const tiered: TieredTask = {
  title: "Pizza fractions",
  overview: "Tiered task.",
  curriculumLinks: links,
  learningIntention: "WALT share equally",
  commonTask: "Share pizzas fairly",
  tiers: (["Support", "Core", "Extension"] as const).map((tier) => ({
    tier,
    whoItIsFor: `${tier} learners`,
    studentInstructions: ["Share the pizza"],
    scaffolds: ["Pizza templates"],
    questions: [{ prompt: "Share 1 pizza between 2", answer: "1/2 each" }],
    successCriteria: ["I can share equally"],
  })),
  ealDAdjustments: ["Picture cards"],
  teacherNotes: [],
};

const rubric: Rubric = {
  title: "Fraction poster rubric",
  overview: "Assess the poster.",
  curriculumLinks: links,
  task: "Make a fraction poster",
  levelLabels: ["Beginning", "Developing", "Achieving", "Extending"],
  criteria: [
    { criterion: "Representation", curriculumCodes: ["VC2M3N03"], descriptors: ["a", "b", "c", "d"] },
    { criterion: "Vocabulary", curriculumCodes: [], descriptors: ["a", "b", "c"] },
  ],
  studentChecklist: ["I can show 1/2"],
  moderationNotes: ["Moderate in teams"],
};

const assessment: Assessment = {
  title: "Fractions quiz",
  overview: "End of unit quiz.",
  curriculumLinks: links,
  studentInstructions: "Answer all questions.",
  questions: [
    { number: 1, type: "Multiple choice", prompt: "Which is bigger?", options: ["1/2", "1/4"], answer: "1/2", marks: 1, curriculumCodes: ["VC2M3N03"] },
    { number: 2, type: "Short answer", prompt: "Explain", options: [], answer: "Because…", marks: 2, curriculumCodes: [] },
  ],
  totalMarks: 4,
  markingGuide: ["1 mark each"],
  nextSteps: ["Reteach equal parts"],
};

const parentNote: ParentNote = {
  title: "Learning about fractions",
  curriculumLinks: links,
  newsletterText: "This week we are learning about fractions.\nAsk your child about halves.",
  keyVocabulary: ["half"],
  homeActivities: [{ name: "Pizza night", description: "Cut a pizza into equal parts", materials: "Pizza" }],
  conversationStarters: ["What is a quarter?"],
};

export const slideDeck: SlideDeck = {
  title: "Equal parts",
  subtitle: "Halves and quarters",
  overview: "A short deck for the explicit teaching part of the lesson.",
  curriculumLinks: links,
  learningIntention: "We are learning to name halves and quarters.",
  successCriteria: ["I can split a shape into equal parts", "I can name a half and a quarter"],
  slides: [
    { layout: "Question", heading: "Warm up", bullets: ["Is this pizza shared fairly?", "Tell your partner why."], secondColumn: [], imageIdea: "A pizza cut into unequal slices", imageSearch: "pizza slices", speakerNotes: "Take three answers." },
    { layout: "Bullets", heading: "Equal parts", bullets: ["Equal parts are the same size", "2 equal parts are halves"], secondColumn: [], imageIdea: "", imageSearch: "", speakerNotes: "Fold a paper strip & show it." },
    { layout: "Two columns", heading: "Equal or not?", bullets: ["Equal"], secondColumn: ["Not equal"], imageIdea: "", imageSearch: "", speakerNotes: "" },
    { layout: "Activity", heading: "Fold it", bullets: ["Fold your strip in half", "Fold it again", "Label each part"], secondColumn: [], imageIdea: "Paper strips", imageSearch: "", speakerNotes: "Circulate and check." },
    { layout: "Big idea", heading: "Remember", bullets: ["Fractions are equal parts of a whole"], secondColumn: [], imageIdea: "", imageSearch: "", speakerNotes: "" },
  ],
  teacherNotes: ["Watch for unequal folds"],
};

const puzzles: PuzzlePack = {
  title: "Fraction words",
  overview: "Vocabulary games for the fractions unit.",
  curriculumLinks: links,
  words: [
    { word: "numerator", clue: "The top number in a fraction" },
    { word: "denominator", clue: "The bottom number in a fraction" },
    { word: "fraction", clue: "Part of a whole" },
    { word: "half", clue: "One of two equal parts" },
    { word: "quarter", clue: "One of four equal parts" },
    { word: "equal", clue: "The same size" },
    { word: "whole", clue: "All of it" },
    { word: "third", clue: "One of three equal parts" },
  ],
  bingo: {
    instructions: "Cover the answer when you hear its clue. Four in a row wins!",
    items: Array.from({ length: 24 }, (_, i) => ({ call: `Which fraction is shaded? (picture ${i + 1})`, answer: `${(i % 7) + 1}/${(i % 7) + 2 + Math.floor(i / 7)}` })),
  },
  brainBreaks: [
    { name: "Fraction freeze", minutes: 2, steps: ["Move around the room", "Freeze in groups of the size I call"], learningLink: "Groups show equal parts" },
  ],
  teacherNotes: ["Pre-teach numerator and denominator"],
};

export const SAMPLES: Record<OutputType, Record<string, unknown>> = {
  lesson_plan: samplePlan,
  unit_plan: unitPlan,
  activities,
  worksheet,
  differentiation: tiered,
  rubric,
  assessment,
  parent_note: parentNote,
  slides: slideDeck,
  puzzles,
};
