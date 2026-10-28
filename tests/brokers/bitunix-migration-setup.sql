-- Isolated PostgreSQL fixture, never execute against a production database.
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.broker_connections (
  id text primary key,
  broker text not null check (broker in ('BINGX', 'BINANCE')),
  environment text not null check (environment in ('DEMO', 'LIVE')),
  requested_strategy_code text not null
);
alter table public.broker_connections enable row level security;
grant select on public.broker_connections to anon, authenticated;
grant all on public.broker_connections to service_role;
insert into public.broker_connections values
  ('existing-demo', 'BINGX', 'DEMO', 'ALGOTREND_BTC_1H'),
  ('existing-live', 'BINGX', 'LIVE', 'ALGOTREND_GOLD_30M'),
  ('existing-binance', 'BINANCE', 'LIVE', 'ALGOTREND_BTC_1H');
