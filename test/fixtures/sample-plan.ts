import type { LessonPlan } from "@/lib/generator/schema";

export const samplePlan: LessonPlan = {
  title: "Equivalent fractions with paper strips",
  overview: "Students find equivalent fractions.",
  curriculumLinks: [
    { code: "VC2M3N03", howAddressed: "Represents unit fractions." },
    { code: "VC2M9N99", howAddressed: "Invented." },
  ],
  learningIntention: "We are learning to show fractions in different ways.",
  successCriteria: ["I can fold a strip into halves."],
  vocabulary: [{ term: "denominator", studentFriendlyDefinition: "How many equal parts" }],
  resources: ["Paper strips"],
  phases: [
    { phase: "Daily review", minutes: 10, teacher: ["Quick quiz"], students: ["Answer"], checkForUnderstanding: "" },
    { phase: "Explicit teaching", minutes: 20, teacher: ["Model folding"], students: ["Watch"], checkForUnderstanding: "Show me" },
    { phase: "Independent practice", minutes: 25, teacher: ["Roam"], students: ["Fold"], checkForUnderstanding: "" },
  ],
  differentiation: { support: ["Pre-folded"], extension: ["Eighths"], ealD: ["Visuals"] },
  assessment: { formative: ["Observation"], exitTicket: "Shade 1/4" },
  crossCurriculum: [],
  teacherNotes: ["Watch for unequal parts"],
};
