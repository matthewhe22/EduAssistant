import type { LessonPlan } from "@/lib/generator/schema";
import { CurriculumLinksView, Label, List, Panel, Section, Shell } from "./ui";

export interface ViewProps<T> {
  content: T;
  meta: string;
  typeLabel: string;
  typePill: string;
  codeText: Record<string, string>;
}

export function LessonPlanView({ content: p, meta, typeLabel, typePill, codeText }: ViewProps<LessonPlan>) {
  return (
    <Shell title={p.title} typeLabel={typeLabel} typePill={typePill} meta={meta}>
      <Section title="Overview" sectionKey="overview" size="sm">
        <p className="m-0 max-w-[64ch] text-ink-soft">{p.overview}</p>
        <CurriculumLinksView links={p.curriculumLinks} codeText={codeText} />
      </Section>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section title="Learning intention" sectionKey="learningIntention" size="sm">
          <p className="m-0">{p.learningIntention}</p>
        </Section>
        <Section title="Success criteria" sectionKey="successCriteria" size="sm">
          <List items={p.successCriteria} />
        </Section>
        <Section title="Vocabulary" sectionKey="vocabulary" size="sm">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {p.vocabulary.map((v) => (
              <li key={v.term}>
                <strong>{v.term}</strong>: {v.studentFriendlyDefinition}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Resources" sectionKey="resources" size="sm">
          <List items={p.resources} />
        </Section>
      </div>
      <Section title="Lesson sequence" sectionKey="phases">
        <ol className="m-0 flex list-none flex-col p-0">
          {p.phases.map((ph, i) => (
            <li key={i} className="grid grid-cols-1 gap-3 border-t border-line py-[18px] sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-5">
              <div>
                <p className="m-0 font-bold">{ph.phase}</p>
                <p className="m-0 mt-0.5 text-sm text-ink-muted">{ph.minutes} min</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Teacher</Label>
                  <List items={ph.teacher} />
                </div>
                <div>
                  <Label tone="wattle">Students</Label>
                  <List items={ph.students} />
                </div>
                {ph.checkForUnderstanding && <p className="m-0 text-[15px] italic text-ink-soft md:col-span-2">Check: {ph.checkForUnderstanding}</p>}
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Differentiation" sectionKey="differentiation">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Panel><p className="m-0 mb-1.5 font-bold">More support</p><List items={p.differentiation.support} /></Panel>
          <Panel><p className="m-0 mb-1.5 font-bold">Extension</p><List items={p.differentiation.extension} /></Panel>
          <Panel><p className="m-0 mb-1.5 font-bold">Learning English</p><List items={p.differentiation.ealD} /></Panel>
        </div>
      </Section>
      <Section title="Assessment" sectionKey="assessment">
        <List items={p.assessment.formative} />
        <Panel tone="wattle">
          <p className="m-0 mb-1 font-display text-xl font-bold">Exit ticket</p>
          <p className="m-0">{p.assessment.exitTicket}</p>
        </Panel>
      </Section>
      {p.crossCurriculum.length > 0 && (
        <Section title="Capabilities and priorities" size="sm">
          <List items={p.crossCurriculum} />
        </Section>
      )}
      <Section title="Teacher notes" sectionKey="teacherNotes" size="sm">
        <List items={p.teacherNotes} />
      </Section>
    </Shell>
  );
}
