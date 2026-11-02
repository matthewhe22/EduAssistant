# Sources and licensing

Retrieved November 2026. Re-check each source at the start of every school year.

| Topic | Source |
|---|---|
| Victorian Curriculum F–10 Version 2.0 (current) | https://f10.vcaa.vic.edu.au/ |
| Same content as plain HTML, by level (used by the scraper) | https://victoriancurriculum.vcaa.vic.edu.au/level3?layout=1&d=M2 |
| Implementation timeline | https://www.vcaa.vic.edu.au/curriculum/foundation-10-version-2/victorian-curriculum-f-10-version-20 |
| Curriculum Programs F–10 policy (reading position, VTLM 2.0 deadlines) | https://www2.education.vic.gov.au/pal/curriculum-programs/policy |
| VTLM 2.0 guidance | https://www2.education.vic.gov.au/pal/victorian-teaching-learning-model/guidance |
| VTLM 2.0 resources (Arc) | https://arc.educationapps.vic.gov.au/learning/sites/vtlmresources |
| Mathematics position statement (Arc) | https://arc.educationapps.vic.gov.au/learning/sites/mathematics-site/alias/maths-position-statement |
| Victorian Lesson Plans (Arc), useful for quality benchmarks | https://arc.educationapps.vic.gov.au/learning/sites/lesson-plans |
| Mathematics Curriculum Companion 2.0 (Arc) | https://arc.educationapps.vic.gov.au/learning/sites/mathematics-curriculum-companion-2 |
| School term dates | https://www.vic.gov.au/school-term-dates-and-holidays-victoria |

## Licensing

Curriculum text is © VCAA. EdAssistant is a **personal, non-commercial** tool, which is consistent
with VCAA's educational-use terms. If the project ever becomes commercial or public, contact VCAA
for permission **before** distributing curriculum text. The scraped dataset should stay in a
private repository.

Arc resources need a Department of Education login and are **not** scraped. They are listed only
so the teacher can follow the links.

## What the dataset contains (and doesn't)

- ✅ For every Version 2.0 subject that has content at Foundation to Level 6: level description,
  achievement standard, and content descriptions (code, strand, sub-strand, verbatim text).
- ❌ **Elaborations.** On VCAA's site these only appear on the client-rendered f10 site. The
  generator will write its own teaching ideas instead. Never present those ideas as official
  VCAA elaborations.
- ❌ Foundation Levels A–D (for students with intellectual disability). These can be added later
  by extending `PRIMARY_LEVELS` and `LEVEL_PATH` in `scripts/curriculum/scrape.ts`.
