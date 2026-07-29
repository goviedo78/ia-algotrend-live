-- Private, server-only ledger for the dedicated AlgoTrend GOLD 30M BingX connection.
create table public.gold30_direct_executions (
  id uuid primary key default gen_random_uuid(),
  trade_id integer not null references public.gold30_trades(id) on delete restrict,
  action text not null check (action in ('OPEN', 'CLOSE')),
  direction text not null check (direction in ('LONG', 'SHORT')),
  symbol text not null default 'NCCOGOLD2USD-USDT'
    check (symbol = 'NCCOGOLD2USD-USDT'),
  source text not null default 'cron' check (source = 'cron'),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'SUBMITTED', 'FILLED', 'SKIPPED', 'FAILED', 'UNKNOWN')),
  client_order_id text not null,
  broker_order_id text,
  requested_quantity numeric(28, 12) not null check (requested_quantity > 0),
  executed_quantity numeric(28, 12) not null default 0 check (executed_quantity >= 0),
  average_price numeric(28, 12),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_message text,
  raw_status jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  filled_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trade_id, action),
  unique (client_order_id)
);

alter table public.gold30_direct_executions enable row level security;

revoke all on table public.gold30_direct_executions from anon, authenticated;
grant all on table public.gold30_direct_executions to service_role;

create index gold30_direct_executions_recovery_idx
  on public.gold30_direct_executions (status, updated_at)
  where status in ('PENDING', 'SUBMITTED', 'FAILED', 'UNKNOWN');

create index gold30_direct_executions_trade_idx
  on public.gold30_direct_executions (trade_id, action, status);
