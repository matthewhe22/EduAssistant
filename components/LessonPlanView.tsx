import type { LessonPlan } from "@/lib/generator/schema";
import { Card, CurriculumLinksView, Label, List, Section, Shell } from "./ui";

export function LessonPlanView({ plan, meta, codeText = {} }: { plan: LessonPlan; meta: string; codeText?: Record<string, string> }) {
  return (
    <Shell title={plan.title} meta={meta} overview={plan.overview}>
      <CurriculumLinksView links={plan.curriculumLinks} codeText={codeText} />
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Learning intention">
          <p className="text-sm leading-6">{plan.learningIntention}</p>
        </Section>
        <Section title="Success criteria">
          <List items={plan.successCriteria} />
        </Section>
        <Section title="Vocabulary">
          <ul className="space-y-1 text-sm leading-6">
            {plan.vocabulary.map((v) => (
              <li key={v.term}>
                <strong>{v.term}</strong>: {v.studentFriendlyDefinition}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Resources">
          <List items={plan.resources} />
        </Section>
      </div>
      <Section title="Lesson sequence">
        <div className="space-y-4">
          {plan.phases.map((ph, i) => (
            <Card key={i}>
              <div className="mb-2 flex items-baseline justify-between">
                <h4 className="font-medium">{ph.phase}</h4>
                <span className="text-sm text-slate-500">{ph.minutes} min</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Teacher</Label>
                  <List items={ph.teacher} />
                </div>
                <div>
                  <Label>Students</Label>
                  <List items={ph.students} />
                </div>
              </div>
              {ph.checkForUnderstanding && <p className="mt-2 text-sm italic text-slate-600 dark:text-slate-300">Check: {ph.checkForUnderstanding}</p>}
            </Card>
          ))}
        </div>
      </Section>
      <Section title="Differentiation">
        <div className="grid gap-4 md:grid-cols-3">
          <div><Label>Support</Label><List items={plan.differentiation.support} /></div>
          <div><Label>Extension</Label><List items={plan.differentiation.extension} /></div>
          <div><Label>EAL/D</Label><List items={plan.differentiation.ealD} /></div>
        </div>
      </Section>
      <Section title="Assessment">
        <List items={plan.assessment.formative} />
        <p className="text-sm"><strong>Exit ticket:</strong> {plan.assessment.exitTicket}</p>
      </Section>
      {plan.crossCurriculum.length > 0 && (
        <Section title="Capabilities and cross-curriculum priorities">
          <List items={plan.crossCurriculum} />
        </Section>
      )}
      <Section title="Teacher notes">
        <List items={plan.teacherNotes} />
      </Section>
    </Shell>
  );
}
