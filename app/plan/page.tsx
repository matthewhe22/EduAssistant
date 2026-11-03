import { Page } from "@/components/Page";
import { PlanForm, type TemplateOption } from "@/components/PlanForm";
import { getCurriculumIndex } from "@/lib/curriculum";
import { isUuid } from "@/lib/library/server";
import { FormSettingsSchema, settingsFrom, type FormSettings } from "@/lib/library/settings";
import { DEFAULT_MODEL } from "@/lib/ai/config";
import { labelFor } from "@/lib/ai/models";
import { pageUser } from "@/lib/auth/page";
import { getAiSettings } from "@/lib/data/settings";
import { getGeneration } from "@/lib/data/generations";
import { OUTPUTS, isOutputType } from "@/lib/generator/outputs";
import type { UnitPlan } from "@/lib/generator/schema";
import { lessonIdea, type SourceMaterial } from "@/components/ResultPanel";
import { listTemplates } from "@/lib/data/templates";

export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: { searchParams: { from?: string; template?: string; basedOn?: string; type?: string; lesson?: string } }) {
  const index = await getCurriculumIndex();
  if (!index) return <p>The curriculum dataset has not been built yet.</p>;
  const subjects = index.subjects.map(({ slug, subject, learningArea, levels }) => ({ slug, subject, learningArea, levels }));

  const auth = await pageUser("/plan");
  let templates: TemplateOption[] = [];
  let initial: FormSettings = {};
  let note: string | undefined;
  let source: SourceMaterial | null = null;

  const settings = auth ? await getAiSettings(auth.db, auth.user.id) : null;
  const modelLabel = labelFor(settings?.model || DEFAULT_MODEL);
  const hasKey = Boolean(settings?.apiKey || process.env.TENON_API_KEY);

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
    } else if (searchParams.basedOn && isUuid(searchParams.basedOn)) {
      const row = await getGeneration(auth.db, auth.user.id, searchParams.basedOn);
      const parsed = row && isOutputType(row.output_type) ? OUTPUTS[row.output_type].schema.safeParse(row.content?.output ?? row.content?.plan) : null;
      if (row && parsed?.success && isOutputType(row.output_type)) {
        const type = isOutputType(searchParams.type) ? searchParams.type : "worksheet";
        const content = parsed.data as Record<string, unknown>;
        source = { outputType: row.output_type, title: row.title, content, generationId: row.id };
        const { idea: _idea, focusCodes: _codes, itemCount: _count, ...rest } = settingsFrom(row.teacher_input);
        const lesson = Number(searchParams.lesson);
        initial = { ...rest, outputType: type, idea: row.output_type === "unit_plan" && lesson ? lessonIdea(content as UnitPlan, lesson) : "" };
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
    <Page eyebrow="New material" title="What are you teaching next?">
      <PlanForm subjects={subjects} canSave={Boolean(auth)} initial={initial} initialNote={note} templates={templates} modelLabel={modelLabel} hasKey={hasKey} initialSource={source} />
    </Page>
  );
}
