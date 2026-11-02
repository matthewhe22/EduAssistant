import type { OutputType } from "@/lib/generator/outputs";
import type { Activities, Assessment, ParentNote, Rubric, TieredTask, UnitPlan, Worksheet, LessonPlan } from "@/lib/generator/schema";
import { LessonPlanView } from "./LessonPlanView";
import { Card, Codes, CurriculumLinksView, Label, List, Section, Shell } from "./ui";

type Props<T> = { content: T; meta: string; codeText: Record<string, string> };

function UnitPlanView({ content: u, meta, codeText }: Props<UnitPlan>) {
  return (
    <Shell title={u.title} meta={meta} overview={u.overview}>
      <CurriculumLinksView links={u.curriculumLinks} codeText={codeText} />
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Big ideas"><List items={u.bigIdeas} /></Section>
        <Section title="Success criteria"><List items={u.successCriteria} /></Section>
      </div>
      <Section title="Vocabulary"><p className="text-sm">{u.vocabulary.join(" · ")}</p></Section>
      <Section title="Lesson sequence">
        <div className="space-y-3">
          {u.lessons.map((l) => (
            <Card key={l.number}>
              <h4 className="font-medium">
                Lesson {l.number}: {l.title}
                <Codes codes={l.curriculumCodes} />
              </h4>
              <p className="mt-1 text-sm italic">{l.learningIntention}</p>
              <div className="mt-2 grid gap-4 md:grid-cols-2">
                <div><Label>Key activities</Label><List items={l.keyActivities} /></div>
                <div><Label>Resources</Label><List items={l.resources} /></div>
              </div>
            </Card>
          ))}
        </div>
      </Section>
      <Section title="Assessment">
        <p className="text-sm"><strong>Pre-assessment:</strong> {u.assessment.preAssessment}</p>
        <Label>Formative</Label>
        <List items={u.assessment.formative} />
        <p className="text-sm"><strong>Summative task:</strong> {u.assessment.summativeTask}</p>
        <List items={u.assessment.summativeCriteria} />
      </Section>
      <Section title="Differentiation">
        <div className="grid gap-4 md:grid-cols-3">
          <div><Label>Support</Label><List items={u.differentiation.support} /></div>
          <div><Label>Extension</Label><List items={u.differentiation.extension} /></div>
          <div><Label>EAL/D</Label><List items={u.differentiation.ealD} /></div>
        </div>
      </Section>
      {u.crossCurriculum.length > 0 && <Section title="Capabilities and cross-curriculum priorities"><List items={u.crossCurriculum} /></Section>}
      <Section title="Teacher notes"><List items={u.teacherNotes} /></Section>
    </Shell>
  );
}

function ActivitiesView({ content: a, meta, codeText }: Props<Activities>) {
  return (
    <Shell title={a.title} meta={meta} overview={a.overview}>
      <CurriculumLinksView links={a.curriculumLinks} codeText={codeText} />
      <Section title="Learning intention"><p className="text-sm">{a.learningIntention}</p></Section>
      <Section title="Activities">
        <div className="space-y-3">
          {a.activities.map((act, i) => (
            <Card key={i}>
              <div className="flex items-baseline justify-between">
                <h4 className="font-medium">{i + 1}. {act.name}</h4>
                <span className="text-sm text-slate-500">{act.format} · {act.minutes} min</span>
              </div>
              <div className="mt-2 grid gap-4 md:grid-cols-3">
                <div><Label>Materials</Label><List items={act.materials} /></div>
                <div className="md:col-span-2"><Label>Steps</Label><List ordered items={act.steps} /></div>
              </div>
              <p className="mt-2 text-sm"><strong>Teacher:</strong> {act.teacherRole}</p>
              <p className="text-sm"><strong>Success looks like:</strong> {act.successLooksLike}</p>
              <p className="text-sm"><strong>Easier:</strong> {act.support} · <strong>Harder:</strong> {act.extension}</p>
            </Card>
          ))}
        </div>
      </Section>
      <Section title="Management tips"><List items={a.managementTips} /></Section>
      <Section title="Teacher notes"><List items={a.teacherNotes} /></Section>
    </Shell>
  );
}

function QuestionBlock({ q, showAnswers }: { q: Worksheet["sections"][number]["questions"][number]; showAnswers: boolean }) {
  return (
    <li className="space-y-1 text-sm leading-6">
      <p><strong>{q.number}.</strong> {q.prompt}</p>
      {q.options.length > 0 && (
        <ol className="ml-8 list-[lower-alpha]">
          {q.options.map((o, i) => <li key={i}>{o}</li>)}
        </ol>
      )}
      {!showAnswers && q.answerLines > 0 && (
        <div className="space-y-5 pt-2">
          {Array.from({ length: Math.min(q.answerLines, 8) }, (_, i) => <div key={i} className="border-b border-slate-300" />)}
        </div>
      )}
      {showAnswers && (
        <p className="text-green-800 dark:text-green-300">
          Answer: {q.answer}
          {q.markingNotes && <span className="text-slate-500"> ({q.markingNotes})</span>}
        </p>
      )}
    </li>
  );
}

function WorksheetView({ content: w, meta, codeText }: Props<Worksheet>) {
  return (
    <div className="space-y-6">
      <Shell title={w.title} meta={meta}>
        <p className="text-sm">{w.studentInstructions}</p>
        {w.wordBank.length > 0 && (
          <div className="rounded border border-dashed border-slate-400 p-3 text-sm"><strong>Word bank:</strong> {w.wordBank.join(" · ")}</div>
        )}
        {w.sections.map((s, i) => (
          <Section key={i} title={s.heading}>
            <p className="text-sm italic">{s.instructions}</p>
            <ol className="space-y-4">{s.questions.map((q) => <QuestionBlock key={q.number} q={q} showAnswers={false} />)}</ol>
          </Section>
        ))}
      </Shell>
      <div className="break-before-page">
        <Shell title={`Answer key: ${w.title}`} meta={meta} overview={w.overview}>
          <CurriculumLinksView links={w.curriculumLinks} codeText={codeText} />
          {w.sections.map((s, i) => (
            <Section key={i} title={s.heading}>
              <ol className="space-y-3">{s.questions.map((q) => <QuestionBlock key={q.number} q={q} showAnswers />)}</ol>
            </Section>
          ))}
          <Section title="Teacher notes"><List items={w.teacherNotes} /></Section>
        </Shell>
      </div>
    </div>
  );
}

function TieredTaskView({ content: t, meta, codeText }: Props<TieredTask>) {
  return (
    <Shell title={t.title} meta={meta} overview={t.overview}>
      <CurriculumLinksView links={t.curriculumLinks} codeText={codeText} />
      <Section title="Learning intention"><p className="text-sm">{t.learningIntention}</p></Section>
      <Section title="Common task"><p className="text-sm">{t.commonTask}</p></Section>
      <div className="grid gap-4 lg:grid-cols-3">
        {t.tiers.map((tier) => (
          <Card key={tier.tier}>
            <h4 className="font-semibold">{tier.tier}</h4>
            <p className="text-xs text-slate-500">{tier.whoItIsFor}</p>
            <Label>Instructions</Label>
            <List ordered items={tier.studentInstructions} />
            <Label>Scaffolds</Label>
            <List items={tier.scaffolds} />
            <Label>Questions</Label>
            <ol className="ml-5 list-decimal space-y-1 text-sm">
              {tier.questions.map((q, i) => (
                <li key={i}>{q.prompt}<div className="text-green-800 dark:text-green-300">{q.answer}</div></li>
              ))}
            </ol>
            <Label>Success criteria</Label>
            <List items={tier.successCriteria} />
          </Card>
        ))}
      </div>
      <Section title="EAL/D adjustments"><List items={t.ealDAdjustments} /></Section>
      <Section title="Teacher notes"><List items={t.teacherNotes} /></Section>
    </Shell>
  );
}

function RubricView({ content: r, meta, codeText }: Props<Rubric>) {
  return (
    <Shell title={r.title} meta={meta} overview={r.overview}>
      <CurriculumLinksView links={r.curriculumLinks} codeText={codeText} />
      <Section title="Task"><p className="text-sm">{r.task}</p></Section>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border p-2 text-left">Criterion</th>
              {r.levelLabels.map((l) => <th key={l} className="border p-2 text-left">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {r.criteria.map((c, i) => (
              <tr key={i} className="align-top">
                <td className="border p-2 font-medium">{c.criterion}<Codes codes={c.curriculumCodes} /></td>
                {r.levelLabels.map((_, j) => <td key={j} className="border p-2">{c.descriptors[j] ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Section title="Student checklist"><List items={r.studentChecklist} /></Section>
      <Section title="Moderation notes"><List items={r.moderationNotes} /></Section>
    </Shell>
  );
}

function AssessmentView({ content: a, meta, codeText }: Props<Assessment>) {
  return (
    <Shell title={a.title} meta={meta} overview={a.overview}>
      <CurriculumLinksView links={a.curriculumLinks} codeText={codeText} />
      <p className="text-sm">{a.studentInstructions}</p>
      <ol className="space-y-4">
        {a.questions.map((q) => (
          <li key={q.number} className="text-sm leading-6">
            <p>
              <strong>{q.number}.</strong> {q.prompt} <span className="text-slate-500">({q.marks} mark{q.marks === 1 ? "" : "s"})</span>
              <Codes codes={q.curriculumCodes} />
            </p>
            {q.options.length > 0 && <ol className="ml-8 list-[lower-alpha]">{q.options.map((o, i) => <li key={i}>{o}</li>)}</ol>}
            <p className="text-green-800 dark:text-green-300">Answer: {q.answer}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm font-medium">Total: {a.totalMarks} marks</p>
      <Section title="Marking guide"><List items={a.markingGuide} /></Section>
      <Section title="Next steps"><List items={a.nextSteps} /></Section>
    </Shell>
  );
}

function ParentNoteView({ content: p, meta, codeText }: Props<ParentNote>) {
  return (
    <Shell title={p.title} meta={meta}>
      <div className="space-y-3 text-sm leading-6">{p.newsletterText.split(/\n+/).map((para, i) => <p key={i}>{para}</p>)}</div>
      <Section title="Words we are learning"><p className="text-sm">{p.keyVocabulary.join(" · ")}</p></Section>
      <Section title="Try at home">
        <ul className="space-y-2 text-sm">
          {p.homeActivities.map((h, i) => (
            <li key={i}><strong>{h.name}:</strong> {h.description} <span className="text-slate-500">({h.materials})</span></li>
          ))}
        </ul>
      </Section>
      <Section title="Conversation starters"><List items={p.conversationStarters} /></Section>
      <div className="print:hidden"><CurriculumLinksView links={p.curriculumLinks} codeText={codeText} /></div>
    </Shell>
  );
}

export function OutputView({ outputType, content, meta, codeText = {} }: { outputType: OutputType; content: Record<string, unknown>; meta: string; codeText?: Record<string, string> }) {
  switch (outputType) {
    case "lesson_plan":
      return <LessonPlanView plan={content as LessonPlan} meta={meta} codeText={codeText} />;
    case "unit_plan":
      return <UnitPlanView content={content as UnitPlan} meta={meta} codeText={codeText} />;
    case "activities":
      return <ActivitiesView content={content as Activities} meta={meta} codeText={codeText} />;
    case "worksheet":
      return <WorksheetView content={content as Worksheet} meta={meta} codeText={codeText} />;
    case "differentiation":
      return <TieredTaskView content={content as TieredTask} meta={meta} codeText={codeText} />;
    case "rubric":
      return <RubricView content={content as Rubric} meta={meta} codeText={codeText} />;
    case "assessment":
      return <AssessmentView content={content as Assessment} meta={meta} codeText={codeText} />;
    case "parent_note":
      return <ParentNoteView content={content as ParentNote} meta={meta} codeText={codeText} />;
  }
}
