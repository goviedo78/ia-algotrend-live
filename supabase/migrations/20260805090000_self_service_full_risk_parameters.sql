-- El titular configura TODOS sus parámetros de riesgo, no sólo capital, lotaje y corte diario.
--
-- Hasta ahora `request_broker_risk_change` no recibía posiciones simultáneas, órdenes por minuto
-- ni apalancamiento: esos tres sólo los fijaba `approve_broker_connection` en la aprobación
-- inicial y después quedaban congelados. La exposición total y la reserva de margen tampoco
-- eran del titular: se derivaban del perfil. Ahora los seis viajan en la propuesta.
--
-- La firma cambia, así que hay que soltar la anterior: `create or replace` con otra lista de
-- parámetros crearía una sobrecarga y la llamada quedaría ambigua.

drop function if exists public.request_broker_risk_change(
  uuid, uuid, text, numeric, text, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric
);

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
  proposal_min_available_margin_usd numeric,
  proposal_max_open_positions integer,
  proposal_max_orders_per_minute integer,
  proposal_max_leverage numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  connection_record public.broker_connections%rowtype;
  is_already_approved boolean;
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

  if connection_record.status not in ('SUSPENDED', 'PENDING_APPROVAL', 'ACTIVE') then
    raise exception 'connection must be active, suspended or pending approval to edit risk';
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

  -- Coherencia interna, no techos de producto: el titular elige sus números y estas reglas
  -- sólo impiden que una propuesta se auto-bloquee (exposición por debajo de una orden,
  -- reserva por encima del capital, límites en cero que apagarían el motor).
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
     or proposal_min_available_margin_usd > proposal_declared_capital_usd
     or proposal_max_open_positions < 1
     or proposal_max_open_positions > 20
     or proposal_max_orders_per_minute < 1
     or proposal_max_orders_per_minute > 60
     or proposal_max_leverage < 1
     or proposal_max_leverage > 20 then
    raise exception 'invalid risk proposal';
  end if;

  is_already_approved := connection_record.approved_at is not null;

  if is_already_approved then
    update public.broker_risk_policies
    set enabled = true,
        allowed_symbols = array[connection_record.requested_symbol],
        sizing_mode = proposal_sizing_mode,
        fixed_notional_usd = proposal_notional_per_order_usd,
        max_notional_per_order_usd = proposal_notional_per_order_usd,
        max_total_exposure_usd = proposal_max_total_exposure_usd,
        daily_loss_limit_usd = proposal_daily_loss_limit_usd,
        min_available_margin_usd = proposal_min_available_margin_usd,
        max_open_positions = proposal_max_open_positions,
        max_orders_per_minute = proposal_max_orders_per_minute,
        max_leverage = proposal_max_leverage,
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
    set enabled = true,
        updated_at = now()
    where connection_id = target_connection_id;

    update public.broker_connections
    set status = 'ACTIVE',
        last_error_code = null,
        updated_at = now()
    where id = target_connection_id;

    return 'ACTIVE';
  else
    -- Primera vez: la propuesta queda registrada y el motor apagado hasta la aprobación.
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
  end if;
end;
$$;

revoke all on function public.request_broker_risk_change(
  uuid, uuid, text, numeric, text, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, integer, integer, numeric
) from public, anon, authenticated;
grant execute on function public.request_broker_risk_change(
  uuid, uuid, text, numeric, text, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, integer, integer, numeric
) to service_role;
