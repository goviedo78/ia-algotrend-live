-- Additive catalog change only: preserve all existing BingX accounts, RLS,
-- grants, approval, queue, credentials and risk policies.
begin;
set local lock_timeout = '3s';
alter table public.broker_connections drop constraint broker_connections_broker_check;
alter table public.broker_connections add constraint broker_connections_broker_check
  check (broker in ('BINGX', 'BINANCE', 'BITUNIX')) not valid;
alter table public.broker_connections add constraint broker_connections_bitunix_live_check
  check (broker <> 'BITUNIX' or environment = 'LIVE') not valid;
alter table public.broker_connections add constraint broker_connections_bitunix_strategy_check
  check (broker <> 'BITUNIX' or requested_strategy_code = 'ALGOTREND_BTC_1H') not valid;
commit;

alter table public.broker_connections validate constraint broker_connections_broker_check;
alter table public.broker_connections validate constraint broker_connections_bitunix_live_check;
alter table public.broker_connections validate constraint broker_connections_bitunix_strategy_check;
