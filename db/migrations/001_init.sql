-- EdAssistant schema for plain PostgreSQL (Render Postgres).
-- Access control is enforced in the app: every query is scoped by user_id.

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  display_name text,
  monthly_budget_usd numeric(10, 2) check (monthly_budget_usd is null or monthly_budget_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_email_key on users (lower(email));

-- Session tokens are random; only their SHA-256 hash is stored.
create table sessions (
  token_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user_idx on sessions (user_id);
create index sessions_expires_idx on sessions (expires_at);

create type output_type as enum (
  'lesson_plan', 'unit_plan', 'activities', 'worksheet', 'differentiation', 'rubric', 'assessment', 'parent_note'
);

create table generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  title text not null,
  level text not null check (level in ('F','1','2','3','4','5','6')),
  subject_slug text not null,
  output_type output_type not null,
  difficulty text not null check (difficulty in ('below', 'at', 'above', 'mixed')),
  teacher_input jsonb not null,
  curriculum_codes text[] not null default '{}',
  content jsonb not null,
  model text,
  input_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  rating smallint check (rating in (-1, 1)),
  feedback_comment text check (char_length(feedback_comment) <= 2000),
  rated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index generations_user_created_idx on generations (user_id, created_at desc);
create index generations_user_type_idx on generations (user_id, output_type);

-- One row per Claude call; kept when a generation is deleted so monthly spend stays accurate.
create table usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references users (id) on delete cascade,
  generation_id uuid references generations (id) on delete set null,
  kind text not null check (kind in ('generate', 'refine')),
  output_type output_type not null,
  model text not null,
  input_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);
create index usage_events_user_created_idx on usage_events (user_id, created_at desc);

create table templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  settings jsonb not null,
  created_at timestamptz not null default now()
);
create index templates_user_idx on templates (user_id, name);
