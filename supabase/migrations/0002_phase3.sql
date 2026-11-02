-- Phase 3: library search, templates, feedback and cost tracking.

-- ---------------------------------------------------------------------------
-- Generations: feedback + full token/cost breakdown
-- ---------------------------------------------------------------------------
alter table public.generations
  add column if not exists feedback_comment text check (char_length(feedback_comment) <= 2000),
  add column if not exists rated_at timestamptz,
  add column if not exists cache_read_tokens int not null default 0,
  add column if not exists cache_write_tokens int not null default 0,
  add column if not exists cost_usd numeric(10, 4) not null default 0;

create index if not exists generations_user_type_idx on public.generations (user_id, output_type);

-- ---------------------------------------------------------------------------
-- Usage log: one row per Claude call (generate or refine), kept even if the
-- generation is deleted, so monthly spend stays accurate.
-- ---------------------------------------------------------------------------
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  generation_id uuid references public.generations (id) on delete set null,
  kind text not null check (kind in ('generate', 'refine')),
  output_type public.output_type not null,
  model text not null,
  input_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_created_idx on public.usage_events (user_id, created_at desc);

alter table public.usage_events enable row level security;
create policy "usage: owner select" on public.usage_events for select using (auth.uid() = user_id);
create policy "usage: owner insert" on public.usage_events for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Templates: saved form settings
-- ---------------------------------------------------------------------------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 100),
  settings jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists templates_user_idx on public.templates (user_id, name);

alter table public.templates enable row level security;
create policy "templates: owner select" on public.templates for select using (auth.uid() = user_id);
create policy "templates: owner insert" on public.templates for insert with check (auth.uid() = user_id);
create policy "templates: owner update" on public.templates for update using (auth.uid() = user_id);
create policy "templates: owner delete" on public.templates for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Monthly budget (optional): generation stops when this month's spend reaches it.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists monthly_budget_usd numeric(10, 2) check (monthly_budget_usd is null or monthly_budget_usd >= 0);

-- Spend since the start of the current month (Melbourne time), for the signed-in teacher.
create or replace function public.month_spend_usd()
returns numeric
language sql stable security invoker as $$
  select coalesce(sum(cost_usd), 0)
  from public.usage_events
  where user_id = auth.uid()
    and created_at >= date_trunc('month', now() at time zone 'Australia/Melbourne') at time zone 'Australia/Melbourne';
$$;
