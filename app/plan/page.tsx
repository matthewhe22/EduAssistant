import { PlanForm } from "@/components/PlanForm";
import { getCurriculumIndex } from "@/lib/curriculum";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const index = await getCurriculumIndex();
  if (!index) return <p>The curriculum dataset has not been built yet.</p>;
  const subjects = index.subjects.map(({ slug, subject, learningArea, levels }) => ({ slug, subject, learningArea, levels }));
  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Create teaching materials</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Aligned to the Victorian Curriculum F–10 Version 2.0 and VTLM 2.0. Always review before teaching.
        </p>
      </div>
      <PlanForm subjects={subjects} canSave={isSupabaseConfigured()} />
    </div>
  );
}
