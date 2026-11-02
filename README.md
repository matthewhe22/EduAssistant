# EdAssistant

A lesson planning assistant for **Victorian primary school teachers** (Foundation to Level 6).
A teacher picks a year level and subject, describes an idea or rough plan, and sets the difficulty.
EdAssistant then generates a detailed lesson plan, activities or teaching materials. The output is
aligned to the **Victorian Curriculum F–10 Version 2.0** and the **Victorian Teaching and Learning Model (VTLM 2.0)**.

> Personal, non-commercial project. Curriculum content © Victorian Curriculum and Assessment Authority (VCAA).

## Stack

- Next.js 14 (App Router, TypeScript, Tailwind), hosted on **Render** (`render.yaml`)
- **Supabase**: Auth (individual teacher logins), Postgres + pgvector, Storage
- **Claude** (Anthropic API) for content generation (Phase 1)

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Curriculum knowledge base, research notes, project scaffold, DB schema | ✅ |
| 1 | Generator: year + subject + idea + difficulty → lesson plan with curriculum codes; auth; save; DOCX export | ✅ |
| 2 | Unit plans, worksheets, rubrics, differentiation, uploads, refine one section | |
| 3 | Library/search, templates, cost tracking, feedback loop | |

## How generation works (Phase 1)

1. The teacher picks a **year level, subject, lesson length and difficulty**, and describes an
   idea or rough plan. Optional: focus content descriptions and class context (no names).
2. `/api/generate` loads the subject's level or band from `data/curriculum/vc2`: content
   descriptions, elaborations and the achievement standard. For below / above / mixed difficulty
   it adds the neighbouring band.
3. Claude (`claude-opus-5-5`, structured JSON output, server-side refusal fallback) writes a
   **VTLM 2.0** lesson plan with these sections: learning intention, success criteria, vocabulary,
   phases (daily review → explicit teaching → guided → independent → reflection), differentiation
   (support / extension / EAL/D), assessment and exit ticket. Rules from
   `lib/generator/pedagogy.ts` cover the reading and maths positions. The system prompt and the
   curriculum block are prompt-cached.
4. The plan is validated: curriculum codes that are not in the dataset are removed and flagged,
   and phase timings are checked. It is then saved to the teacher's library (Supabase, RLS) and
   can be exported to Word or printed.

## Repository layout

```
app/                         Next.js routes: /plan (generator), /plans (library), /curriculum, /login, API routes
components/                  Planner form, lesson plan view, export actions
lib/generator/               Request/plan schemas, curriculum context, prompts, Claude call, validation
lib/export/                  Word (.docx) export
lib/supabase/                Server-side Supabase client (auth + RLS)
lib/curriculum/              Types + loaders for the curriculum dataset
data/curriculum/vc2/         Victorian Curriculum 2.0, F–6, one JSON file per subject (generated)
scripts/curriculum/          VCAA export download (Playwright), CSV → JSON import, Supabase seed
supabase/migrations/         Database schema (profiles, curriculum, generations, RLS)
docs/research/               Research notes that will become the generator's prompt context
.github/workflows/           Builds the curriculum dataset on GitHub Actions
```

## Getting started

```bash
npm install
cp .env.example .env.local   # set ANTHROPIC_API_KEY; Supabase is optional
npm run dev                  # http://localhost:3000/plan
```

Without the Supabase variables the app runs in **local mode**: no login, and plans are not saved.

### Supabase (logins and saved plans)

1. Create a Supabase project (region: Sydney).
2. SQL editor: run `supabase/migrations/0001_init.sql`.
3. Authentication → Providers → Email: enabled. For personal use you can turn off
   "Confirm email" to sign in immediately.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then create an account at
   `/login`.
5. Optional: `npm run curriculum:seed` copies the curriculum into Postgres for the planned
   pgvector search. The generator reads the JSON files directly, so this isn't needed yet.

### Curriculum dataset

`data/curriculum/vc2/` holds 34 subjects, 1,347 content descriptions and about 7,700
elaborations for Foundation to Level 6. It is built by `.github/workflows/curriculum.yml`
(Actions → *Build curriculum dataset* → Run workflow), which downloads VCAA's CSV export and
commits the JSON. To run it locally:

```bash
npx playwright install chromium
npm run curriculum:download
unzip -o data/curriculum/raw/vc2-all.zip -d data/curriculum/raw
npm run curriculum:import
npm run curriculum:seed       # loads it into Supabase (needs the service role key)
```

### Database

Apply `supabase/migrations/0001_init.sql` in the Supabase SQL editor, or run `supabase db push`.

### Deploy to Render

New → Blueprint → select this repo. Render reads `render.yaml`. Then set `ANTHROPIC_API_KEY` and
the Supabase variables in the dashboard. In Supabase → Authentication → URL configuration, set the
site URL to the Render URL.

### Tests

```bash
npm test          # parser, generator context/validation, Word export, /api/generate (Claude mocked)
npm run typecheck
```
