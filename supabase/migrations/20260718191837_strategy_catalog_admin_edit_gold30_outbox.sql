alter table public.broker_connections
  add column if not exists requested_strategy_code text,
  add column if not exists requested_symbol text,
  add column if not exists requested_timeframe text;

update public.broker_connections connection
set requested_strategy_code = coalesce((
      select binding.strategy_code
      from public.broker_strategy_bindings binding
      where binding.connection_id = connection.id
      order by binding.enabled desc, binding.created_at
      limit 1
    ), 'ALGOTREND_BTC_1H'),
    requested_symbol = coalesce((
      select binding.symbol
      from public.broker_strategy_bindings binding
      where binding.connection_id = connection.id
      order by binding.enabled desc, binding.created_at
      limit 1
    ), 'BTC-USDT'),
    requested_timeframe = coalesce((
      select binding.timeframe
      from public.broker_strategy_bindings binding
      where binding.connection_id = connection.id
      order by binding.enabled desc, binding.created_at
      limit 1
    ), '1h')
where requested_strategy_code is null
   or requested_symbol is null
   or requested_timeframe is null;

alter table public.broker_connections
  alter column requested_strategy_code set default 'ALGOTREND_BTC_1H',
  alter column requested_symbol set default 'BTC-USDT',
  alter column requested_timeframe set default '1h',
  alter column requested_strategy_code set not null,
  alter column requested_symbol set not null,
  alter column requested_timeframe set not null;

alter table public.broker_connections
  add constraint broker_connections_requested_strategy_catalog_check
  check (
    (requested_strategy_code = 'ALGOTREND_BTC_1H'
      and requested_symbol = 'BTC-USDT'
      and requested_timeframe = '1h')
    or
    (requested_strategy_code = 'ALGOTREND_GOLD_30M'
      and requested_symbol = 'NCCOGOLD2USD-USDT'
      and requested_timeframe = '30m')
  );

create or replace function public.prepare_broker_connection_edit(
  target_connection_id uuid,
  expected_user_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  connection_record public.broker_connections%rowtype;
begin
  select * into connection_record
  from public.broker_connections
  where id = target_connection_id
  for update;

  if not found or connection_record.user_id <> expected_user_id then
    raise exception 'connection not found';
  end if;
  if connection_record.status <> 'SUSPENDED' then
    raise exception 'connection must be suspended';
  end if;
  if not exists (
    select 1 from public.broker_risk_policies
    where connection_id = target_connection_id
  ) then
    raise exception 'risk policy is missing';
  end if;

  update public.broker_risk_policies
  set enabled = false,
      version = version + 1,
      updated_at = now()
  where connection_id = target_connection_id;

  update public.broker_strategy_bindings
  set enabled = false,
      updated_at = now()
  where connection_id = target_connection_id;

  update public.broker_connections
  set status = 'PENDING_APPROVAL',
      updated_at = now()
  where id = target_connection_id;

  return 'PENDING_APPROVAL';
end;
$$;

revoke all on function public.prepare_broker_connection_edit(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_broker_connection_edit(uuid, uuid)
  to service_role;

create or replace function public.request_broker_risk_change(
  target_connection_id uuid,
  expected_user_id uuid,
  proposal_sizing_mode text,
  proposal_declared_capital_usd numeric,
  proposal_risk_profile text,
  proposal_exposure_per_order_pct numeric,
  proposal_max_total_exposure_pct numeric,
  proposal_daily_loss_limit_pct numeric,
  proposal_margin_reserve_pct numeric,
  proposal_notional_per_order_usd numeric,
  proposal_max_total_exposure_usd numeric,
  proposal_daily_loss_limit_usd numeric,
  proposal_min_available_margin_usd numeric
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  connection_record public.broker_connections%rowtype;
begin
  select * into connection_record
  from public.broker_connections
  where id = target_connection_id
  for update;

  if not found or connection_record.user_id <> expected_user_id then
    raise exception 'connection not found';
  end if;
  if connection_record.status <> 'SUSPENDED' then
    raise exception 'connection must be suspended';
  end if;
  if proposal_sizing_mode not in ('FIXED_NOTIONAL', 'EQUITY_PERCENT')
     or proposal_declared_capital_usd < 100
     or proposal_risk_profile not in ('ULTRA_CONSERVATIVE', 'CONSERVATIVE', 'MODERATE')
     or proposal_exposure_per_order_pct < 1
     or proposal_exposure_per_order_pct > 20 then
    raise exception 'invalid risk proposal';
  end if;

  update public.broker_risk_policies
  set enabled = false,
      sizing_mode = proposal_sizing_mode,
      fixed_notional_usd = 0,
      max_notional_per_order_usd = 0,
      max_total_exposure_usd = 0,
      max_open_positions = 0,
      max_orders_per_minute = 0,
      daily_loss_limit_usd = 0,
      min_available_margin_usd = 0,
      declared_capital_usd = proposal_declared_capital_usd,
      risk_profile = proposal_risk_profile,
      exposure_per_order_pct = proposal_exposure_per_order_pct,
      max_total_exposure_pct = proposal_max_total_exposure_pct,
      daily_loss_limit_pct = proposal_daily_loss_limit_pct,
      margin_reserve_pct = proposal_margin_reserve_pct,
      suggested_notional_per_order_usd = proposal_notional_per_order_usd,
      suggested_max_total_exposure_usd = proposal_max_total_exposure_usd,
      suggested_daily_loss_limit_usd = proposal_daily_loss_limit_usd,
      suggested_min_available_margin_usd = proposal_min_available_margin_usd,
      version = version + 1,
      updated_at = now()
  where connection_id = target_connection_id;

  if not found then
    raise exception 'risk policy is missing';
  end if;

  update public.broker_strategy_bindings
  set enabled = false,
      updated_at = now()
  where connection_id = target_connection_id;

  update public.broker_connections
  set status = 'PENDING_APPROVAL',
      updated_at = now()
  where id = target_connection_id;

  return 'PENDING_APPROVAL';
end;
$$;

revoke all on function public.request_broker_risk_change(
  uuid, uuid, text, numeric, text, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.request_broker_risk_change(
  uuid, uuid, text, numeric, text, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric
) to service_role;

create or replace function public.approve_broker_connection(
  target_connection_id uuid,
  actor_user_id uuid,
  policy_allowed_symbols text[],
  policy_sizing_mode text,
  policy_exposure_per_order_pct numeric,
  policy_fixed_notional_usd numeric,
  policy_max_notional_per_order_usd numeric,
  policy_max_total_exposure_usd numeric,
  policy_max_leverage numeric,
  policy_max_open_positions integer,
  policy_max_orders_per_minute integer,
  policy_daily_loss_limit_usd numeric,
  policy_min_available_margin_usd numeric,
  binding_strategy_code text,
  binding_symbol text,
  binding_timeframe text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  connection_record public.broker_connections%rowtype;
  risk_record public.broker_risk_policies%rowtype;
begin
  select * into connection_record
  from public.broker_connections
  where id = target_connection_id
  for update;

  if not found or connection_record.status <> 'PENDING_APPROVAL' or connection_record.validated_at is null then
    raise exception 'connection is not ready for approval';
  end if;
  if not exists (
    select 1 from public.broker_memberships membership
    where membership.user_id = connection_record.user_id and membership.status = 'ACTIVE'
  ) then
    raise exception 'broker membership is not active';
  end if;

  if binding_strategy_code <> connection_record.requested_strategy_code
     or upper(binding_symbol) <> connection_record.requested_symbol
     or binding_timeframe <> connection_record.requested_timeframe
     or cardinality(policy_allowed_symbols) <> 1
     or upper(policy_allowed_symbols[1]) <> connection_record.requested_symbol then
    raise exception 'binding does not match the requested strategy';
  end if;

  select * into risk_record
  from public.broker_risk_policies
  where connection_id = target_connection_id
  for update;

  if not found or risk_record.declared_capital_usd <= 0 then
    raise exception 'risk proposal is missing';
  end if;
  if not coalesce((connection_record.permissions_confirmed->>'read')::boolean, false)
     or not coalesce((connection_record.permissions_confirmed->>'perpetualTrading')::boolean, false) then
    raise exception 'required broker permissions are not confirmed';
  end if;
  if policy_sizing_mode not in ('FIXED_NOTIONAL', 'EQUITY_PERCENT')
     or policy_exposure_per_order_pct < 1
     or policy_exposure_per_order_pct > 20
     or policy_fixed_notional_usd <= 0
     or policy_max_notional_per_order_usd < policy_fixed_notional_usd
     or policy_max_total_exposure_usd < policy_fixed_notional_usd
     or policy_max_leverage < 1
     or policy_max_open_positions < 1
     or policy_max_orders_per_minute < 1
     or policy_daily_loss_limit_usd <= 0
     or policy_min_available_margin_usd < 0
     or policy_min_available_margin_usd > risk_record.declared_capital_usd then
    raise exception 'invalid risk policy';
  end if;
  if policy_sizing_mode <> risk_record.sizing_mode
     or policy_exposure_per_order_pct > risk_record.exposure_per_order_pct
     or policy_fixed_notional_usd > risk_record.suggested_notional_per_order_usd
     or policy_max_notional_per_order_usd > risk_record.suggested_notional_per_order_usd
     or policy_max_total_exposure_usd > risk_record.suggested_max_total_exposure_usd
     or policy_daily_loss_limit_usd > risk_record.suggested_daily_loss_limit_usd
     or policy_min_available_margin_usd < risk_record.suggested_min_available_margin_usd then
    raise exception 'approved policy exceeds the user risk proposal';
  end if;

  update public.broker_risk_policies
  set enabled = true,
      allowed_symbols = array[connection_record.requested_symbol],
      sizing_mode = policy_sizing_mode,
      exposure_per_order_pct = policy_exposure_per_order_pct,
      fixed_notional_usd = policy_fixed_notional_usd,
      max_notional_per_order_usd = policy_max_notional_per_order_usd,
      max_total_exposure_usd = policy_max_total_exposure_usd,
      max_leverage = policy_max_leverage,
      max_open_positions = policy_max_open_positions,
      max_orders_per_minute = policy_max_orders_per_minute,
      daily_loss_limit_usd = policy_daily_loss_limit_usd,
      min_available_margin_usd = policy_min_available_margin_usd,
      max_total_exposure_pct = least(
        risk_record.max_total_exposure_pct,
        policy_max_total_exposure_usd / risk_record.declared_capital_usd * 100
      ),
      daily_loss_limit_pct = least(
        risk_record.daily_loss_limit_pct,
        policy_daily_loss_limit_usd / risk_record.declared_capital_usd * 100
      ),
      margin_reserve_pct = greatest(
        risk_record.margin_reserve_pct,
        policy_min_available_margin_usd / risk_record.declared_capital_usd * 100
      ),
      version = version + 1,
      updated_at = now()
  where connection_id = target_connection_id;

  update public.broker_strategy_bindings
  set enabled = false,
      updated_at = now()
  where connection_id = target_connection_id;

  insert into public.broker_strategy_bindings (
    connection_id, strategy_code, symbol, timeframe, enabled
  ) values (
    target_connection_id,
    connection_record.requested_strategy_code,
    connection_record.requested_symbol,
    connection_record.requested_timeframe,
    true
  )
  on conflict (connection_id, strategy_code, symbol, timeframe)
  do update set enabled = true, updated_at = now();

  update public.broker_connections
  set status = 'ACTIVE',
      approved_at = now(),
      approved_by = actor_user_id,
      last_error_code = null,
      updated_at = now()
  where id = target_connection_id;
end;
$$;

revoke all on function public.approve_broker_connection(
  uuid, uuid, text[], text, numeric, numeric, numeric, numeric, numeric,
  integer, integer, numeric, numeric, text, text, text
) from public, anon, authenticated;
grant execute on function public.approve_broker_connection(
  uuid, uuid, text[], text, numeric, numeric, numeric, numeric, numeric,
  integer, integer, numeric, numeric, text, text, text
) to service_role;

create table public.gold30_broker_outbox (
  id bigint generated by default as identity primary key,
  trade_id integer not null references public.gold30_trades(id) on delete cascade,
  action text not null check (action in ('OPEN', 'CLOSE')),
  direction text not null check (direction in ('LONG', 'SHORT')),
  signal_time bigint not null,
  reference_price numeric(24, 10) not null check (reference_price > 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trade_id, action)
);

alter table public.gold30_broker_outbox enable row level security;
revoke all on table public.gold30_broker_outbox from anon, authenticated;
grant all on table public.gold30_broker_outbox to service_role;
grant usage, select on sequence public.gold30_broker_outbox_id_seq to service_role;

create index gold30_broker_outbox_pending_idx
  on public.gold30_broker_outbox (next_attempt_at, id)
  where status = 'PENDING';

create or replace function public.enqueue_gold30_broker_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'OPEN' then
    insert into public.gold30_broker_outbox (
      trade_id, action, direction, signal_time, reference_price
    ) values (
      new.id, 'OPEN', new.direction, new.signal_time, new.open_price
    ) on conflict (trade_id, action) do nothing;
  elsif tg_op = 'UPDATE'
    and old.status = 'OPEN'
    and new.status = 'CLOSED'
    and new.close_time is not null
    and new.close_price is not null then
    insert into public.gold30_broker_outbox (
      trade_id, action, direction, signal_time, reference_price
    ) values (
      new.id, 'CLOSE', new.direction, new.close_time, new.close_price
    ) on conflict (trade_id, action) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.enqueue_gold30_broker_signal()
  from public, anon, authenticated;

drop trigger if exists gold30_broker_outbox_trigger on public.gold30_trades;
create trigger gold30_broker_outbox_trigger
after insert or update of status on public.gold30_trades
for each row execute function public.enqueue_gold30_broker_signal();
