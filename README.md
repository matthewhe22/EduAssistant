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
| 0 | Curriculum knowledge base, research notes, project scaffold, DB schema | ✅ this branch |
| 1 | Generator: year + subject + idea + difficulty → lesson plan with curriculum codes; auth; save; DOCX export | next |
| 2 | Unit plans, worksheets, rubrics, differentiation, uploads, refine one section | |
| 3 | Library/search, templates, cost tracking, feedback loop | |

## Repository layout

```
app/                         Next.js routes (home, /curriculum browser, /api/health)
lib/curriculum/              Types + loaders for the curriculum dataset
data/curriculum/vc2/         Victorian Curriculum 2.0, F–6, one JSON file per subject (generated)
scripts/curriculum/          Scraper (parse.ts, scrape.ts) and Supabase seed script
supabase/migrations/         Database schema (profiles, curriculum, generations, RLS)
docs/research/               Research notes that will become the generator's prompt context
.github/workflows/           Builds the curriculum dataset on GitHub Actions
```

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Anthropic keys
npm run dev
```

### Curriculum dataset

`data/curriculum/vc2/` is built by `.github/workflows/curriculum.yml`, which runs the scraper and
commits the result. To run it locally:

```bash
npm run curriculum:discover   # list VCAA domain codes
npm run curriculum:scrape     # writes data/curriculum/vc2/*.json
npm run curriculum:seed       # loads it into Supabase (needs service role key)
```

### Database

Apply `supabase/migrations/0001_init.sql` in the Supabase SQL editor, or run `supabase db push`.

### Deploy to Render

New → Blueprint → select this repo. Render reads `render.yaml`. Then set the secret env vars in the dashboard.
