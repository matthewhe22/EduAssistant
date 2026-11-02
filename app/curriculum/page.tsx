import { Page } from "@/components/Page";
import { bandForLevel, getCurriculumIndex, getSubject } from "@/lib/curriculum";
import { PRIMARY_LEVELS, type PrimaryLevel } from "@/lib/curriculum/types";
import { YEAR_LABELS } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

export default async function CurriculumPage({ searchParams }: { searchParams: { subject?: string; level?: string } }) {
  const index = await getCurriculumIndex();
  if (!index) return <Page title="Curriculum"><p>The curriculum data hasn&apos;t been built yet.</p></Page>;
  const slug = searchParams.subject ?? "mathematics";
  const level = (PRIMARY_LEVELS as readonly string[]).includes(searchParams.level ?? "") ? (searchParams.level as PrimaryLevel) : "3";
  const subject = await getSubject(slug);
  const band = subject ? bandForLevel(subject, level) : null;
  const byArea = index.subjects.reduce<Record<string, typeof index.subjects>>((acc, s) => {
    (acc[s.learningArea] ??= []).push(s);
    return acc;
  }, {});
  const yearLink = (l: PrimaryLevel) => `/curriculum?subject=${slug}&level=${l}`;

  return (
    <Page eyebrow="Victorian Curriculum 2.0" title="What students learn">
      <div className="flex flex-col gap-6">
        <form method="get" className="card flex flex-wrap items-end gap-4 p-5">
          <input type="hidden" name="level" value={level} />
          <label className="label min-w-[260px] flex-1">
            Subject
            <select name="subject" defaultValue={slug} className="field font-normal">
              {Object.entries(byArea).map(([area, subjects]) => (
                <optgroup key={area} label={area}>
                  {subjects.map((s) => <option key={s.slug} value={s.slug}>{s.subject}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <button className="btn-outline">Show</button>
          <div className="w-full">
            <p className="m-0 mb-2 text-[15px] font-bold">Year level</p>
            <div className="flex flex-wrap gap-2">
              {PRIMARY_LEVELS.map((l) => (
                <a
                  key={l}
                  href={yearLink(l)}
                  aria-current={l === level ? "page" : undefined}
                  className={`inline-flex min-h-[44px] min-w-[48px] items-center justify-center rounded-[10px] px-3 font-bold no-underline ${l === level ? "bg-euc text-white hover:text-white" : "border border-line-strong bg-white text-ink hover:bg-mist hover:text-ink"}`}
                >
                  {l === "F" ? "Prep" : l}
                </a>
              ))}
            </div>
          </div>
        </form>

        {!subject || !band ? (
          <p className="text-ink-soft">{subject?.subject ?? "This subject"} isn&apos;t taught at {YEAR_LABELS[level]}.</p>
        ) : (
          <article className="card flex flex-col gap-8 px-6 py-8 sm:px-12 sm:py-10">
            <header className="flex flex-col gap-2">
              <h2 className="m-0 text-[32px] font-bold leading-tight">{subject.subject} · {YEAR_LABELS[level]}</h2>
              {band.levels.length > 1 && (
                <p className="m-0 text-ink-soft">Written as one band for {band.levels.map((l) => YEAR_LABELS[l]).join(" and ")} ({band.band}).</p>
              )}
            </header>
            <section className="rounded-xl bg-mist p-5">
              <h3 className="m-0 mb-2 text-xl font-bold">By the end of the {band.levels.length > 1 ? "band" : "year"}</h3>
              {band.achievementStandard.split("\n").map((p, i) => <p key={i} className="m-0 mt-2 first:mt-0">{p}</p>)}
            </section>
            <section className="flex flex-col gap-3">
              <h3 className="m-0 text-2xl font-bold">Content descriptions</h3>
              <ul className="m-0 flex list-none flex-col p-0">
                {band.contentDescriptions.map((cd) => (
                  <li key={cd.code} className="border-t border-line py-4">
                    <p className="m-0 text-sm text-ink-muted">
                      <span className="mr-2 font-mono font-bold text-euc">{cd.code}</span>
                      {[cd.strand, cd.subStrand].filter(Boolean).join(" › ")}
                    </p>
                    <p className="m-0 mt-1">{cd.text}</p>
                    {cd.elaborations.length > 0 && (
                      <details className="mt-2 text-[15px] text-ink-soft">
                        <summary className="cursor-pointer font-bold text-euc">Teaching ideas ({cd.elaborations.length})</summary>
                        <ul className="m-0 mt-2 flex list-disc flex-col gap-1 pl-5">{cd.elaborations.map((e, i) => <li key={i}>{e}</li>)}</ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </article>
        )}
      </div>
    </Page>
  );
}
