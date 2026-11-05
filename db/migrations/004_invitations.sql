-- Invitations sent by a super admin. The invite link carries a random token; only its SHA-256
-- hash is stored. One open invitation per email: sending again replaces the token.
create table invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text,
  token_hash text not null unique,
  invited_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  send_count int not null default 0,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz
);
create unique index invitations_open_email_key on invitations (lower(email)) where accepted_at is null and revoked_at is null;
create index invitations_created_idx on invitations (created_at desc);
