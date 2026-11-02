import { redirect } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { getCurriculumIndex } from "@/lib/curriculum";
import { LEVEL_LABELS, PRIMARY_LEVELS, type PrimaryLevel } from "@/lib/curriculum/types";
import { OUTPUT_TYPES, OUTPUTS, isOutputType } from "@/lib/generator/outputs";
import { sanitizeSearch } from "@/lib/library/settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; subject?: string; level?: string; rating?: string; page?: string };
}) {
  const supabase = createSupabaseServerClient();
  if (!supabase) return <p className="text-sm">Your library needs Supabase. Set the Supabase env vars to enable it.</p>;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/plans");

  const index = await getCurriculumIndex();
  const subjectName = (slug: string) => index?.subjects.find((s) => s.slug === slug)?.subject ?? slug;
  const q = sanitizeSearch(searchParams.q ?? "");
  const page = Math.max(1, Number(searchParams.page) || 1);

  let query = supabase
    .from("generations")
    .select("id, title, output_type, level, subject_slug, rating, cost_usd, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`title.ilike."*${q}*",teacher_input->>idea.ilike."*${q}*"`);
  if (isOutputType(searchParams.type)) query = query.eq("output_type", searchParams.type);
  if (searchParams.subject && /^[a-z0-9-]+$/.test(searchParams.subject)) query = query.eq("subject_slug", searchParams.subject);
  if ((PRIMARY_LEVELS as readonly string[]).includes(searchParams.level ?? "")) query = query.eq("level", searchParams.level!);
  if (searchParams.rating === "up") query = query.eq("rating", 1);
  if (searchParams.rating === "down") query = query.eq("rating", -1);
  if (searchParams.rating === "none") query = query.is("rating", null);
  const { data: items, error, count } = await query;

  const field = "rounded border px-2 py-1 text-sm dark:bg-slate-900";
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageLink = (n: number) => {
    const params = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]);
    params.set("page", String(n));
    return `/plans?${params}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">My library</h1>
        <div className="flex gap-3 text-sm">
          <a href="/templates" className="rounded border px-4 py-2">Templates</a>
          <a href="/plan" className="rounded bg-slate-900 px-4 py-2 text-white dark:bg-white dark:text-slate-900">Create new</a>
        </div>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search titles and ideas" className={`${field} min-w-56 flex-1`} aria-label="Search" />
        <select name="type" defaultValue={searchParams.type ?? ""} className={field} aria-label="Type">
          <option value="">All types</option>
          {OUTPUT_TYPES.map((t) => <option key={t} value={t}>{OUTPUTS[t].label}</option>)}
        </select>
        <select name="subject" defaultValue={searchParams.subject ?? ""} className={field} aria-label="Subject">
          <option value="">All subjects</option>
          {index?.subjects.map((s) => <option key={s.slug} value={s.slug}>{s.subject}</option>)}
        </select>
        <select name="level" defaultValue={searchParams.level ?? ""} className={field} aria-label="Level">
          <option value="">All levels</option>
          {PRIMARY_LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
        </select>
        <select name="rating" defaultValue={searchParams.rating ?? ""} className={field} aria-label="Rating">
          <option value="">Any rating</option>
          <option value="up">👍 Useful</option>
          <option value="down">👎 Not useful</option>
          <option value="none">Not rated</option>
        </select>
        <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white dark:bg-white dark:text-slate-900">Search</button>
        <a href="/plans" className="self-center text-xs underline">Clear</a>
      </form>

      {error && <p className="text-sm text-red-700">Could not load your library: {error.message}</p>}
      {items && items.length === 0 && <p className="text-sm text-slate-600">Nothing found.</p>}
      <p className="text-xs text-slate-500">{count ?? 0} item{count === 1 ? "" : "s"}</p>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {items?.map((it) => (
          <li key={it.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
            <div>
              <a href={`/plans/${it.id}`} className="font-medium hover:underline">{it.title}</a>
              {it.rating === 1 && <span className="ml-2" aria-label="Rated useful">👍</span>}
              {it.rating === -1 && <span className="ml-2" aria-label="Rated not useful">👎</span>}
              <p className="text-sm text-slate-500">
                {isOutputType(it.output_type) ? OUTPUTS[it.output_type].label : it.output_type} · {subjectName(it.subject_slug)} ·{" "}
                {LEVEL_LABELS[it.level as PrimaryLevel]} · {new Date(it.created_at).toLocaleDateString("en-AU")}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <a href={`/plan?from=${it.id}`} className="underline">Use again</a>
              <DeleteButton url={`/api/generations/${it.id}`} label="Delete" confirmText={`Delete "${it.title}"? This can't be undone.`} />
            </div>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav className="flex gap-3 text-sm">
          {page > 1 && <a className="underline" href={pageLink(page - 1)}>← Newer</a>}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages && <a className="underline" href={pageLink(page + 1)}>Older →</a>}
        </nav>
      )}
    </div>
  );
}
