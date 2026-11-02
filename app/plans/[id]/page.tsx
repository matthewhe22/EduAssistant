import { notFound, redirect } from "next/navigation";
import { ResultPanel } from "@/components/ResultPanel";
import { getSubject } from "@/lib/curriculum";
import type { PrimaryLevel } from "@/lib/curriculum/types";
import { OUTPUTS, isOutputType } from "@/lib/generator/outputs";
import { DIFFICULTIES } from "@/lib/generator/schema";
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
    .select("id, output_type, level, subject_slug, difficulty, teacher_input, content, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!row || !isOutputType(row.output_type)) notFound();

  // Phase 1 rows stored { plan }, later rows store { output }.
  const parsed = OUTPUTS[row.output_type].schema.safeParse(row.content?.output ?? row.content?.plan);
  if (!parsed.success) return <p>This item could not be displayed.</p>;
  const warnings: string[] = Array.isArray(row.content?.warnings) ? row.content.warnings : [];
  const subject = await getSubject(row.subject_slug);
  const codeText: Record<string, string> = {};
  for (const band of subject?.bands ?? []) for (const cd of band.contentDescriptions) codeText[cd.code] = cd.text;
  const difficulty = (DIFFICULTIES as readonly string[]).includes(row.difficulty) ? row.difficulty : "at";

  return (
    <div className="space-y-4">
      <a href="/plans" className="text-sm underline print:hidden">← My plans</a>
      <details className="text-sm text-slate-600 print:hidden dark:text-slate-300">
        <summary className="cursor-pointer">Your original request</summary>
        <p className="mt-2 whitespace-pre-wrap">{String(row.teacher_input?.idea ?? "")}</p>
        {row.teacher_input?.attachmentName && <p className="mt-1">Uploaded file: {String(row.teacher_input.attachmentName)}</p>}
      </details>
      <ResultPanel
        initial={{ outputType: row.output_type, content: parsed.data, warnings, generationId: row.id }}
        context={{
          subjectSlug: row.subject_slug,
          subjectName: subject?.subject ?? row.subject_slug,
          level: row.level as PrimaryLevel,
          lessonMinutes: Number(row.teacher_input?.lessonMinutes ?? 60),
          difficulty,
        }}
        codeText={codeText}
        extraMeta={new Date(row.created_at).toLocaleDateString("en-AU")}
      />
    </div>
  );
}
