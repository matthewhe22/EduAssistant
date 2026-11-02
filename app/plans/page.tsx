import { DeleteButton } from "@/components/DeleteButton";
import { Icon, ICONS } from "@/components/Icon";
import { Notice, Page } from "@/components/Page";
import { pageUser } from "@/lib/auth/page";
import { getCurriculumIndex } from "@/lib/curriculum";
import { PRIMARY_LEVELS, type PrimaryLevel } from "@/lib/curriculum/types";
import { listGenerations } from "@/lib/data/generations";
import { OUTPUT_TYPES, isOutputType } from "@/lib/generator/outputs";
import { OUTPUT_UI, YEAR_LABELS } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
type Params = { q?: string; type?: string; subject?: string; level?: string; rating?: string; page?: string };

function when(d: string | Date) {
  const date = new Date(d);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 1 && new Date().getDate() === date.getDate()) return "Today";
  if (days < 2) return "Yesterday";
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default async function LibraryPage({ searchParams }: { searchParams: Params }) {
  const auth = await pageUser("/plans");
  if (!auth) return <Page title="Your library"><Notice tone="info">The library needs a database. Set DATABASE_URL to enable it.</Notice></Page>;

  const index = await getCurriculumIndex();
  const subjectName = (slug: string) => index?.subjects.find((s) => s.slug === slug)?.subject ?? slug;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const type = isOutputType(searchParams.type) ? searchParams.type : undefined;
  const rating = ["up", "down", "none"].includes(searchParams.rating ?? "") ? (searchParams.rating as "up" | "down" | "none") : undefined;
  const level = (PRIMARY_LEVELS as readonly string[]).includes(searchParams.level ?? "") ? searchParams.level : undefined;
  const subject = searchParams.subject && /^[a-z0-9-]+$/.test(searchParams.subject) ? searchParams.subject : undefined;

  let items: Awaited<ReturnType<typeof listGenerations>>["items"] = [];
  let count = 0;
  let error: string | null = null;
  try {
    ({ items, count } = await listGenerations(
      auth.db,
      auth.user.id,
      { q: (searchParams.q ?? "").trim().slice(0, 100) || undefined, outputType: type, subjectSlug: subject, level, rating },
      PAGE_SIZE,
      (page - 1) * PAGE_SIZE,
    ));
  } catch (err) {
    error = (err as Error).message;
  }

  const link = (over: Partial<Params>) => {
    const params = new URLSearchParams(Object.entries({ ...searchParams, page: undefined, ...over }).filter(([, v]) => v) as [string, string][]);
    const qs = params.toString();
    return qs ? `/plans?${qs}` : "/plans";
  };
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const filtered = Boolean(searchParams.q || type || subject || level || rating);
  const chip = (active: boolean) =>
    `inline-flex min-h-[44px] items-center rounded-full px-3.5 no-underline ${active ? "border border-ink bg-ink font-bold text-white hover:text-white" : "border border-line-strong bg-white text-ink hover:bg-mist hover:text-ink"}`;

  return (
    <Page
      title="Your library"
      actions={
        <a href="/plan" className="btn-primary">
          <Icon d={ICONS.plus} size={18} strokeWidth={2.2} />
          Create new
        </a>
      }
    >
      <div className="flex flex-col gap-6">
        <form role="search" className="flex flex-wrap items-center gap-2.5" action="/plans">
          {type && <input type="hidden" name="type" value={type} />}
          <label className="flex min-h-[48px] flex-[1_1_320px] items-center gap-2.5 rounded-xl border border-line-strong bg-white px-3.5">
            <Icon d={ICONS.search} className="text-ink-muted" />
            <span className="sr-only">Search</span>
            <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search titles and ideas" className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
          <button className="btn-outline">Search</button>
          <details className="relative">
            <summary className="btn-outline cursor-pointer list-none [&::-webkit-details-marker]:hidden">More filters{subject || level || rating ? " •" : ""}</summary>
            <div className="absolute right-0 z-10 mt-2 flex w-72 flex-col gap-3 rounded-xl border border-line bg-white p-4 shadow-[0_8px_24px_rgba(23,32,42,0.12)]">
              <label className="label">Subject
                <select name="subject" defaultValue={subject ?? ""} className="field font-normal">
                  <option value="">Any subject</option>
                  {index?.subjects.map((s) => <option key={s.slug} value={s.slug}>{s.subject}</option>)}
                </select>
              </label>
              <label className="label">Year level
                <select name="level" defaultValue={level ?? ""} className="field font-normal">
                  <option value="">Any year</option>
                  {PRIMARY_LEVELS.map((l) => <option key={l} value={l}>{YEAR_LABELS[l]}</option>)}
                </select>
              </label>
              <label className="label">Your rating
                <select name="rating" defaultValue={rating ?? ""} className="field font-normal">
                  <option value="">Any</option>
                  <option value="up">Useful</option>
                  <option value="down">Not useful</option>
                  <option value="none">Not rated</option>
                </select>
              </label>
              <button className="btn-primary">Apply</button>
            </div>
          </details>
        </form>

        <nav aria-label="Filter by type" className="flex flex-wrap gap-1.5">
          <a href={link({ type: undefined })} aria-current={!type ? "page" : undefined} className={chip(!type)}>All</a>
          {OUTPUT_TYPES.map((t) => (
            <a key={t} href={link({ type: t })} aria-current={type === t ? "page" : undefined} className={chip(type === t)}>
              {OUTPUT_UI[t].label}
            </a>
          ))}
        </nav>

        {error && <Notice tone="error">Could not load your library: {error}</Notice>}

        {!error && items.length === 0 ? (
          <div className="card flex flex-col items-start gap-3 p-8">
            <p className="m-0 font-display text-2xl font-bold">{filtered ? "Nothing matches" : "Nothing saved yet"}</p>
            <p className="m-0 text-ink-soft">{filtered ? "Try a different word or clear the filters." : "Everything you create is saved here automatically."}</p>
            <a href={filtered ? "/plans" : "/plan"} className="btn-outline">{filtered ? "Clear filters" : "Create something"}</a>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="eyebrow text-left text-ink-muted">
                  <th scope="col" className="px-5 py-3.5">Title</th>
                  <th scope="col" className="px-3 py-3.5">Type</th>
                  <th scope="col" className="px-3 py-3.5">Class</th>
                  <th scope="col" className="px-3 py-3.5">Made</th>
                  <th scope="col" className="px-5 py-3.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-line">
                    <td className="px-5 py-4">
                      <a href={`/plans/${it.id}`} className="font-bold text-ink no-underline hover:text-euc hover:underline">{it.title}</a>
                      {it.rating === 1 && <span className="ml-2 align-middle text-euc" title="You marked this useful"><Icon d={ICONS.up} size={16} /><span className="sr-only">Rated useful</span></span>}
                      {it.rating === -1 && <span className="ml-2 align-middle text-alert" title="You marked this not useful"><Icon d={ICONS.down} size={16} /><span className="sr-only">Rated not useful</span></span>}
                    </td>
                    <td className="px-3 py-4">
                      {isOutputType(it.output_type) ? <span className={`pill ${OUTPUT_UI[it.output_type].pill}`}>{OUTPUT_UI[it.output_type].label}</span> : it.output_type}
                    </td>
                    <td className="px-3 py-4 text-ink-soft">{YEAR_LABELS[it.level as PrimaryLevel]} · {subjectName(it.subject_slug)}</td>
                    <td className="px-3 py-4 text-ink-soft">{when(it.created_at)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <a href={`/plan?from=${it.id}`} className="mr-3 font-bold">Use again</a>
                      <DeleteButton url={`/api/generations/${it.id}`} label="Delete" confirmText={`Delete "${it.title}"? This can't be undone.`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-[15px] text-ink-muted">
          <span>{count} item{count === 1 ? "" : "s"}</span>
          {pages > 1 && (
            <>
              {page > 1 && <a href={link({ page: String(page - 1) })}>← Newer</a>}
              <span>Page {page} of {pages}</span>
              {page < pages && <a href={link({ page: String(page + 1) })}>Older →</a>}
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
