import { getCurriculumIndex, getSubject } from "@/lib/curriculum";
import { LEVEL_LABELS, PRIMARY_LEVELS, type PrimaryLevel } from "@/lib/curriculum/types";

export const dynamic = "force-dynamic";

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: { subject?: string; level?: string };
}) {
  const index = await getCurriculumIndex();
  if (!index) {
    return <p>The curriculum dataset has not been built yet. Run <code>npm run curriculum:scrape</code>.</p>;
  }
  const slug = searchParams.subject ?? index.subjects.find((s) => s.slug === "mathematics")?.slug ?? index.subjects[0]?.slug;
  const level = (PRIMARY_LEVELS as readonly string[]).includes(searchParams.level ?? "")
    ? (searchParams.level as PrimaryLevel)
    : "F";
  const subject = slug ? await getSubject(slug) : null;
  const lvl = subject?.levels.find((l) => l.level === level);
  const byArea = Object.groupBy
    ? Object.groupBy(index.subjects, (s) => s.learningArea)
    : index.subjects.reduce<Record<string, typeof index.subjects>>((acc, s) => {
        (acc[s.learningArea] ??= []).push(s);
        return acc;
      }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Victorian Curriculum 2.0 — Foundation to Level 6</h1>
      <form className="flex flex-wrap gap-3" method="get">
        <select name="subject" defaultValue={slug} className="rounded border px-2 py-1 dark:bg-slate-900">
          {Object.entries(byArea).map(([area, subjects]) => (
            <optgroup key={area} label={area}>
              {subjects!.map((s) => (
                <option key={s.slug} value={s.slug}>{s.subject}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select name="level" defaultValue={level} className="rounded border px-2 py-1 dark:bg-slate-900">
          {PRIMARY_LEVELS.map((l) => (
            <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
          ))}
        </select>
        <button className="rounded bg-slate-900 px-3 py-1 text-white dark:bg-white dark:text-slate-900">Show</button>
      </form>

      {!subject || !lvl ? (
        <p className="text-slate-600">No content for this subject at {LEVEL_LABELS[level]}.</p>
      ) : (
        <article className="space-y-6">
          <h2 className="text-xl font-semibold">{subject.subject} · {LEVEL_LABELS[level]}</h2>
          <section>
            <h3 className="font-medium">Achievement standard</h3>
            {lvl.achievementStandard.split("\n").map((p, i) => (
              <p key={i} className="mt-2 text-sm leading-6">{p}</p>
            ))}
          </section>
          <section>
            <h3 className="font-medium">Content descriptions</h3>
            <ul className="mt-2 space-y-2">
              {lvl.contentDescriptions.map((cd) => (
                <li key={cd.code} className="text-sm leading-6">
                  <span className="mr-2 font-mono text-xs text-slate-500">{cd.code}</span>
                  <span className="mr-2 text-xs text-slate-500">{[cd.strand, cd.subStrand].filter(Boolean).join(" › ")}</span>
                  {cd.text}
                </li>
              ))}
            </ul>
          </section>
        </article>
      )}
    </div>
  );
}
