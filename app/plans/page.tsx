import { redirect } from "next/navigation";
import { getCurriculumIndex } from "@/lib/curriculum";
import { LEVEL_LABELS, type PrimaryLevel } from "@/lib/curriculum/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return <p className="text-sm">Saving plans needs Supabase. Set the Supabase env vars to enable your library.</p>;
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/plans");

  const [{ data: plans, error }, index] = await Promise.all([
    supabase
      .from("generations")
      .select("id, title, level, subject_slug, difficulty, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    getCurriculumIndex(),
  ]);
  const subjectName = (slug: string) => index?.subjects.find((s) => s.slug === slug)?.subject ?? slug;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My plans</h1>
        <a href="/plan" className="rounded bg-slate-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-slate-900">New plan</a>
      </div>
      {error && <p className="text-sm text-red-700">Could not load your plans: {error.message}</p>}
      {plans && plans.length === 0 && <p className="text-sm text-slate-600">No plans yet.</p>}
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {plans?.map((p) => (
          <li key={p.id} className="py-3">
            <a href={`/plans/${p.id}`} className="font-medium hover:underline">{p.title}</a>
            <p className="text-sm text-slate-500">
              {subjectName(p.subject_slug)} · {LEVEL_LABELS[p.level as PrimaryLevel]} · {new Date(p.created_at).toLocaleDateString("en-AU")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
