create table if not exists oauth_providers (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  access_token text,
  refresh_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(provider, provider_user_id)
);

create table if not exists totp_secrets (
  id text primary key default gen_random_uuid()::text,
  user_id text unique not null references users(id) on delete cascade,
  secret text not null,
  enabled boolean default false,
  backup_codes jsonb,
  created_at timestamptz default now()
);

create table if not exists webauthn_credentials (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  public_key bytea not null,
  counter bigint not null,
  device_type text,
  backed_up boolean default false,
  transports jsonb,
  created_at timestamptz default now(),
  last_used timestamptz
);

create index idx_oauth_providers_user_id on oauth_providers(user_id);
create index idx_oauth_providers_provider on oauth_providers(provider, provider_user_id);
create index idx_webauthn_credentials_user_id on webauthn_credentials(user_id);
