-- Earlier versions of a library item, saved before each rewrite or quick fix so it can be undone.
create table generation_versions (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  title text not null,
  content jsonb not null,
  note text,
  created_at timestamptz not null default now()
);
create index generation_versions_lookup on generation_versions (generation_id, created_at desc);
