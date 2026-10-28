-- Private delivery ledger for AlgoTrend only; never part of trade history.
create table public.algotrend_telegram_notices (
  notice_key text primary key,
  kind text not null check (kind in ('PREALERT', 'TRIGGER')),
  state text not null default 'reserved' check (state in ('reserved', 'sent', 'failed', 'unknown', 'expired')),
  payload jsonb not null,
  message_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.algotrend_telegram_notices enable row level security;
revoke all on public.algotrend_telegram_notices from anon, authenticated;
grant all on public.algotrend_telegram_notices to service_role;
-- No public policies: only service_role can reserve and record delivery.
