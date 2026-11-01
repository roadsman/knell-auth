create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  email text unique not null,
  password_hash text not null,
  verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists user_metadata (
  user_id text primary key references users(id) on delete cascade,
  last_login timestamptz,
  login_count integer default 0,
  last_password_change timestamptz default now(),
  metadata jsonb
);

create table if not exists sessions (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  token text unique not null,
  ip_address text,
  user_agent text,
  device_fingerprint text,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  last_active timestamptz default now()
);

create table if not exists verification_tokens (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  token text unique not null,
  type text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index idx_sessions_token on sessions(token) where expires_at > now();
create index idx_sessions_user_id on sessions(user_id) where expires_at > now();
create index idx_verification_tokens_token on verification_tokens(token) where expires_at > now();
create index idx_users_email on users(email);

create index idx_sessions_expires on sessions(expires_at);
create index idx_verification_expires on verification_tokens(expires_at);
