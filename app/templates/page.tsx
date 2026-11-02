import { DeleteButton } from "@/components/DeleteButton";
import { Notice, Page } from "@/components/Page";
import { pageUser } from "@/lib/auth/page";
import { getCurriculumIndex } from "@/lib/curriculum";
import { listTemplates } from "@/lib/data/templates";
import { FormSettingsSchema } from "@/lib/library/settings";
import { DIFFICULTY_UI, OUTPUT_UI, YEAR_LABELS } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const auth = await pageUser("/templates");
  if (!auth) return <Page title="Templates"><Notice tone="info">Templates need a database. Set DATABASE_URL to enable them.</Notice></Page>;
  const [data, index] = await Promise.all([listTemplates(auth.db, auth.user.id), getCurriculumIndex()]);

  return (
    <Page title="Templates" actions={<a href="/plan" className="btn-primary">Create new</a>}>
      <div className="flex flex-col gap-5">
        <p className="m-0 max-w-[64ch] text-ink-soft">
          Templates remember the settings you use often: year level, subject, type, length and pitch. Save one with{" "}
          <strong>Save these settings as a template</strong> on the Create page.
        </p>
        {data.length === 0 ? (
          <div className="card flex flex-col items-start gap-3 p-8">
            <p className="m-0 font-display text-2xl font-bold">No templates yet</p>
            <p className="m-0 text-ink-soft">Set up the Create page the way you like it, then save it as a template.</p>
            <a href="/plan" className="btn-outline">Go to Create</a>
          </div>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
            {data.map((t) => {
              const s = FormSettingsSchema.safeParse(t.settings);
              const st = s.success ? s.data : {};
              const bits = [
                st.level && YEAR_LABELS[st.level],
                st.subjectSlug && (index?.subjects.find((x) => x.slug === st.subjectSlug)?.subject ?? st.subjectSlug),
                st.lessonMinutes && `${st.lessonMinutes} min`,
                st.difficulty && DIFFICULTY_UI[st.difficulty],
              ].filter(Boolean);
              return (
                <li key={t.id} className="card flex flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {st.outputType && <span className={`pill ${OUTPUT_UI[st.outputType].pill}`}>{OUTPUT_UI[st.outputType].label}</span>}
                    <span className="text-[15px] text-ink-soft">{bits.join(" · ")}</span>
                  </div>
                  <p className="m-0 font-display text-xl font-bold">{t.name}</p>
                  {st.idea && <p className="m-0 line-clamp-2 text-[15px] text-ink-soft">{st.idea}</p>}
                  <div className="mt-auto flex items-center gap-3">
                    <a href={`/plan?template=${t.id}`} className="btn-primary">Use</a>
                    <DeleteButton url={`/api/templates/${t.id}`} label="Delete" confirmText={`Delete template "${t.name}"?`} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Page>
  );
}
