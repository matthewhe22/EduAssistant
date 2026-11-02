-- EdAssistant initial schema
-- Individual teacher accounts (Supabase Auth), the Victorian Curriculum 2.0 knowledge base
-- (with pgvector embeddings for retrieval), and saved generations.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Teachers (one row per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  school_name text,
  default_level text check (default_level in ('F','1','2','3','4','5','6')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles: owner can read" on public.profiles for select using (auth.uid() = id);
create policy "profiles: owner can insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: owner can update" on public.profiles for update using (auth.uid() = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Curriculum knowledge base (read-only for teachers; written by the seed script)
-- ---------------------------------------------------------------------------
create table public.curriculum_subjects (
  slug text primary key,
  subject text not null,
  learning_area text not null,
  domain_code text,
  source_url text,
  retrieved_at timestamptz
);

create table public.curriculum_levels (
  subject_slug text not null references public.curriculum_subjects (slug) on delete cascade,
  level text not null check (level in ('F','1','2','3','4','5','6')),
  level_description text not null default '',
  achievement_standard text not null default '',
  primary key (subject_slug, level)
);

create table public.content_descriptions (
  code text primary key,                      -- e.g. VC2M3N01
  subject_slug text not null references public.curriculum_subjects (slug) on delete cascade,
  level text not null check (level in ('F','1','2','3','4','5','6')),
  strand text not null,
  sub_strand text,
  description text not null,
  embedding vector(1024),                     -- filled by the seed script (Phase 1)
  foreign key (subject_slug, level) references public.curriculum_levels (subject_slug, level) on delete cascade
);

create index content_descriptions_subject_level_idx on public.content_descriptions (subject_slug, level);
create index content_descriptions_embedding_idx on public.content_descriptions
  using hnsw (embedding vector_cosine_ops);

alter table public.curriculum_subjects enable row level security;
alter table public.curriculum_levels enable row level security;
alter table public.content_descriptions enable row level security;
create policy "curriculum: signed-in read" on public.curriculum_subjects for select to authenticated using (true);
create policy "curriculum: signed-in read" on public.curriculum_levels for select to authenticated using (true);
create policy "curriculum: signed-in read" on public.content_descriptions for select to authenticated using (true);

-- Semantic search over content descriptions, optionally filtered by subject and level.
create function public.match_content_descriptions(
  query_embedding vector(1024),
  match_count int default 8,
  filter_subject text default null,
  filter_level text default null
) returns table (code text, subject_slug text, level text, strand text, sub_strand text, description text, similarity float)
language sql stable as $$
  select cd.code, cd.subject_slug, cd.level, cd.strand, cd.sub_strand, cd.description,
         1 - (cd.embedding <=> query_embedding) as similarity
  from public.content_descriptions cd
  where cd.embedding is not null
    and (filter_subject is null or cd.subject_slug = filter_subject)
    and (filter_level is null or cd.level = filter_level)
  order by cd.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- Generated materials
-- ---------------------------------------------------------------------------
create type public.output_type as enum (
  'lesson_plan', 'unit_plan', 'activities', 'worksheet', 'rubric', 'assessment', 'differentiation', 'parent_note'
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null,
  level text not null check (level in ('F','1','2','3','4','5','6')),
  subject_slug text not null references public.curriculum_subjects (slug),
  output_type public.output_type not null,
  difficulty text not null check (difficulty in ('below', 'at', 'above', 'mixed')),
  teacher_input jsonb not null,               -- idea, rough plan, lesson length, options
  curriculum_codes text[] not null default '{}',
  content jsonb not null,                     -- structured output (validated with zod)
  model text,
  input_tokens int,
  output_tokens int,
  rating smallint check (rating in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generations_user_created_idx on public.generations (user_id, created_at desc);

alter table public.generations enable row level security;
create policy "generations: owner select" on public.generations for select using (auth.uid() = user_id);
create policy "generations: owner insert" on public.generations for insert with check (auth.uid() = user_id);
create policy "generations: owner update" on public.generations for update using (auth.uid() = user_id);
create policy "generations: owner delete" on public.generations for delete using (auth.uid() = user_id);
