import { notFound, redirect } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { Page } from "@/components/Page";
import { ResultPanel } from "@/components/ResultPanel";
import { getSubject } from "@/lib/curriculum";
import type { PrimaryLevel } from "@/lib/curriculum/types";
import { OUTPUTS, isOutputType } from "@/lib/generator/outputs";
import { DIFFICULTIES } from "@/lib/generator/schema";
import { pageUser } from "@/lib/auth/page";
import { countVersions, getGeneration } from "@/lib/data/generations";
import { PRIMARY_LEVELS } from "@/lib/curriculum/types";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({ params }: { params: { id: string } }) {
  const auth = await pageUser(`/plans/${params.id}`);
  if (!auth) notFound();
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const row = await getGeneration(auth.db, auth.user.id, params.id);
  if (!row || !isOutputType(row.output_type)) notFound();

  // Phase 1 rows stored { plan }, later rows store { output }.
  const parsed = OUTPUTS[row.output_type].schema.safeParse(row.content?.output ?? row.content?.plan);
  if (!parsed.success) return <Page><p>This item could not be displayed.</p></Page>;
  const warnings: string[] = Array.isArray(row.content?.warnings) ? row.content.warnings : [];
  const subject = await getSubject(row.subject_slug);
  const codeText: Record<string, string> = {};
  for (const band of subject?.bands ?? []) for (const cd of band.contentDescriptions) codeText[cd.code] = cd.text;
  const versions = await countVersions(auth.db, auth.user.id, row.id);
  const second = String(row.teacher_input?.secondLevel ?? "");
  const secondLevel = (PRIMARY_LEVELS as readonly string[]).includes(second) ? (second as PrimaryLevel) : undefined;
  const basedOn = row.teacher_input?.basedOn as { title?: string; generationId?: string | null } | undefined;
  const difficulty = (DIFFICULTIES as readonly string[]).includes(row.difficulty) ? (row.difficulty as (typeof DIFFICULTIES)[number]) : "at";

  return (
    <Page>
      <div className="flex flex-col gap-4">
        <ResultPanel
          initial={{
            outputType: row.output_type,
            content: parsed.data,
            warnings,
            generationId: row.id,
            feedback: { rating: row.rating === 1 || row.rating === -1 ? (row.rating as 1 | -1) : null, comment: row.feedback_comment ?? "" },
          }}
          context={{
            subjectSlug: row.subject_slug,
            subjectName: subject?.subject ?? row.subject_slug,
            level: row.level as PrimaryLevel,
            secondLevel,
            lessonMinutes: Number(row.teacher_input?.lessonMinutes ?? 60),
            difficulty,
          }}
          codeText={codeText}
          extraMeta={new Date(row.created_at).toLocaleDateString("en-AU")}
          backHref="/plans"
          initialVersions={versions}
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] print:hidden">
          <a href={`/plan?from=${row.id}`} className="font-bold">Make another with these settings</a>
          {basedOn?.title && (
            <span className="text-ink-soft">
              Made to go with{" "}
              {basedOn.generationId ? <a href={`/plans/${basedOn.generationId}`}>“{basedOn.title}”</a> : <>“{basedOn.title}”</>}
            </span>
          )}
          <details className="text-ink-soft">
            <summary className="cursor-pointer">Your original request</summary>
            <p className="mt-2 whitespace-pre-wrap">{String(row.teacher_input?.idea ?? "")}</p>
            {Boolean(row.teacher_input?.attachmentName) && <p className="mt-1">Uploaded file: {String(row.teacher_input?.attachmentName)}</p>}
          </details>
          <span className="flex-auto" />
          <DeleteButton url={`/api/generations/${row.id}`} label="Delete" confirmText={`Delete "${row.title}"? This can't be undone.`} redirectTo="/plans" />
        </div>
      </div>
    </Page>
  );
}
