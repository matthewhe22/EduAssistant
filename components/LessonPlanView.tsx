import type { LessonPlan } from "@/lib/generator/schema";

function List({ items }: { items: string[] }) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return <p className="text-sm text-slate-500">None</p>;
  return (
    <ul className="ml-5 list-disc space-y-1 text-sm leading-6">
      {filtered.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 break-inside-avoid">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function LessonPlanView({
  plan,
  meta,
  codeText = {},
}: {
  plan: LessonPlan;
  meta: string;
  codeText?: Record<string, string>;
}) {
  return (
    <article className="space-y-6 rounded-lg border border-slate-200 p-6 dark:border-slate-800 print:border-0 print:p-0">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">{plan.title}</h2>
        <p className="text-sm text-slate-500">{meta}</p>
        <p className="text-sm leading-6">{plan.overview}</p>
      </header>

      <Section title="Victorian Curriculum 2.0">
        <ul className="space-y-2 text-sm leading-6">
          {plan.curriculumLinks.map((l) => (
            <li key={l.code}>
              <span className="mr-2 font-mono text-xs font-semibold">{l.code}</span>
              {codeText[l.code] && <span>{codeText[l.code]}</span>}
              <div className="text-slate-600 dark:text-slate-300">{l.howAddressed}</div>
            </li>
          ))}
        </ul>
      </Section>

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
            <div key={i} className="rounded border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-2 flex items-baseline justify-between">
                <h4 className="font-medium">{ph.phase}</h4>
                <span className="text-sm text-slate-500">{ph.minutes} min</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Teacher</p>
                  <List items={ph.teacher} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Students</p>
                  <List items={ph.students} />
                </div>
              </div>
              {ph.checkForUnderstanding && (
                <p className="mt-2 text-sm italic text-slate-600 dark:text-slate-300">Check: {ph.checkForUnderstanding}</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Differentiation">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Support</p>
            <List items={plan.differentiation.support} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Extension</p>
            <List items={plan.differentiation.extension} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">EAL/D</p>
            <List items={plan.differentiation.ealD} />
          </div>
        </div>
      </Section>

      <Section title="Assessment">
        <List items={plan.assessment.formative} />
        <p className="text-sm">
          <strong>Exit ticket:</strong> {plan.assessment.exitTicket}
        </p>
      </Section>

      {plan.crossCurriculum.length > 0 && (
        <Section title="Capabilities and cross-curriculum priorities">
          <List items={plan.crossCurriculum} />
        </Section>
      )}
      <Section title="Teacher notes">
        <List items={plan.teacherNotes} />
      </Section>
    </article>
  );
}
