-- Per-teacher AI provider settings (Tenon). The API key is stored encrypted (AES-256-GCM,
-- key derived from the SETTINGS_SECRET env var); only a short hint is kept in clear.
create table user_settings (
  user_id uuid primary key references users (id) on delete cascade,
  api_key_enc text,
  api_key_hint text,
  default_model text,
  updated_at timestamptz not null default now()
);

-- Cheaper models cost fractions of a cent per call: keep six decimal places.
alter table generations alter column cost_usd type numeric(12, 6);
alter table usage_events alter column cost_usd type numeric(12, 6);
