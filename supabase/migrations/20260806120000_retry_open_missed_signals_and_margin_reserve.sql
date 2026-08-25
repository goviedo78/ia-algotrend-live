-- Reserva de margen general: 10% para políticas nuevas y existentes.
-- El motor usa este porcentaje como máximo sobre el margen disponible en vivo y reduce el
-- notional cuando una comisión deja el saldo apenas por debajo del capital declarado.
update public.broker_risk_policies
set margin_reserve_pct = 10,
    min_available_margin_usd = trunc(declared_capital_usd * 0.10, 2),
    suggested_min_available_margin_usd = trunc(declared_capital_usd * 0.10, 2),
    version = version + 1,
    updated_at = now()
where margin_reserve_pct is distinct from 10
   or min_available_margin_usd is distinct from trunc(declared_capital_usd * 0.10, 2)
   or suggested_min_available_margin_usd is distinct from trunc(declared_capital_usd * 0.10, 2);

-- Reencola la MISMA intención rechazada, por lo que conserva signal_id, binding_id y
-- client_order_id. Las señales CLOSE posteriores siguen llegando a la conexión y cierran la
-- posición mediante el flujo normal de ownership.
create or replace function public.retry_broker_missed_open(
  target_intent_id uuid,
  expected_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  intent_record public.broker_order_intents%rowtype;
  signal_record public.broker_signals%rowtype;
  policy_record public.broker_risk_policies%rowtype;
  connection_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  select *
  into intent_record
  from public.broker_order_intents intents
  where intents.id = target_intent_id
  for update;

  if not found or intent_record.user_id <> expected_user_id then
    raise exception 'missed open not found';
  end if;

  select *
  into signal_record
  from public.broker_signals signals
  where signals.id = intent_record.signal_id;

  if not found then
    raise exception 'original signal not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(intent_record.connection_id::text, 0));

  select connections.status
  into connection_status
  from public.broker_connections connections
  where connections.id = intent_record.connection_id;

  if not found or connection_status <> 'ACTIVE' then
    raise exception 'connection is not active';
  end if;

  select *
  into policy_record
  from public.broker_risk_policies policies
  where policies.connection_id = intent_record.connection_id;

  if not found
     or not policy_record.enabled
     or intent_record.action <> 'OPEN'
     or intent_record.status <> 'RISK_REJECTED' then
    raise exception 'missed open is not retryable';
  end if;

  if not exists (
    select 1
    from public.broker_memberships memberships
    where memberships.user_id = expected_user_id
      and memberships.status = 'ACTIVE'
  ) or not exists (
    select 1
    from public.broker_strategy_bindings bindings
    where bindings.id = intent_record.binding_id
      and bindings.connection_id = intent_record.connection_id
      and bindings.enabled = true
  ) then
    raise exception 'connection is not eligible';
  end if;

  -- Sólo una apertura cuya operación de estrategia sigue vigente. Un CLOSE de la misma vela
  -- no cuenta: puede ser el cierre técnico del trade anterior durante un reverso.
  if exists (
    select 1
    from public.broker_signals closes
    where closes.strategy_code = signal_record.strategy_code
      and closes.symbol = signal_record.symbol
      and closes.timeframe = signal_record.timeframe
      and closes.direction = signal_record.direction
      and closes.action = 'CLOSE'
      and closes.signal_time > signal_record.signal_time
  ) then
    raise exception 'strategy operation is already closed';
  end if;

  if exists (
    select 1 from public.broker_orders orders where orders.intent_id = target_intent_id
  ) then
    raise exception 'intent already reached the broker';
  end if;

  if exists (
    select 1
    from public.broker_execution_jobs jobs
    where jobs.connection_id = intent_record.connection_id
      and jobs.status in ('QUEUED', 'RETRY', 'PROCESSING')
      and jobs.intent_id is distinct from target_intent_id
  ) then
    raise exception 'connection has pending execution jobs';
  end if;

  update public.broker_order_intents
  set status = 'QUEUED',
      policy_version = policy_record.version,
      rejection_code = null,
      updated_at = now()
  where id = target_intent_id;

  update public.broker_execution_jobs
  set status = 'QUEUED',
      attempts = 0,
      max_attempts = greatest(max_attempts, 5),
      available_at = now(),
      locked_at = null,
      locked_by = null,
      last_error_code = null,
      updated_at = now()
  where intent_id = target_intent_id
    and job_type = 'EXECUTE_ORDER';

  if not found then
    insert into public.broker_execution_jobs (connection_id, intent_id, job_type)
    values (intent_record.connection_id, target_intent_id, 'EXECUTE_ORDER');
  end if;

  return intent_record.connection_id;
end;
$$;

revoke all on function public.retry_broker_missed_open(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.retry_broker_missed_open(uuid, uuid)
  to service_role;
