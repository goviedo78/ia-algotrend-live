-- Private, server-only ledger for the original AlgoTrend BTC 1H BingX connection.
create table public.legacy_bingx_executions (
  id uuid primary key default gen_random_uuid(),
  trade_id bigint not null references public.algotrend_trades(id) on delete restrict,
  action text not null check (action in ('OPEN', 'CLOSE')),
  direction text not null check (direction in ('LONG', 'SHORT')),
  symbol text not null default 'BTC-USDT' check (symbol = 'BTC-USDT'),
  source text not null check (source in ('cron', 'webhook', 'signal')),
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

alter table public.legacy_bingx_executions enable row level security;

revoke all on table public.legacy_bingx_executions from anon, authenticated;
grant all on table public.legacy_bingx_executions to service_role;

create index legacy_bingx_executions_recovery_idx
  on public.legacy_bingx_executions (status, updated_at)
  where status in ('PENDING', 'SUBMITTED', 'FAILED', 'UNKNOWN');

create index legacy_bingx_executions_trade_idx
  on public.legacy_bingx_executions (trade_id, action, status);
