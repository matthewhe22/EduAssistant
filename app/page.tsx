import { getCurriculumIndex } from "@/lib/curriculum";

export default async function Home() {
  const index = await getCurriculumIndex();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Plan lessons for Foundation to Level 6</h1>
      <p className="max-w-2xl text-slate-600 dark:text-slate-300">
        Choose a year level and subject, describe your idea, and EdAssistant will draft a lesson plan, activities or
        teaching materials aligned to the Victorian Curriculum F–10 Version 2.0 and the VTLM 2.0.
      </p>
      <div className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
        <p className="font-medium">Status: Phase 0 (curriculum knowledge base)</p>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          {index
            ? `${index.subjects.length} subjects loaded, ${index.subjects.reduce((n, s) => n + s.contentDescriptionCount, 0)} content descriptions.`
            : "Curriculum dataset not built yet. Run npm run curriculum:scrape."}{" "}
          The generator arrives in Phase 1.
        </p>
      </div>
      <a href="/curriculum" className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-slate-900">
        Browse the curriculum
      </a>
    </div>
  );
}
