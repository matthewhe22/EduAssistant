"use client";

import type { OutputType } from "@/lib/generator/outputs";
import type { Activities, Assessment, LessonPlan, ParentNote, Rubric, SlideDeck, TieredTask, UnitPlan, Worksheet } from "@/lib/generator/schema";
import { OUTPUT_UI } from "@/lib/ui/labels";
import { LessonPlanView, type ViewProps } from "./LessonPlanView";
import { Icon, ICONS } from "./Icon";
import { Codes, CurriculumLinksView, Label, List, Panel, Section, Shell, useViewOptions } from "./ui";

function Diff({ d }: { d: { support: string[]; extension: string[]; ealD: string[] } }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Panel><p className="m-0 mb-1.5 font-bold">More support</p><List items={d.support} /></Panel>
      <Panel><p className="m-0 mb-1.5 font-bold">Extension</p><List items={d.extension} /></Panel>
      <Panel><p className="m-0 mb-1.5 font-bold">Learning English</p><List items={d.ealD} /></Panel>
    </div>
  );
}

function UnitPlanView({ content: u, ...v }: ViewProps<UnitPlan>) {
  const { expandLesson } = useViewOptions();
  return (
    <Shell title={u.title} {...v}>
      <Section title="Overview" sectionKey="overview" size="sm">
        <p className="m-0 max-w-[64ch] text-ink-soft">{u.overview}</p>
        <CurriculumLinksView links={u.curriculumLinks} codeText={v.codeText} />
      </Section>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section title="Big ideas" sectionKey="bigIdeas" size="sm"><List items={u.bigIdeas} /></Section>
        <Section title="Success criteria" sectionKey="successCriteria" size="sm"><List items={u.successCriteria} /></Section>
      </div>
      {u.vocabulary.length > 0 && <p className="m-0 text-[15px]"><strong>Vocabulary:</strong> {u.vocabulary.join(" · ")}</p>}
      <Section title="Lesson sequence" sectionKey="lessons">
        <ol className="m-0 flex list-none flex-col p-0">
          {u.lessons.map((l) => (
            <li key={l.number} className="grid grid-cols-1 gap-3 border-t border-line py-[18px] sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-5">
              <p className="m-0 font-bold">Lesson {l.number}</p>
              <div className="flex flex-col gap-2">
                <p className="m-0 font-bold">{l.title}<Codes codes={l.curriculumCodes} /></p>
                <p className="m-0 italic text-ink-soft">{l.learningIntention}</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div><Label>Key activities</Label><List items={l.keyActivities} /></div>
                  <div><Label tone="wattle">Resources</Label><List items={l.resources} /></div>
                </div>
                {expandLesson && (
                  <button
                    type="button"
                    onClick={() => expandLesson(l.number)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-[10px] border border-line-strong bg-white px-3 text-sm font-bold text-euc-dark hover:border-euc hover:bg-euc-tint print:hidden"
                  >
                    <Icon d={ICONS.plus} size={16} />
                    Make this a full lesson plan
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Assessment" sectionKey="assessment">
        <p className="m-0"><strong>Before the unit:</strong> {u.assessment.preAssessment}</p>
        <div><Label>Along the way</Label><List items={u.assessment.formative} /></div>
        <Panel tone="wattle">
          <p className="m-0 mb-1 font-display text-xl font-bold">End-of-unit task</p>
          <p className="m-0 mb-2">{u.assessment.summativeTask}</p>
          <List items={u.assessment.summativeCriteria} />
        </Panel>
      </Section>
      <Section title="Differentiation" sectionKey="differentiation"><Diff d={u.differentiation} /></Section>
      {u.crossCurriculum.length > 0 && <Section title="Capabilities and priorities" size="sm"><List items={u.crossCurriculum} /></Section>}
      <Section title="Teacher notes" sectionKey="teacherNotes" size="sm"><List items={u.teacherNotes} /></Section>
    </Shell>
  );
}

function ActivitiesView({ content: a, ...v }: ViewProps<Activities>) {
  return (
    <Shell title={a.title} {...v}>
      <div className="flex flex-col gap-3">
        <p className="m-0 max-w-[64ch] text-ink-soft">{a.overview}</p>
        <CurriculumLinksView links={a.curriculumLinks} codeText={v.codeText} />
      </div>
      <Section title="Learning intention" sectionKey="learningIntention" size="sm"><p className="m-0">{a.learningIntention}</p></Section>
      <Section title="Activities" sectionKey="activities">
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {a.activities.map((act, i) => (
            <li key={i} className="break-inside-avoid rounded-xl border border-line p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="m-0 text-lg font-bold">{i + 1}. {act.name}</h3>
                <span className="text-sm text-ink-muted">{act.format} · {act.minutes} min</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div><Label tone="wattle">Materials</Label><List items={act.materials} /></div>
                <div className="md:col-span-2"><Label>Steps</Label><List ordered items={act.steps} /></div>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-[15px]">
                <p className="m-0"><strong>Teacher:</strong> {act.teacherRole}</p>
                <p className="m-0"><strong>Success looks like:</strong> {act.successLooksLike}</p>
                <p className="m-0"><strong>Easier:</strong> {act.support} <strong className="ml-2">Harder:</strong> {act.extension}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Classroom management" sectionKey="managementTips" size="sm"><List items={a.managementTips} /></Section>
      <Section title="Teacher notes" sectionKey="teacherNotes" size="sm"><List items={a.teacherNotes} /></Section>
    </Shell>
  );
}

type WQ = Worksheet["sections"][number]["questions"][number];
function Question({ q, answers }: { q: WQ; answers: boolean }) {
  return (
    <li className="flex break-inside-avoid flex-col gap-1">
      <p className="m-0"><strong>{q.number}.</strong> {q.prompt}</p>
      {q.options.length > 0 && <ol className="m-0 ml-8 list-[lower-alpha]">{q.options.map((o, i) => <li key={i}>{o}</li>)}</ol>}
      {!answers && q.answerLines > 0 && (
        <div className="flex flex-col gap-6 pt-3" aria-hidden="true">
          {Array.from({ length: Math.min(q.answerLines, 8) }, (_, i) => <div key={i} className="border-b border-line-strong" />)}
        </div>
      )}
      {answers && (
        <p className="m-0 text-euc-dark">
          Answer: {q.answer}
          {q.markingNotes && <span className="text-ink-muted"> ({q.markingNotes})</span>}
        </p>
      )}
    </li>
  );
}

function WorksheetView({ content: w, ...v }: ViewProps<Worksheet>) {
  const { studentCopy } = useViewOptions();
  return (
    <div className="flex flex-col gap-6">
      <Shell title={w.title} {...v}>
        <p className="m-0 text-ink-muted print:block">Name: ____________________ &nbsp; Date: ____________</p>
        <Section title="Instructions" sectionKey="studentInstructions" size="sm"><p className="m-0">{w.studentInstructions}</p></Section>
        {w.wordBank.length > 0 && (
          <Section title="Word bank" sectionKey="wordBank" size="sm">
            <p className="m-0 rounded-xl border-[1.5px] border-dashed border-line-strong px-4 py-3">{w.wordBank.join("  ·  ")}</p>
          </Section>
        )}
        <Section title="Questions" sectionKey="sections">
          {w.sections.map((s, i) => (
            <div key={i} className="flex flex-col gap-3">
              <h3 className="m-0 mt-2 text-lg font-bold">{s.heading}</h3>
              <p className="m-0 italic text-ink-soft">{s.instructions}</p>
              <ol className="m-0 flex list-none flex-col gap-5 p-0">{s.questions.map((q) => <Question key={q.number} q={q} answers={false} />)}</ol>
            </div>
          ))}
        </Section>
      </Shell>
      {!studentCopy && <div className="print:break-before-page">
        <Shell title={`Answer key: ${w.title}`} {...v} secondary>
          <p className="m-0 max-w-[64ch] text-ink-soft">{w.overview}</p>
          <CurriculumLinksView links={w.curriculumLinks} codeText={v.codeText} />
          {w.sections.map((s, i) => (
            <div key={i} className="flex flex-col gap-3">
              <h3 className="m-0 text-lg font-bold">{s.heading}</h3>
              <ol className="m-0 flex list-none flex-col gap-4 p-0">{s.questions.map((q) => <Question key={q.number} q={q} answers />)}</ol>
            </div>
          ))}
          <Section title="Teacher notes" sectionKey="teacherNotes" size="sm"><List items={w.teacherNotes} /></Section>
        </Shell>
      </div>}
    </div>
  );
}

function TieredTaskView({ content: t, ...v }: ViewProps<TieredTask>) {
  const { studentCopy } = useViewOptions();
  if (studentCopy) {
    return (
      <div className="flex flex-col gap-6">
        {t.tiers.map((tier, i) => (
          <div key={tier.tier} className={i > 0 ? "print:break-before-page" : ""}>
            <Shell title={t.title} {...v} meta={`${v.meta} · Level ${i + 1}`} secondary>
              <p className="m-0 text-ink-muted">Name: ____________________ &nbsp; Date: ____________</p>
              <div><Label>What to do</Label><List ordered items={tier.studentInstructions} /></div>
              {tier.scaffolds.length > 0 && <Panel><Label tone="wattle">Helpful hints</Label><List items={tier.scaffolds} /></Panel>}
              <ol className="m-0 flex list-decimal flex-col gap-5 pl-5">
                {tier.questions.map((q, n) => (
                  <li key={n} className="break-inside-avoid">
                    {q.prompt}
                    <div className="mt-2 flex flex-col gap-5">{[0, 1, 2].map((k) => <div key={k} className="border-b border-line-strong" />)}</div>
                  </li>
                ))}
              </ol>
              <div><Label tone="muted">I can…</Label><ul className="m-0 flex list-none flex-col gap-1 p-0">{tier.successCriteria.map((c, k) => <li key={k}>☐ {c}</li>)}</ul></div>
            </Shell>
          </div>
        ))}
      </div>
    );
  }
  return (
    <Shell title={t.title} {...v}>
      <div className="flex flex-col gap-3">
        <p className="m-0 max-w-[64ch] text-ink-soft">{t.overview}</p>
        <CurriculumLinksView links={t.curriculumLinks} codeText={v.codeText} />
      </div>
      <p className="m-0"><strong>Learning intention:</strong> {t.learningIntention}</p>
      <Section title="The shared task" sectionKey="commonTask" size="sm"><p className="m-0">{t.commonTask}</p></Section>
      <Section title="Three levels" sectionKey="tiers">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {t.tiers.map((tier) => (
            <div key={tier.tier} className="flex break-inside-avoid flex-col gap-2 rounded-xl border border-line p-4">
              <p className="m-0 font-display text-xl font-bold">{tier.tier === "Support" ? "More support" : tier.tier}</p>
              <p className="m-0 text-sm text-ink-muted">{tier.whoItIsFor}</p>
              <div><Label>Instructions</Label><List ordered items={tier.studentInstructions} /></div>
              <div><Label tone="wattle">Scaffolds</Label><List items={tier.scaffolds} /></div>
              <div>
                <Label>Questions</Label>
                <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
                  {tier.questions.map((q, i) => <li key={i}>{q.prompt}<div className="text-euc-dark">{q.answer}</div></li>)}
                </ol>
              </div>
              <div><Label tone="muted">Success criteria</Label><List items={tier.successCriteria} /></div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Learning English" sectionKey="ealDAdjustments" size="sm"><List items={t.ealDAdjustments} /></Section>
      <Section title="Teacher notes" sectionKey="teacherNotes" size="sm"><List items={t.teacherNotes} /></Section>
    </Shell>
  );
}

function RubricView({ content: r, ...v }: ViewProps<Rubric>) {
  return (
    <Shell title={r.title} {...v}>
      <div className="flex flex-col gap-3">
        <p className="m-0 max-w-[64ch] text-ink-soft">{r.overview}</p>
        <CurriculumLinksView links={r.curriculumLinks} codeText={v.codeText} />
      </div>
      <Section title="The task" sectionKey="task" size="sm"><p className="m-0">{r.task}</p></Section>
      <Section title="Rubric" sectionKey="criteria">
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] border-collapse text-[15px]">
            <thead>
              <tr className="bg-mist text-left">
                <th scope="col" className="p-3">Criterion</th>
                {r.levelLabels.map((l) => <th key={l} scope="col" className="p-3">{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {r.criteria.map((c, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <th scope="row" className="p-3 text-left">{c.criterion}<Codes codes={c.curriculumCodes} /></th>
                  {r.levelLabels.map((_, j) => <td key={j} className="p-3">{c.descriptors[j] ?? ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Student checklist" sectionKey="studentChecklist" size="sm">
        <ul className="m-0 flex list-none flex-col gap-1 p-0">{r.studentChecklist.map((s, i) => <li key={i}>☐ {s}</li>)}</ul>
      </Section>
      <Section title="Moderation notes" sectionKey="moderationNotes" size="sm"><List items={r.moderationNotes} /></Section>
    </Shell>
  );
}

function AssessmentView({ content: a, ...v }: ViewProps<Assessment>) {
  const { studentCopy } = useViewOptions();
  return (
    <Shell title={a.title} {...v}>
      {studentCopy ? (
        <p className="m-0 text-ink-muted">Name: ____________________ &nbsp; Date: ____________</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 max-w-[64ch] text-ink-soft">{a.overview}</p>
          <CurriculumLinksView links={a.curriculumLinks} codeText={v.codeText} />
        </div>
      )}
      <Section title="Instructions" sectionKey="studentInstructions" size="sm"><p className="m-0">{a.studentInstructions}</p></Section>
      <Section title="Questions" sectionKey="questions">
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {a.questions.map((q) => (
            <li key={q.number} className="break-inside-avoid">
              <p className="m-0">
                <strong>{q.number}.</strong> {q.prompt} <span className="text-ink-muted">({q.marks} mark{q.marks === 1 ? "" : "s"})</span>
                {!studentCopy && <Codes codes={q.curriculumCodes} />}
              </p>
              {q.options.length > 0 && <ol className="m-0 ml-8 list-[lower-alpha]">{q.options.map((o, i) => <li key={i}>{o}</li>)}</ol>}
              {studentCopy ? (
                q.options.length === 0 && <div className="mt-3 flex flex-col gap-6">{[0, 1, 2].map((k) => <div key={k} className="border-b border-line-strong" />)}</div>
              ) : (
                <p className="m-0 text-euc-dark">Answer: {q.answer}</p>
              )}
            </li>
          ))}
        </ol>
        <p className="m-0 font-bold">{studentCopy ? `Total: ____ / ${a.totalMarks}` : `Total: ${a.totalMarks} marks`}</p>
      </Section>
      {!studentCopy && (
        <>
          <Section title="Marking guide" sectionKey="markingGuide" size="sm"><List items={a.markingGuide} /></Section>
          <Section title="Next steps" sectionKey="nextSteps" size="sm"><List items={a.nextSteps} /></Section>
        </>
      )}
    </Shell>
  );
}

function ParentNoteView({ content: p, ...v }: ViewProps<ParentNote>) {
  return (
    <Shell title={p.title} {...v}>
      <Section title="Note" sectionKey="newsletterText" size="sm">
        <div className="flex max-w-[64ch] flex-col gap-3">{p.newsletterText.split(/\n+/).map((para, i) => <p key={i} className="m-0">{para}</p>)}</div>
      </Section>
      <Section title="Words we are learning" sectionKey="keyVocabulary" size="sm"><p className="m-0">{p.keyVocabulary.join(" · ")}</p></Section>
      <Section title="Try at home" sectionKey="homeActivities" size="sm">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {p.homeActivities.map((h, i) => <li key={i}><strong>{h.name}:</strong> {h.description} <span className="text-ink-muted">({h.materials})</span></li>)}
        </ul>
      </Section>
      <Section title="Conversation starters" sectionKey="conversationStarters" size="sm"><List items={p.conversationStarters} /></Section>
      <div className="print:hidden"><CurriculumLinksView links={p.curriculumLinks} codeText={v.codeText} /></div>
    </Shell>
  );
}

/** A 16:9 slide preview, styled like the downloaded PowerPoint. */
function SlideFrame({ n, tag, children, dark = false }: { n: number; tag?: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={`relative flex aspect-video w-full flex-col overflow-hidden rounded-xl border p-[4%] shadow-sm ${dark ? "border-euc-dark bg-euc-dark text-white" : "border-line-strong bg-white"}`}
      aria-label={`Slide ${n}`}
    >
      {tag && <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-euc">{tag}</p>}
      {children}
      <span className={`absolute bottom-2 right-3 text-xs ${dark ? "text-[#DCE8E1]" : "text-ink-muted"}`}>{n}</span>
      {!dark && <span className="absolute inset-x-0 bottom-0 h-1 bg-euc" />}
    </div>
  );
}

function SlideHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 mb-3 border-l-[5px] border-wattle pl-3 font-display text-xl font-bold leading-tight text-euc-dark sm:text-2xl">{children}</h3>;
}

const SLIDE_TAGS: Record<string, string | undefined> = { Question: "Think about it", Activity: "Your turn", "Big idea": "Big idea" };

function SlidesView({ content: d, ...v }: ViewProps<SlideDeck>) {
  return (
    <Shell title={d.title} {...v}>
      <div className="flex flex-col gap-3">
        <p className="m-0 max-w-[64ch] text-ink-soft">{d.overview}</p>
        <CurriculumLinksView links={d.curriculumLinks} codeText={v.codeText} />
      </div>
      <Section title="Success criteria" sectionKey="successCriteria" size="sm">
        <p className="m-0 mb-2"><strong>Learning intention:</strong> {d.learningIntention}</p>
        <List items={d.successCriteria} />
      </Section>
      <Section title="Slides" sectionKey="slides">
        <p className="m-0 text-sm text-ink-muted print:hidden">
          Slides 1 and 2 (title, learning intention and success criteria) are made from the details above. Download PowerPoint to change fonts, add pictures or move things around.
        </p>
        <ol className="m-0 grid list-none grid-cols-1 gap-5 p-0">
          <li className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SlideFrame n={1} dark>
              <div className="flex flex-1 flex-col justify-center">
                <span className="mb-3 block h-1.5 w-16 bg-wattle" />
                <p className="m-0 font-display text-2xl font-bold leading-tight sm:text-3xl">{d.title}</p>
                {d.subtitle && <p className="m-0 mt-2 text-lg text-wattle">{d.subtitle}</p>}
              </div>
              <p className="m-0 text-sm text-[#DCE8E1]">{v.meta}</p>
            </SlideFrame>
            <p className="m-0 self-center text-sm text-ink-muted">Title slide</p>
          </li>
          <li className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SlideFrame n={2} tag="Learning intention">
              <SlideHeading>Today we are learning</SlideHeading>
              <p className="m-0 mb-3 rounded-lg bg-euc-tint px-3 py-2 font-bold text-euc-dark">{d.learningIntention}</p>
              <p className="m-0 mb-1 text-sm font-bold text-euc">Success criteria</p>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[15px]">{d.successCriteria.map((c, i) => <li key={i}>☐ {c}</li>)}</ul>
            </SlideFrame>
            <p className="m-0 self-center text-sm text-ink-muted">Learning intention and success criteria</p>
          </li>
          {d.slides.map((s, i) => (
            <li key={i} className="grid break-inside-avoid grid-cols-1 gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <SlideFrame n={i + 3} tag={SLIDE_TAGS[s.layout]}>
                <SlideHeading>{s.heading}</SlideHeading>
                <div className="flex min-h-0 flex-1 gap-4">
                  {s.layout === "Two columns" ? (
                    <div className="grid flex-1 grid-cols-2 gap-3">
                      <div className="rounded-lg border border-line bg-paper p-2.5 text-[15px]"><List items={s.bullets} /></div>
                      <div className="rounded-lg border border-line bg-paper p-2.5 text-[15px]"><List items={s.secondColumn} /></div>
                    </div>
                  ) : s.layout === "Question" || s.layout === "Big idea" ? (
                    <div className={`flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg p-3 text-center ${s.layout === "Question" ? "border border-wattle bg-wattle-tint" : ""}`}>
                      <p className="m-0 font-display text-lg font-bold leading-snug sm:text-xl">{s.bullets[0] ?? s.heading}</p>
                      {s.bullets.slice(1).map((b, k) => <p key={k} className="m-0 text-[15px] text-ink-soft">{b}</p>)}
                    </div>
                  ) : (
                    <div className="flex-1 text-[15px]"><List ordered={s.layout === "Activity"} items={s.bullets} /></div>
                  )}
                  {s.imageIdea && s.layout !== "Two columns" && (
                    <div className="flex w-[34%] shrink-0 flex-col items-center justify-center rounded-lg border-[1.5px] border-dashed border-euc bg-euc-tint p-2 text-center text-xs text-ink-soft">
                      <strong className="text-euc">Picture idea</strong>
                      {s.imageIdea}
                    </div>
                  )}
                </div>
              </SlideFrame>
              <div className="self-start rounded-xl bg-mist p-3 text-[15px]">
                <Label tone="muted">Speaker notes · {s.layout}</Label>
                <p className="m-0 whitespace-pre-line text-ink-soft">{s.speakerNotes || "—"}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Teacher notes" sectionKey="teacherNotes" size="sm"><List items={d.teacherNotes} /></Section>
    </Shell>
  );
}

export function OutputView({ outputType, content, meta, codeText = {} }: { outputType: OutputType; content: Record<string, unknown>; meta: string; codeText?: Record<string, string> }) {
  const v = { meta, codeText, typeLabel: OUTPUT_UI[outputType].label, typePill: OUTPUT_UI[outputType].pill };
  switch (outputType) {
    case "lesson_plan":
      return <LessonPlanView content={content as LessonPlan} {...v} />;
    case "unit_plan":
      return <UnitPlanView content={content as UnitPlan} {...v} />;
    case "activities":
      return <ActivitiesView content={content as Activities} {...v} />;
    case "worksheet":
      return <WorksheetView content={content as Worksheet} {...v} />;
    case "differentiation":
      return <TieredTaskView content={content as TieredTask} {...v} />;
    case "rubric":
      return <RubricView content={content as Rubric} {...v} />;
    case "assessment":
      return <AssessmentView content={content as Assessment} {...v} />;
    case "parent_note":
      return <ParentNoteView content={content as ParentNote} {...v} />;
    case "slides":
      return <SlidesView content={content as SlideDeck} {...v} />;
  }
}
