-- Keep the database contract aligned with the user-facing 1-100% allocation
-- control. Approval remains bounded by the user's own proposal and by the
-- absolute USD limits submitted for the connection.

alter table public.broker_risk_policies
  drop constraint if exists broker_risk_policies_exposure_per_order_pct_check;

alter table public.broker_risk_policies
  add constraint broker_risk_policies_exposure_per_order_pct_check
  check (exposure_per_order_pct between 0 and 100);

alter table public.broker_risk_policies
  drop constraint if exists broker_risk_policies_max_total_exposure_pct_check;

alter table public.broker_risk_policies
  add constraint broker_risk_policies_max_total_exposure_pct_check
  check (max_total_exposure_pct between 0 and 100);

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
security definer
set search_path = public
as $$
declare
  connection_record public.broker_connections%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_connection_id::text, 0));

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
  if exists (
    select 1
    from public.broker_execution_jobs jobs
    where jobs.connection_id = target_connection_id
      and jobs.status in ('QUEUED', 'RETRY', 'PROCESSING')
      and jobs.job_type in ('EXECUTE_ORDER', 'RECONCILE_ORDER')
  ) then
    raise exception 'connection has pending execution jobs';
  end if;
  if proposal_sizing_mode not in ('FIXED_NOTIONAL', 'EQUITY_PERCENT')
     or proposal_declared_capital_usd < 100
     or proposal_risk_profile not in ('ULTRA_CONSERVATIVE', 'CONSERVATIVE', 'MODERATE')
     or proposal_exposure_per_order_pct < 1
     or proposal_exposure_per_order_pct > 100
     or proposal_max_total_exposure_pct < proposal_exposure_per_order_pct
     or proposal_max_total_exposure_pct > 100
     or proposal_daily_loss_limit_pct <= 0
     or proposal_margin_reserve_pct < 0
     or proposal_margin_reserve_pct > 100
     or proposal_notional_per_order_usd <= 0
     or proposal_max_total_exposure_usd < proposal_notional_per_order_usd
     or proposal_daily_loss_limit_usd <= 0
     or proposal_min_available_margin_usd < 0
     or proposal_min_available_margin_usd > proposal_declared_capital_usd then
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
security definer
set search_path = public
as $$
declare
  connection_record public.broker_connections%rowtype;
  risk_record public.broker_risk_policies%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_connection_id::text, 0));

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
     or policy_exposure_per_order_pct > 100
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
