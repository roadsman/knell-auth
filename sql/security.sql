create table if not exists login_attempts (
  id text primary key default gen_random_uuid()::text,
  email text not null,
  ip_address text not null,
  success boolean not null,
  created_at timestamptz default now()
);

create table if not exists account_locks (
  id text primary key default gen_random_uuid()::text,
  email text unique not null,
  locked_until timestamptz not null,
  reason text,
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id text primary key default gen_random_uuid()::text,
  user_id text references users(id) on delete set null,
  action text not null,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists ip_blocklist (
  id text primary key default gen_random_uuid()::text,
  ip_address text unique not null,
  reason text,
  blocked_until timestamptz,
  created_at timestamptz default now()
);

create index idx_login_attempts_email on login_attempts(email, created_at desc);
create index idx_login_attempts_ip on login_attempts(ip_address, created_at desc);
create index idx_account_locks_email on account_locks(email);
create index idx_audit_logs_user_id on audit_logs(user_id, created_at desc);
create index idx_ip_blocklist_ip on ip_blocklist(ip_address);
