import { redirect } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { getCurriculumIndex } from "@/lib/curriculum";
import { LEVEL_LABELS } from "@/lib/curriculum/types";
import { OUTPUTS } from "@/lib/generator/outputs";
import { FormSettingsSchema } from "@/lib/library/settings";
import { pageUser } from "@/lib/auth/page";
import { listTemplates } from "@/lib/data/templates";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const auth = await pageUser("/templates");
  if (!auth) return <p className="text-sm">Templates need a database. Set DATABASE_URL to enable them.</p>;
  const [data, index] = await Promise.all([listTemplates(auth.db, auth.user.id), getCurriculumIndex()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Templates</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Save settings you use often with <strong>Save settings as template</strong> on the Create page, then start from them in one click.
      </p>
      {data.length === 0 && <p className="text-sm text-slate-600">No templates yet.</p>}
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {data.map((t) => {
          const s = FormSettingsSchema.safeParse(t.settings);
          const st = s.success ? s.data : {};
          const summary = [
            st.outputType && OUTPUTS[st.outputType].label,
            st.subjectSlug && (index?.subjects.find((x) => x.slug === st.subjectSlug)?.subject ?? st.subjectSlug),
            st.level && LEVEL_LABELS[st.level],
            st.lessonMinutes && `${st.lessonMinutes} min`,
            st.difficulty && `difficulty: ${st.difficulty}`,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={t.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-slate-500">{summary}</p>
                {st.idea && <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{st.idea}</p>}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <a href={`/plan?template=${t.id}`} className="underline">Use</a>
                <DeleteButton url={`/api/templates/${t.id}`} label="Delete" confirmText={`Delete template "${t.name}"?`} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
