-- Broker execution now runs inside the GONOVI application runtime. Vercel has
-- dynamic outbound IPs, so approval relies on least-privilege permissions
-- instead of requiring a broker IP allowlist confirmation.
create or replace function public.approve_broker_connection(
  target_connection_id uuid,
  actor_user_id uuid,
  policy_allowed_symbols text[],
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
     or policy_fixed_notional_usd <= 0
     or policy_max_notional_per_order_usd < policy_fixed_notional_usd
     or policy_max_total_exposure_usd < policy_fixed_notional_usd
     or policy_max_leverage < 1
     or policy_max_open_positions < 1
     or policy_max_orders_per_minute < 1
     or policy_daily_loss_limit_usd <= 0
     or policy_min_available_margin_usd < 0 then
    raise exception 'invalid risk policy';
  end if;
  if policy_fixed_notional_usd > risk_record.suggested_notional_per_order_usd
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
      fixed_notional_usd = policy_fixed_notional_usd,
      max_notional_per_order_usd = policy_max_notional_per_order_usd,
      max_total_exposure_usd = policy_max_total_exposure_usd,
      max_leverage = policy_max_leverage,
      max_open_positions = policy_max_open_positions,
      max_orders_per_minute = policy_max_orders_per_minute,
      daily_loss_limit_usd = policy_daily_loss_limit_usd,
      min_available_margin_usd = policy_min_available_margin_usd,
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
  uuid, uuid, text[], numeric, numeric, numeric, numeric, integer, integer,
  numeric, numeric, text, text, text
) from public, anon, authenticated;
grant execute on function public.approve_broker_connection(
  uuid, uuid, text[], numeric, numeric, numeric, numeric, integer, integer,
  numeric, numeric, text, text, text
) to service_role;
