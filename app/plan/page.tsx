import { PlanForm, type TemplateOption } from "@/components/PlanForm";
import { getCurriculumIndex } from "@/lib/curriculum";
import { isUuid } from "@/lib/library/server";
import { FormSettingsSchema, settingsFrom, type FormSettings } from "@/lib/library/settings";
import { pageUser } from "@/lib/auth/page";
import { getGeneration } from "@/lib/data/generations";
import { listTemplates } from "@/lib/data/templates";

export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: { searchParams: { from?: string; template?: string } }) {
  const index = await getCurriculumIndex();
  if (!index) return <p>The curriculum dataset has not been built yet.</p>;
  const subjects = index.subjects.map(({ slug, subject, learningArea, levels }) => ({ slug, subject, learningArea, levels }));

  const auth = await pageUser("/plan");
  let templates: TemplateOption[] = [];
  let initial: FormSettings = {};
  let note: string | undefined;

  if (auth) {
    templates = (await listTemplates(auth.db, auth.user.id)).flatMap((t) => {
      const s = FormSettingsSchema.safeParse(t.settings);
      return s.success ? [{ id: t.id, name: t.name, settings: s.data }] : [];
    });

    if (searchParams.template && isUuid(searchParams.template)) {
      const t = templates.find((x) => x.id === searchParams.template);
      if (t) {
        initial = t.settings;
        note = `Loaded template "${t.name}".`;
      }
    } else if (searchParams.from && isUuid(searchParams.from)) {
      const row = await getGeneration(auth.db, auth.user.id, searchParams.from);
      if (row) {
        initial = settingsFrom({ ...row.teacher_input, outputType: row.output_type });
        note = `Settings copied from "${row.title}".`;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Create teaching materials</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Aligned to the Victorian Curriculum F–10 Version 2.0 and VTLM 2.0. Always review before teaching.
        </p>
      </div>
      <PlanForm subjects={subjects} canSave={Boolean(auth)} initial={initial} initialNote={note} templates={templates} />
    </div>
  );
}
