# Victorian Curriculum F–10 Version 2.0: primary overview

## Status
- Version 2.0 is the curriculum Victorian schools now teach and assess. Full implementation is
  required **from 2026** (VCAA timeline, as of Term 2 2026).
- Structure: **8 learning areas**, **4 capabilities**, **3 foundational skills** (literacy,
  numeracy, digital literacy) and **3 cross-curriculum priorities**.
- Schools must show, through their timetables, how all 8 learning areas are delivered
  (Curriculum Programs F–10 policy).

## Levels and bands
Victoria uses *levels* rather than years. In primary they map one to one: Foundation = Prep,
Level 1 = Year 1 … Level 6 = Year 6. Foundation Levels A–D sit below Foundation for students with
intellectual disability.

**Some subjects are written per level and others per band:**

| Written per level (F, 1, 2 … 6) | Written per band |
|---|---|
| English, Mathematics | Science, History, Geography, Design and Technologies, Digital Technologies, Languages, Critical and Creative Thinking, Ethical Capability, Intercultural Capability: **F–2, 3–4, 5–6** |
| | The Arts (all five), Health and Physical Education, Personal and Social Capability: **F, 1–2, 3–4, 5–6** |
| | Civics and Citizenship: 3–4, 5–6 (starts at Level 3) · Economics and Business: 5–6 only |

A Year 3 Science teacher therefore plans from the **Levels 3 and 4** band. Its achievement
standard describes the end of Level 4, so a Year 3 plan should pitch towards it but not assume
mastery.

Each subject, at each level or band, has:
1. **Content descriptions**: what is taught. Each has a code (see below).
2. **Achievement standard**: what students can do by the end of the level or band. Use it for
   success criteria and rubrics.
3. **Elaborations** (included): non-mandatory examples of teaching ideas, a strong seed for
   activities.
4. Level description: on the VCAA website only, not in the dataset.

### Code format
`VC2` + subject letter(s) + level + strand abbreviation + number. For example:
- `VC2M3N01`: Mathematics, Level 3, Number, item 1
- `VC2E3LA09`: English, Level 3, Language strand

Generated plans must cite only codes that exist in `data/curriculum/vc2`.

## Learning areas taught in primary (F–6)

| Learning area | Subjects (VCAA domains) | Primary notes |
|---|---|---|
| English | English (strands: Language, Literature, Literacy). EAL is a separate curriculum. | F–2 must follow the reading position (see 02-pedagogy). |
| Mathematics | Mathematics (Number, Algebra, Measurement, Space, Statistics, Probability) | Follows the Victorian mathematics position. |
| Science | Science (Science understanding, Science as a human endeavour, Science inquiry) | |
| Humanities | History, Geography from Foundation; **Civics and Citizenship** from Level 3; **Economics and Business** from Level 5 | The scraper records which levels exist for each subject. |
| The Arts | Dance, Drama, Media Arts, Music, Visual Arts | Visual Communication Design starts at Level 7. |
| Technologies | Design and Technologies, Digital Technologies | |
| Health and Physical Education | Health and Physical Education (Personal, social and community health; Movement and physical activity) | |
| Languages | Many languages, e.g. Chinese, Italian, Japanese, Indonesian, French, German, Auslan, Victorian Aboriginal Languages | Most primary schools teach one language. Many languages have F–10 sequences. |

### Capabilities (taught through the learning areas)
Critical and Creative Thinking, Ethical Capability, Intercultural Capability, Personal and Social
Capability. These have their own content descriptions (scraped as the "Capabilities" learning
area) and can be added to a plan as a secondary focus.

### Cross-curriculum priorities
Aboriginal and Torres Strait Islander Histories and Cultures, Asia and Australia's Engagement
with Asia, and Sustainability. Plans can tag these where they fit naturally. Don't force them in.

## How the generator should use this
- Retrieve the content descriptions for the chosen subject and level that best match the
  teacher's idea, plus the achievement standard.
- **Learning intentions** come from the content description. **Success criteria** come from the
  matching part of the achievement standard, written in student language ("I can …").
- Pass the matching **elaborations** as teaching ideas. Rewrite them; don't present them verbatim
  as the plan.
- **Difficulty** controls:
  - *below*: draw scaffolds from the previous level or band.
  - *above*: add extension from the next level or band.
  - *mixed*: produce three tiers (support, core, extension).
- For banded subjects, ask (or default by year) whether this is the first or second year of the
  band, and pitch accordingly.
