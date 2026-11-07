/**
 * Turns every output type into slides for the PowerPoint export. Slides carry what students
 * see; what only the teacher needs (teacher talk, answers, marking, differentiation) goes in the
 * speaker notes, or is left out of a student copy.
 */
import type { OutputType } from "../generator/outputs";
import type {
  Activities,
  Assessment,
  LessonPlan,
  ParentNote,
  Rubric,
  SlideDeck,
  TieredTask,
  UnitPlan,
  Worksheet,
} from "../generator/schema";
import type { ExportDeck, ExportSlide } from "./pptx";

export interface DeckOptions {
  studentOnly: boolean;
  lessonMinutes: number;
  typeLabel: string;
}

const clean = (items: (string | undefined | null)[]) => items.map((t) => (t ?? "").trim()).filter(Boolean);

/** Notes text from labelled parts, skipping empty ones. */
function notes(...parts: [string, string | string[] | undefined][]) {
  return parts
    .map(([label, v]) => {
      const items = Array.isArray(v) ? clean(v) : clean([v]);
      if (!items.length) return "";
      return label ? `${label}:\n${items.map((t) => (Array.isArray(v) ? `• ${t}` : t)).join("\n")}` : items.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Splits a long list over several slides (at most `max` points or ~480 characters each). */
export function chunk(items: string[], max = 6, maxChars = 480): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let chars = 0;
  for (const it of clean(items)) {
    if (cur.length && (cur.length >= max || chars + it.length > maxChars)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(it);
    chars += it.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** One or more Bullets slides for a list, with "(continued)" headings after the first. */
function listSlides(heading: string, items: string[], extra: Partial<ExportSlide> = {}, max = 6): ExportSlide[] {
  return chunk(items, max).map((part, i) => ({ layout: "Bullets", heading: i ? `${heading} (continued)` : heading, bullets: part, ...extra }));
}

const letters = (options: string[]) => options.map((o, i) => `${String.fromCharCode(97 + i)}) ${o}`);

function deck(title: string, over: Partial<ExportDeck>): ExportDeck {
  return { title, subtitle: "", titleNotes: "", learningIntention: "", successCriteria: [], curriculumLinks: [], slides: [], ...over };
}

/* ------------------------------ per type ------------------------------ */

function lessonPlan(x: LessonPlan): ExportDeck {
  const slides: ExportSlide[] = [];
  if (x.vocabulary.length) {
    slides.push(...listSlides("Words we will use", x.vocabulary.map((v) => `${v.term}: ${v.studentFriendlyDefinition}`), { tag: "Vocabulary" }, 5));
  }
  for (const ph of x.phases) {
    const students = clean(ph.students);
    slides.push({
      layout: ph.phase === "Independent practice" || ph.phase === "Guided practice" ? "Activity" : "Bullets",
      heading: ph.phase,
      tag: `${ph.phase} · ${ph.minutes} min`,
      bullets: students.length ? students : clean(ph.teacher).slice(0, 4),
      speakerNotes: notes(["Teacher", ph.teacher], ["Check for understanding", ph.checkForUnderstanding]),
    });
  }
  slides.push({
    layout: "Question",
    heading: "Exit ticket",
    tag: "Before you go",
    bullets: [x.assessment.exitTicket],
    speakerNotes: notes(["Formative assessment", x.assessment.formative]),
  });
  slides.push({
    layout: "Two columns",
    heading: "Differentiation",
    tag: "Teacher only",
    bullets: x.differentiation.support.map((t) => `Support: ${t}`),
    secondColumn: x.differentiation.extension.map((t) => `Extension: ${t}`),
    speakerNotes: notes(["Learning English (EAL/D)", x.differentiation.ealD]),
  });
  return deck(x.title, {
    subtitle: x.overview,
    titleNotes: notes(["Resources", x.resources], ["Teacher notes", x.teacherNotes], ["Capabilities and priorities", x.crossCurriculum]),
    learningIntention: x.learningIntention,
    successCriteria: x.successCriteria,
    curriculumLinks: x.curriculumLinks,
    slides,
  });
}

function unitPlan(x: UnitPlan): ExportDeck {
  const slides: ExportSlide[] = [
    { layout: "Big idea", heading: "Big ideas", bullets: x.bigIdeas, tag: "Unit overview" },
    ...(x.vocabulary.length ? listSlides("Words we will use", [x.vocabulary.join(" · ")], { tag: "Vocabulary" }) : []),
    ...x.lessons.map<ExportSlide>((l) => ({
      layout: "Bullets",
      heading: l.title,
      tag: `Lesson ${l.number} of ${x.lessons.length}`,
      bullets: [l.learningIntention, ...l.keyActivities],
      secondColumn: l.resources,
      sideTitle: "Resources",
      speakerNotes: notes(["Curriculum codes", l.curriculumCodes.join(", ")]),
    })),
    {
      layout: "Bullets",
      heading: "How we will check learning",
      tag: "Assessment",
      bullets: clean([`Before the unit: ${x.assessment.preAssessment}`, ...x.assessment.formative.map((f) => `Along the way: ${f}`), `End-of-unit task: ${x.assessment.summativeTask}`]),
      speakerNotes: notes(["End-of-unit criteria", x.assessment.summativeCriteria]),
    },
    {
      layout: "Two columns",
      heading: "Differentiation",
      tag: "Teacher only",
      bullets: x.differentiation.support.map((t) => `Support: ${t}`),
      secondColumn: x.differentiation.extension.map((t) => `Extension: ${t}`),
      speakerNotes: notes(["Learning English (EAL/D)", x.differentiation.ealD]),
    },
  ];
  return deck(x.title, {
    subtitle: `Unit plan · ${x.lessons.length} lessons`,
    titleNotes: notes(["Overview", x.overview], ["Teacher notes", x.teacherNotes], ["Capabilities and priorities", x.crossCurriculum]),
    successCriteria: x.successCriteria,
    curriculumLinks: x.curriculumLinks,
    slides,
  });
}

function activities(x: Activities): ExportDeck {
  const slides = x.activities.map<ExportSlide>((a, i) => ({
    layout: "Activity",
    heading: a.name,
    tag: `${x.activities.length > 1 ? `Activity ${i + 1} · ` : ""}${a.format} · ${a.minutes} min`,
    bullets: a.steps,
    secondColumn: a.materials,
    sideTitle: "You need",
    speakerNotes: notes(["Teacher's role", a.teacherRole], ["Success looks like", a.successLooksLike], ["Easier", a.support], ["Harder", a.extension]),
  }));
  return deck(x.title, {
    subtitle: x.overview,
    titleNotes: notes(["Classroom management", x.managementTips], ["Teacher notes", x.teacherNotes]),
    learningIntention: x.learningIntention,
    curriculumLinks: x.curriculumLinks,
    slides,
  });
}

function worksheet(x: Worksheet, o: DeckOptions): ExportDeck {
  const slides: ExportSlide[] = [{ layout: "Bullets", heading: "Instructions", bullets: [x.studentInstructions], tag: "Worksheet" }];
  if (x.wordBank.length) slides.push({ layout: "Big idea", heading: "Word bank", bullets: [x.wordBank.join("  ·  ")] });
  for (const s of x.sections) {
    for (const q of s.questions) {
      slides.push({
        layout: "Question",
        heading: `Question ${q.number}`,
        tag: s.heading,
        bullets: [q.prompt, ...letters(q.options)],
        speakerNotes: o.studentOnly ? s.instructions : notes(["", s.instructions], ["Answer", q.answer], ["Marking notes", q.markingNotes]),
      });
    }
  }
  if (!o.studentOnly) {
    const answers = x.sections.flatMap((s) => s.questions.map((q) => `${q.number}. ${q.answer}`));
    slides.push(...listSlides("Answer key", answers, { tag: "Teacher only" }, 8));
  }
  return deck(x.title, {
    titleNotes: o.studentOnly ? "" : notes(["", x.overview], ["Teacher notes", x.teacherNotes]),
    curriculumLinks: x.curriculumLinks,
    slides,
  });
}

function tiered(x: TieredTask, o: DeckOptions): ExportDeck {
  const slides: ExportSlide[] = [];
  if (!o.studentOnly) slides.push({ layout: "Big idea", heading: "Our task", bullets: [x.commonTask], tag: "Everyone" });
  x.tiers.forEach((t, i) => {
    const label = o.studentOnly ? `Level ${i + 1}` : t.tier === "Support" ? "More support" : t.tier;
    slides.push({
      layout: "Activity",
      heading: o.studentOnly ? `${x.title}: ${label}` : label,
      tag: label,
      bullets: t.studentInstructions,
      secondColumn: t.scaffolds,
      sideTitle: "Helpful hints",
      speakerNotes: o.studentOnly ? "" : notes(["Who it is for", t.whoItIsFor], ["Success criteria", t.successCriteria]),
    });
    let offset = 0;
    for (const [k, part] of chunk(t.questions.map((q) => q.prompt), 5).entries()) {
      const answers = t.questions.filter((q) => q.prompt.trim()).slice(offset, offset + part.length);
      slides.push({
        layout: "Activity",
        heading: k ? "Questions (continued)" : "Questions",
        tag: label,
        bullets: part,
        speakerNotes: o.studentOnly ? "" : notes(["Answers", answers.map((q, j) => `${offset + j + 1}. ${q.answer}`)]),
      });
      offset += part.length;
    }
    if (o.studentOnly && t.successCriteria.length) slides.push({ layout: "Bullets", heading: "I can…", tag: label, bullets: t.successCriteria.map((c) => `☐ ${c}`) });
  });
  return deck(x.title, {
    subtitle: o.studentOnly ? "" : x.overview,
    titleNotes: o.studentOnly ? "" : notes(["Learning English (EAL/D)", x.ealDAdjustments], ["Teacher notes", x.teacherNotes]),
    learningIntention: x.learningIntention,
    curriculumLinks: x.curriculumLinks,
    slides,
  });
}

function rubric(x: Rubric): ExportDeck {
  const slides: ExportSlide[] = [{ layout: "Big idea", heading: "The task", bullets: [x.task], tag: "Assessment task" }];
  // Three criteria per table keeps the text readable.
  for (let i = 0; i < x.criteria.length; i += 3) {
    const part = x.criteria.slice(i, i + 3);
    slides.push({
      layout: "Table",
      heading: i ? "Rubric (continued)" : "Rubric",
      bullets: [],
      table: [["Criterion", ...x.levelLabels], ...part.map((c) => [c.criterion, ...x.levelLabels.map((_, j) => c.descriptors[j] ?? "")])],
      speakerNotes: notes(["Curriculum codes", part.map((c) => `${c.criterion}: ${c.curriculumCodes.join(", ")}`)]),
    });
  }
  slides.push({ layout: "Bullets", heading: "Check your work", tag: "Student checklist", bullets: x.studentChecklist.map((c) => `☐ ${c}`) });
  return deck(x.title, {
    subtitle: x.overview,
    titleNotes: notes(["Moderation notes", x.moderationNotes]),
    curriculumLinks: x.curriculumLinks,
    slides,
  });
}

function assessment(x: Assessment, o: DeckOptions): ExportDeck {
  const slides: ExportSlide[] = [{ layout: "Bullets", heading: "Instructions", tag: "Quiz", bullets: [x.studentInstructions, `Total: ${x.totalMarks} marks`] }];
  for (const q of x.questions) {
    slides.push({
      layout: "Question",
      heading: `Question ${q.number}`,
      tag: `${q.marks} mark${q.marks === 1 ? "" : "s"}`,
      bullets: [q.prompt, ...letters(q.options)],
      speakerNotes: o.studentOnly ? "" : notes(["Answer", q.answer], ["Curriculum codes", q.curriculumCodes.join(", ")]),
    });
  }
  if (!o.studentOnly) {
    slides.push(...listSlides("Answers", x.questions.map((q) => `${q.number}. ${q.answer} (${q.marks})`), { tag: "Teacher only" }, 8));
    slides.push(...listSlides("Marking guide", x.markingGuide, { tag: "Teacher only", speakerNotes: notes(["Next steps", x.nextSteps]) }));
  }
  return deck(x.title, {
    titleNotes: o.studentOnly ? "" : x.overview,
    curriculumLinks: x.curriculumLinks,
    slides,
  });
}

function parentNote(x: ParentNote): ExportDeck {
  const paragraphs = x.newsletterText.split(/\n+/);
  return deck(x.title, {
    subtitle: "A note for families",
    curriculumLinks: x.curriculumLinks,
    slides: [
      ...chunk(paragraphs, 3, 600).map<ExportSlide>((part, i) => ({ layout: "Bullets", heading: i ? "What we are learning (continued)" : "What we are learning", bullets: part })),
      ...(x.keyVocabulary.length ? [{ layout: "Big idea" as const, heading: "Words we are learning", bullets: [x.keyVocabulary.join("  ·  ")] }] : []),
      ...x.homeActivities.map<ExportSlide>((h) => ({ layout: "Activity", heading: h.name, tag: "Try at home", bullets: [h.description], secondColumn: [h.materials], sideTitle: "You need" })),
      ...listSlides("Conversation starters", x.conversationStarters, { tag: "Talk about it" }),
    ],
  });
}

function slideDeck(x: SlideDeck): ExportDeck {
  return deck(x.title, {
    subtitle: x.subtitle,
    titleNotes: notes(["", x.overview], ["Teacher notes", x.teacherNotes]),
    learningIntention: x.learningIntention,
    successCriteria: x.successCriteria,
    curriculumLinks: x.curriculumLinks,
    slides: x.slides.map((s) => ({ ...s, secondColumn: s.layout === "Two columns" ? s.secondColumn : [] })),
  });
}

/* -------------------------------- entry -------------------------------- */

export function outputToDeck(outputType: OutputType, content: Record<string, unknown>, o: DeckOptions): ExportDeck {
  switch (outputType) {
    case "lesson_plan":
      return lessonPlan(content as LessonPlan);
    case "unit_plan":
      return unitPlan(content as UnitPlan);
    case "activities":
      return activities(content as Activities);
    case "worksheet":
      return worksheet(content as Worksheet, o);
    case "differentiation":
      return tiered(content as TieredTask, o);
    case "rubric":
      return rubric(content as Rubric);
    case "assessment":
      return assessment(content as Assessment, o);
    case "parent_note":
      return parentNote(content as ParentNote);
    case "slides":
      return slideDeck(content as SlideDeck);
  }
}
