-- Run after the isolated fixture and the additive Bitunix migration.
insert into public.broker_connections values ('bitunix-live', 'BITUNIX', 'LIVE', 'ALGOTREND_BTC_1H');
do $$
begin
  if (select count(*) from public.broker_connections where broker in ('BINGX', 'BINANCE')) <> 3 then
    raise exception 'Existing broker rows changed';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.broker_connections'::regclass) then
    raise exception 'RLS disabled';
  end if;
  if has_table_privilege('anon', 'public.broker_connections', 'INSERT') or has_table_privilege('authenticated', 'public.broker_connections', 'UPDATE') then
    raise exception 'Public write grants were broadened';
  end if;
  begin
    insert into public.broker_connections values ('invalid-demo', 'BITUNIX', 'DEMO', 'ALGOTREND_BTC_1H');
    raise exception 'Bitunix DEMO incorrectly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.broker_connections values ('invalid-strategy', 'BITUNIX', 'LIVE', 'ALGOTREND_GOLD_30M');
    raise exception 'Unverified Bitunix gold contract incorrectly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.broker_connections values ('invalid-broker', 'OTHER', 'LIVE', 'ALGOTREND_BTC_1H');
    raise exception 'Unknown broker incorrectly accepted';
  exception when check_violation then null;
  end;
end;
$$;
set role anon;
do $$ begin
  if (select count(*) from public.broker_connections) <> 0 then
    raise exception 'Anonymous role bypassed RLS';
  end if;
end; $$;
reset role;
set role authenticated;
do $$ begin
  if (select count(*) from public.broker_connections) <> 0 then
    raise exception 'Authenticated role bypassed deny-all RLS';
  end if;
end; $$;
reset role;
select 'BITUNIX_MIGRATION_OK' as result;
