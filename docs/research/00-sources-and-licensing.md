# Sources and licensing

Retrieved November 2026. Re-check each source at the start of every school year.

| Topic | Source |
|---|---|
| Victorian Curriculum F–10 Version 2.0 (current) | https://f10.vcaa.vic.edu.au/ |
| **Dataset source**: Download curriculum (CSV export) | https://f10.vcaa.vic.edu.au/download-curriculum |
| Implementation timeline | https://www.vcaa.vic.edu.au/curriculum/foundation-10-version-2/victorian-curriculum-f-10-version-20 |
| Curriculum Programs F–10 policy (reading position, VTLM 2.0 deadlines) | https://www2.education.vic.gov.au/pal/curriculum-programs/policy |
| VTLM 2.0 guidance | https://www2.education.vic.gov.au/pal/victorian-teaching-learning-model/guidance |
| VTLM 2.0 resources (Arc) | https://arc.educationapps.vic.gov.au/learning/sites/vtlmresources |
| Mathematics position statement (Arc) | https://arc.educationapps.vic.gov.au/learning/sites/mathematics-site/alias/maths-position-statement |
| Victorian Lesson Plans (Arc), useful for quality benchmarks | https://arc.educationapps.vic.gov.au/learning/sites/lesson-plans |
| Mathematics Curriculum Companion 2.0 (Arc) | https://arc.educationapps.vic.gov.au/learning/sites/mathematics-curriculum-companion-2 |
| School term dates | https://www.vic.gov.au/school-term-dates-and-holidays-victoria |

## Licensing

Curriculum text is © VCAA. EduAssistant is a **personal, non-commercial** tool, which is consistent
with VCAA's educational-use terms. If the project ever becomes commercial or public, contact VCAA
for permission **before** distributing curriculum text. The scraped dataset should stay in a
private repository.

Arc resources need a Department of Education login and are **not** scraped. They are listed only
so the teacher can follow the links.

## What the dataset contains (and doesn't)

Built by `.github/workflows/curriculum.yml`. The workflow drives VCAA's "Download curriculum" form
with Playwright (all learning areas and capabilities, levels F–6, CSV, "curriculum content").
`scripts/curriculum/import-csv.ts` then converts the export to `data/curriculum/vc2/*.json`.

- ✅ 34 subjects, 1,347 content descriptions and about 7,700 elaborations. For each subject and
  level/band: the achievement standard, plus content descriptions (code, strand, sub-strand,
  verbatim text, VCAA elaborations).
- ✅ Level *bands* are kept as VCAA writes them (see 01-victorian-curriculum-2.md).
- ❌ Level descriptions are not in the CSV export.
- ❌ Not included: Foundation Levels A–D, EAL, Auslan, Victorian Aboriginal Languages and the
  classical languages. They are either not selectable in the export or not part of the F–10
  sequences. Add them later if needed.
- Note: the CSV is plain text, so maths notation (e.g. fractions) may lose formatting.
