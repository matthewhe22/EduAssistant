# EduAssistant

A lesson planning assistant for **Victorian primary school teachers** (Foundation to Level 6).
A teacher picks a year level and subject, describes an idea or rough plan, and sets the difficulty.
EduAssistant then generates a detailed lesson plan, activities or teaching materials. The output is
aligned to the **Victorian Curriculum F–10 Version 2.0** and the **Victorian Teaching and Learning Model (VTLM 2.0)**.

> Personal, non-commercial project. Curriculum content © Victorian Curriculum and Assessment Authority (VCAA).

## Stack

- Next.js 14 (App Router, TypeScript, Tailwind), hosted on **Render** (`render.yaml`)
- **PostgreSQL** (Render Postgres): teacher accounts (hashed passwords, httpOnly session cookies), library, templates, usage
- **Tenon** ([mytenon.com](https://mytenon.com)) for generation: one OpenAI-compatible API key for DeepSeek, Claude, Gemini, Qwen and more. Default model: **DeepSeek V4.1 Flash**

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Curriculum knowledge base, research notes, project scaffold, DB schema | ✅ |
| 1 | Generator: year + subject + idea + difficulty → lesson plan with curriculum codes; auth; save; DOCX export | ✅ |
| 2 | Unit plans, worksheets, rubrics, differentiation, uploads, refine one section | ✅ |
| 3 | Library/search, templates, cost tracking, feedback loop | ✅ |

## What teachers can create

| Output | What you get |
|---|---|
| Lesson plan | VTLM 2.0 lesson: intention, success criteria, timed phases, differentiation, exit ticket |
| Unit plan | 3–20 sequenced lessons, big ideas, pre/formative/summative assessment |
| Activities / rotations | 1–8 activities or stations with materials, steps, easier/harder versions |
| Worksheet + answer key | 3–30 questions in sections, writing lines, word bank, model answers |
| Differentiated task | One task in Support / Core / Extension tiers with scaffolds and answers |
| Assessment rubric | Task + 4-level rubric with "Achieving" matching the achievement standard |
| Quiz / assessment | Questions with marks, answers, codes, marking guide and next steps |
| Parent / newsletter note | Family-friendly summary, home activities, conversation starters |

You can also **upload an existing plan** (PDF, Word or text, up to 5 MB) instead of, or as well
as, typing an idea. Once something is generated, you can **refine any single section** with an
instruction ("make the guided practice more hands-on"). Only that section is replaced, and the
change is saved to your library. Everything exports to Word or prints.

## Library, templates, feedback and costs (needs the database)

- **My library** (`/plans`): search titles and ideas; filter by type, subject, level and rating.
  Open, **use again** (pre-fills the Create form with the same settings) or delete.
- **Templates** (`/templates`): on the Create page, **Save settings as template** stores the type,
  subject, level, difficulty, lesson length, counts, class context and focus codes (and the idea
  text if you choose). Start from a template in one click.
- **Feedback**: 👍/👎 and an optional comment on every saved item. The Usage page shows approval
  per output type and recent comments, so you can see which prompts need work.
- **AI provider** (`/usage`): save your own Tenon API key (checked with Tenon, stored encrypted
  with AES-256-GCM using `SETTINGS_SECRET`) and choose your default model from Tenon's live model
  list. Without a personal key the server's `TENON_API_KEY` is used.
- **Usage** (`/usage`): every AI call (generation or refinement) is logged with tokens and
  estimated US$ cost from Tenon's prices (`lib/pricing.ts`). It shows this month's spend, a 30-day chart, cost by type,
  and how much input came from the prompt cache. Set an optional **monthly budget**: once it's
  reached, new generations are paused (HTTP 402) until next month or until you raise it.

## How generation works

1. The teacher picks a **year level, subject, lesson length and difficulty**, and describes an
   idea or rough plan. Optional: focus content descriptions and class context (no names).
2. `/api/generate` loads the subject's level or band from `data/curriculum/vc2`: content
   descriptions, elaborations and the achievement standard. For below / above / mixed difficulty
   it adds the neighbouring band.
3. The teacher's chosen model (default `deepseek-v4.1-flash`) is called through Tenon's
   OpenAI-compatible API (`lib/generator/llm.ts`). The output type's JSON Schema is in the prompt
   (from `lib/generator/outputs/`), JSON mode is on where the model supports it, and the reply is
   validated with zod; an invalid reply gets one automatic repair attempt. Victorian rules (VTLM
   2.0, reading and maths positions) are in `lib/generator/pedagogy.ts`. The stable prefix (system
   prompt, schema, curriculum) comes first so providers can reuse their prompt cache. Uploaded
   PDFs, Word and text files are converted to text on the server, so they work with any model.
4. The output is validated: curriculum codes that are not in the dataset (anywhere in the output)
   are removed and flagged, and lesson timings, quiz marks and rubric tables are checked. It is then saved to the teacher's library (Postgres) and
   can be exported to Word or printed.

## Repository layout

```
app/                         Next.js routes: /plan (create), /plans (library), /curriculum, /login, /api/generate, /api/refine, /api/export/docx
components/                  Planner form, result panel (refine), views for each output type
lib/generator/               Output types (outputs/), curriculum context, prompts, Claude call, uploads, validation
lib/export/                  Word (.docx) export
lib/db, lib/auth, lib/data/  Postgres pool, sessions/passwords, per-teacher queries
lib/curriculum/              Types + loaders for the curriculum dataset
data/curriculum/vc2/         Victorian Curriculum 2.0, F–6, one JSON file per subject (generated)
scripts/curriculum/          VCAA export download (Playwright), CSV → JSON import
scripts/db/migrate.mjs       Migration runner (runs on npm start)
db/migrations/               PostgreSQL schema (users, sessions, generations, usage_events, templates, invitations)
docs/research/               Research notes that will become the generator's prompt context
.github/workflows/           Builds the curriculum dataset on GitHub Actions
```

## Getting started

```bash
npm install
cp .env.example .env.local   # set TENON_API_KEY (or save a key on /usage); DATABASE_URL is optional
npm run dev                  # http://localhost:3000/plan
```

Without `DATABASE_URL` the app runs in **local mode**: no login, and nothing is saved.

### Database (accounts and saved work)

Any PostgreSQL 14+ works. Set `DATABASE_URL`. Migrations in `db/migrations/` run automatically
on `npm start`, or run them yourself with `npm run db:migrate`.

- **Accounts**: email and password (bcrypt), with sessions in an httpOnly cookie. Only a SHA-256
  hash of the session token is stored.
- **Home page:** `/` is a public landing page (animated demo, how it works, FAQ) with search-engine data: title and description, canonical link, share preview, JSON-LD (organisation, website, software, FAQ), `/robots.txt`, `/sitemap.xml` and `/llms.txt`. Set `NEXT_PUBLIC_SITE_URL` to the real address once there is a custom domain. The contact address is in `lib/ui/landing-content.ts`.
- **Super admin:** `matthew.he@outlook.com` (change with `ADMIN_EMAILS`) gets an **Admin** page at `/admin` with totals, every user's usage and spend, and each user's activity (titles and settings only, never the content of their materials or their API keys). Everyone else gets a 404 there.
- **Sign-ups are closed** except for the **first account**, emails listed in `ALLOWED_EMAILS`, and
  people the super admin **invites**. This stops strangers on your public URL from spending your AI credit.
- **Invitations:** on `/admin`, under **Invite people**, enter an email (plus an optional name and note).
  The person gets an email with a sign-up link that works for 14 days, once, and only for that address.
  You can send it again (the old link stops working) or withdraw it. Only a SHA-256 hash of the link
  token is stored. Emails are sent with [Resend](https://resend.com) over HTTPS (Render's free plan
  blocks SMTP): set `RESEND_API_KEY` and `EMAIL_FROM` (a sender on a domain you have verified in
  Resend). Until then, the admin page gives you the link to copy and send yourself.
- Every query is scoped to the signed-in teacher (`lib/data/`).

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
```

### Deploy to Render

`render.yaml` describes the web service (Node, Singapore, `npm ci --include=dev && npm run build`,
`npm start`, health check `/api/health`) and its Postgres database. Use New → Blueprint, or create
them by hand with the same settings. Then:

1. Set `TENON_API_KEY` on the web service, or leave it empty and save a key on the Usage page.
   `SETTINGS_SECRET` is generated by the Blueprint (set it yourself if you create the service by hand).
2. Set `DATABASE_URL` to the database's **Internal Database URL** (Blueprint does this for you).
3. Deploy, open the site, and create your account (the first sign-up).

The free Render Postgres plan expires after 30 days. Upgrade it to keep your data.

### Tests

```bash
npm test          # importer, generator, every output type + Word export, routes, and database tests on
                  # real Postgres (PGlite) covering accounts, saving, search, feedback, budget and isolation
npm run typecheck
```
