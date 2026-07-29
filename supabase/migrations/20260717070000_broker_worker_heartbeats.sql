create table public.broker_worker_heartbeats (
  worker_id text primary key check (char_length(worker_id) between 8 and 180),
  egress_ip inet not null,
  release text check (release is null or char_length(release) <= 120),
  execution_enabled boolean not null default false,
  live_execution_enabled boolean not null default false,
  started_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);

create index broker_worker_heartbeat_idx
  on public.broker_worker_heartbeats (heartbeat_at desc);

alter table public.broker_worker_heartbeats enable row level security;

revoke all on table public.broker_worker_heartbeats from anon, authenticated;
grant all privileges on table public.broker_worker_heartbeats to service_role;
