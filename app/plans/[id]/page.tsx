import { notFound, redirect } from "next/navigation";
import { LessonPlanView } from "@/components/LessonPlanView";
import { PlanActions } from "@/components/PlanActions";
import { getSubject } from "@/lib/curriculum";
import { LEVEL_LABELS, type PrimaryLevel } from "@/lib/curriculum/types";
import { LessonPlanSchema } from "@/lib/generator/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/plans/${params.id}`);
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();

  const { data: row } = await supabase
    .from("generations")
    .select("id, level, subject_slug, teacher_input, content, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!row) notFound();

  const parsed = LessonPlanSchema.safeParse(row.content?.plan);
  if (!parsed.success) return <p>This plan could not be displayed.</p>;
  const plan = parsed.data;
  const level = row.level as PrimaryLevel;
  const lessonMinutes = Number(row.teacher_input?.lessonMinutes ?? 60);
  const subject = await getSubject(row.subject_slug);
  const codeText: Record<string, string> = {};
  for (const band of subject?.bands ?? []) for (const cd of band.contentDescriptions) codeText[cd.code] = cd.text;
  const warnings: string[] = Array.isArray(row.content?.warnings) ? row.content.warnings : [];

  return (
    <div className="space-y-4">
      <a href="/plans" className="text-sm underline print:hidden">← My plans</a>
      {warnings.length > 0 && (
        <ul className="rounded bg-amber-50 p-3 text-sm text-amber-900 print:hidden dark:bg-amber-950 dark:text-amber-200">
          {warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}
      <PlanActions plan={plan} subjectSlug={row.subject_slug} level={level} lessonMinutes={lessonMinutes} />
      <details className="text-sm text-slate-600 print:hidden dark:text-slate-300">
        <summary className="cursor-pointer">Your original request</summary>
        <p className="mt-2 whitespace-pre-wrap">{String(row.teacher_input?.idea ?? "")}</p>
      </details>
      <LessonPlanView
        plan={plan}
        meta={`${subject?.subject ?? row.subject_slug} · ${LEVEL_LABELS[level]} · ${lessonMinutes} minutes · ${new Date(row.created_at).toLocaleDateString("en-AU")}`}
        codeText={codeText}
      />
    </div>
  );
}
