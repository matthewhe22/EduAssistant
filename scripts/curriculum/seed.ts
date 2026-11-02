/**
 * Loads data/curriculum/vc2/*.json into Supabase (curriculum_subjects, curriculum_bands,
 * content_descriptions). Embeddings are added in Phase 1.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run curriculum:seed
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { CurriculumIndex, SubjectCurriculum } from "../../lib/curriculum/types";

const DATA_DIR = path.resolve(__dirname, "../../data/curriculum/vc2");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const index = JSON.parse(await readFile(path.join(DATA_DIR, "index.json"), "utf8")) as CurriculumIndex;
  for (const entry of index.subjects) {
    const s = JSON.parse(await readFile(path.join(DATA_DIR, `${entry.slug}.json`), "utf8")) as SubjectCurriculum;

    const sub = await db.from("curriculum_subjects").upsert({
      slug: s.slug,
      subject: s.subject,
      learning_area: s.learningArea,
      sequence: s.sequence ?? null,
      source_url: s.source,
      retrieved_at: s.retrievedAt,
    });
    if (sub.error) throw sub.error;

    const bands = await db.from("curriculum_bands").upsert(
      s.bands.map((b) => ({
        subject_slug: s.slug,
        band: b.band,
        levels: b.levels,
        achievement_standard: b.achievementStandard,
      })),
    );
    if (bands.error) throw bands.error;

    const cds = await db.from("content_descriptions").upsert(
      s.bands.flatMap((b) =>
        b.contentDescriptions.map((cd) => ({
          code: cd.code,
          subject_slug: s.slug,
          band: b.band,
          levels: b.levels,
          strand: cd.strand,
          sub_strand: cd.subStrand ?? null,
          description: cd.text,
          elaborations: cd.elaborations,
        })),
      ),
    );
    if (cds.error) throw cds.error;
    console.log(`seeded ${s.subject}: ${entry.contentDescriptionCount} content descriptions`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
