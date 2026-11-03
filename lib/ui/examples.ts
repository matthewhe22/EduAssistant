import type { PrimaryLevel } from "../curriculum/types";

/**
 * Example ideas shown under the idea box, so a teacher can see the kind of detail that helps.
 * Grouped by subject and by junior (Prep–2) or senior (3–6) years.
 */
type Examples = { junior: string[]; senior: string[] };

const BY_SUBJECT: Record<string, Examples> = {
  mathematics: {
    junior: [
      "Counting collections to 20 with ten frames. Some students still count from one, so build in counting on.",
      "Comparing lengths of classroom objects using paper clips, then ordering from shortest to longest.",
      "Making and breaking numbers to 10 with part-part-whole mats and counters.",
    ],
    senior: [
      "Equivalent fractions with paper strips. A few students mixed up halves and quarters last week, so start with a quick review.",
      "Area of rectangles using grid paper, moving to the multiplication rule. Finish with a design-a-playground task.",
      "Reading and interpreting column graphs from our class survey on favourite lunch foods.",
    ],
  },
  english: {
    junior: [
      "Explicit phonics lesson on the 'sh' digraph with a decodable text and a dictation sentence.",
      "Retelling a familiar picture book in order using first, next, then, finally.",
      "Writing a simple recount of our excursion with a sentence starter for each part.",
    ],
    senior: [
      "Persuasive writing: strong topic sentences and evidence. Topic: should our school have a longer lunch break?",
      "Close reading of a short narrative to infer how a character feels, using evidence from the text.",
      "Using commas in lists and after introductory phrases, with a short editing task.",
    ],
  },
  science: {
    junior: [
      "Sorting materials by whether they are bendy, stretchy or hard, then testing with a hands-on challenge.",
      "Observing how plants change over time with a class bean diary.",
      "Exploring pushes and pulls with toy cars on ramps.",
    ],
    senior: [
      "Fair testing: which paper towel absorbs the most water? Students change one variable and record results.",
      "Why we have day and night, using a torch and globe model.",
      "Solids, liquids and gases: melting chocolate and ice to compare changes of state.",
    ],
  },
  history: {
    junior: ["Comparing toys from the past and present using photos and objects from home."],
    senior: ["Using primary sources to explore life on the Victorian goldfields in the 1850s."],
  },
  geography: {
    junior: ["Drawing a simple map of our classroom with a key, then finding places on it."],
    senior: ["How climate affects where people live, comparing two Australian towns."],
  },
  "health-and-physical-education": {
    junior: ["Throwing and catching skills with bean bags in small groups, with clear safety rules."],
    senior: ["Identifying helpful and unhelpful ways to manage strong feelings, with role-play scenarios."],
  },
  "digital-technologies": {
    junior: ["Following and writing simple step-by-step algorithms using floor robots or unplugged arrows."],
    senior: ["Using branching (if/then) in Scratch to make a simple quiz game."],
  },
  "visual-arts": {
    junior: ["Exploring line and pattern in Aboriginal-inspired dot art, with guidance on cultural respect."],
    senior: ["Creating a still-life drawing using shading to show light and shadow."],
  },
  music: {
    junior: ["Keeping a steady beat with body percussion while singing a familiar song."],
    senior: ["Composing a short rhythm pattern in groups using ta and ti-ti notation."],
  },
};

const GENERAL: Examples = {
  junior: ["Introduce the topic with a hands-on activity, then a short explicit teaching segment and partner practice."],
  senior: ["Start with a quick review of last lesson, model the new skill, then a group task with an exit ticket."],
};

export function exampleIdeas(subjectSlug: string, level: PrimaryLevel): string[] {
  const set = BY_SUBJECT[subjectSlug] ?? GENERAL;
  const junior = level === "F" || level === "1" || level === "2";
  return (junior ? set.junior : set.senior).slice(0, 3);
}
