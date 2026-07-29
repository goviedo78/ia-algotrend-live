alter table public.broker_risk_policies
  drop constraint if exists broker_risk_policies_sizing_mode_check;

alter table public.broker_risk_policies
  add constraint broker_risk_policies_sizing_mode_check
  check (sizing_mode in ('FIXED_NOTIONAL', 'EQUITY_PERCENT'));

alter table public.broker_risk_policies
  drop constraint if exists broker_risk_policies_exposure_per_order_pct_check;

alter table public.broker_risk_policies
  add constraint broker_risk_policies_exposure_per_order_pct_check
  check (exposure_per_order_pct between 0 and 20);

drop function if exists public.approve_broker_connection(
  uuid, uuid, text[], numeric, numeric, numeric, numeric, integer, integer,
  numeric, numeric, text, text, text
);

create function public.approve_broker_connection(
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
  if cardinality(policy_allowed_symbols) = 0
     or policy_sizing_mode not in ('FIXED_NOTIONAL', 'EQUITY_PERCENT')
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
  if not (upper(binding_symbol) = any(policy_allowed_symbols)) then
    raise exception 'binding symbol is not allowed';
  end if;

  update public.broker_risk_policies
  set enabled = true,
      allowed_symbols = policy_allowed_symbols,
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

  insert into public.broker_strategy_bindings (
    connection_id, strategy_code, symbol, timeframe, enabled
  ) values (
    target_connection_id, binding_strategy_code, upper(binding_symbol), binding_timeframe, true
  )
  on conflict (connection_id, strategy_code, symbol, timeframe)
  do update set enabled = true, updated_at = now();

  update public.broker_connections
  set status = 'ACTIVE', approved_at = now(), approved_by = actor_user_id,
      last_error_code = null, updated_at = now()
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

create function public.get_broker_risk_runtime(target_connection_id uuid)
returns table (
  daily_net_pnl_usd numeric,
  lifetime_net_pnl_usd numeric,
  compound_capital_usd numeric
)
language sql
security invoker
set search_path = public
as $$
  select
    coalesce(sum(ledger.amount_usd) filter (
      where ledger.occurred_at >= date_trunc('day', now())
        and ledger.entry_type in ('REALIZED_PNL', 'FEE')
    ), 0) as daily_net_pnl_usd,
    coalesce(sum(ledger.amount_usd) filter (
      where ledger.entry_type in ('REALIZED_PNL', 'FEE')
    ), 0) as lifetime_net_pnl_usd,
    greatest(
      0,
      policy.declared_capital_usd + coalesce(sum(ledger.amount_usd) filter (
        where ledger.entry_type in ('REALIZED_PNL', 'FEE')
      ), 0)
    ) as compound_capital_usd
  from public.broker_risk_policies policy
  left join public.broker_ledger_entries ledger
    on ledger.connection_id = policy.connection_id
  where policy.connection_id = target_connection_id
  group by policy.declared_capital_usd;
$$;

revoke all on function public.get_broker_risk_runtime(uuid)
  from public, anon, authenticated;
grant execute on function public.get_broker_risk_runtime(uuid)
  to service_role;
