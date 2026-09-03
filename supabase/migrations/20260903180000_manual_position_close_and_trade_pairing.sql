-- Cierre manual de una posición abierta y emparejamiento exacto de apertura/cierre.
--
-- 1. `broker_order_intents.origin` distingue lo que pidió la estrategia de lo que pidió el
--    titular con un botón. Sólo un cierre manual puede asentar en libros una posición que ya
--    no existe en el broker; un cierre automático que no la encuentra sigue fallando ruidoso.
-- 2. `SETTLED_EXTERNALLY` es el estado de ese asiento: la posición se cerró fuera de la
--    plataforma (a mano en el broker, por liquidación, por otra herramienta) y nuestros libros
--    dejan de contarla abierta. No inventa precio de salida ni resultado.
-- 3. `broker_strategy_trade_key` extrae del `external_signal_id` el número de operación que
--    ambos emisores ya incluyen. Sin él, un trade que abre y toca su stop dentro de la misma
--    vela queda con apertura y cierre en el mismo `signal_time`, y `retry_broker_missed_open`
--    lo daba por vivo: reenviarlo abría dinero real que ninguna señal iba a cerrar.

alter table public.broker_order_intents
  add column if not exists origin text not null default 'STRATEGY';

alter table public.broker_order_intents
  drop constraint if exists broker_order_intents_origin_check;
alter table public.broker_order_intents
  add constraint broker_order_intents_origin_check
  check (origin in ('STRATEGY', 'MANUAL'));

alter table public.broker_order_intents
  drop constraint if exists broker_order_intents_status_check;
alter table public.broker_order_intents
  add constraint broker_order_intents_status_check
  check (status in (
    'QUEUED', 'RISK_REJECTED', 'SUBMITTING', 'SUBMITTED', 'PARTIALLY_FILLED',
    'FILLED', 'CANCELED', 'FAILED', 'UNKNOWN', 'MANUAL_INTERVENTION_REQUIRED',
    'SETTLED_EXTERNALLY'
  ));

create or replace function public.broker_strategy_trade_key(signal_id_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when signal_id_text ~* '^.+-(open|close)(-[0-9]+)?$'
      then lower(regexp_replace(signal_id_text, '-(open|close)(-[0-9]+)?$', '', 'i'))
    else null
  end;
$$;

revoke all on function public.broker_strategy_trade_key(text) from public, anon, authenticated;
grant execute on function public.broker_strategy_trade_key(text) to service_role;

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
  open_trade_key text;
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
     or intent_record.origin <> 'STRATEGY'
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

  -- Sólo una apertura cuya operación de estrategia sigue vigente. Cuando el emisor numera la
  -- operación, el cierre de ESA operación la descalifica sin importar su horario: un trade que
  -- abre y toca su stop en la misma vela emite ambos tramos con idéntico `signal_time`.
  open_trade_key := public.broker_strategy_trade_key(signal_record.external_signal_id);

  if open_trade_key is not null then
    if exists (
      select 1
      from public.broker_signals closes
      where closes.strategy_code = signal_record.strategy_code
        and closes.action = 'CLOSE'
        and public.broker_strategy_trade_key(closes.external_signal_id) = open_trade_key
    ) then
      raise exception 'strategy operation is already closed';
    end if;
  -- Sin numeración no se puede distinguir el cierre propio del cierre técnico de un reverso,
  -- así que cuenta cualquier cierre de la misma vela en adelante: ofrecer de menos deja una
  -- operación sin tomar, ofrecer de más abre dinero real sin salida automática.
  elsif exists (
    select 1
    from public.broker_signals closes
    where closes.strategy_code = signal_record.strategy_code
      and closes.symbol = signal_record.symbol
      and closes.timeframe = signal_record.timeframe
      and closes.direction = signal_record.direction
      and closes.action = 'CLOSE'
      and closes.signal_time >= signal_record.signal_time
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

-- Cierre pedido por el titular sobre una posición que ESTA conexión abrió. Crea una señal
-- sintética propia (sin fanout: no toca ninguna otra conexión) y encola el cierre por el mismo
-- camino que un cierre de estrategia, con el mismo control de ownership y `reduceOnly`.
create or replace function public.request_manual_position_close(
  target_connection_id uuid,
  expected_user_id uuid,
  target_symbol text,
  target_direction text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  connection_record public.broker_connections%rowtype;
  policy_record public.broker_risk_policies%rowtype;
  binding_record public.broker_strategy_bindings%rowtype;
  normalized_symbol text := upper(btrim(target_symbol));
  last_settlement_at timestamptz;
  owned_quantity numeric := 0;
  new_signal_id uuid := gen_random_uuid();
  new_intent_id uuid := gen_random_uuid();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  if target_direction not in ('LONG', 'SHORT') then
    raise exception 'invalid direction';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_connection_id::text, 0));

  select *
  into connection_record
  from public.broker_connections connections
  where connections.id = target_connection_id
  for update;

  if not found or connection_record.user_id <> expected_user_id then
    raise exception 'connection not found';
  end if;

  if not exists (
    select 1
    from public.broker_memberships memberships
    where memberships.user_id = expected_user_id
      and memberships.status = 'ACTIVE'
  ) then
    raise exception 'connection is not eligible';
  end if;

  select *
  into policy_record
  from public.broker_risk_policies policies
  where policies.connection_id = target_connection_id;

  if not found then
    raise exception 'risk policy not found';
  end if;

  -- Cerrar es la salida de emergencia del titular: se permite también con la conexión
  -- suspendida, igual que el cierre automático cuando la política lo habilita.
  if connection_record.status not in ('ACTIVE', 'SUSPENDED') then
    raise exception 'connection cannot close positions in its current state';
  end if;

  -- Ownership: sólo lo que esta conexión abrió y todavía no cerró. Un asiento externo previo
  -- borra todo lo anterior a él: esa tenencia ya dejó de ser nuestra.
  select max(intents.updated_at)
  into last_settlement_at
  from public.broker_order_intents intents
  where intents.connection_id = target_connection_id
    and upper(intents.symbol) = normalized_symbol
    and intents.direction = target_direction
    and intents.status = 'SETTLED_EXTERNALLY';

  select coalesce(sum(
    case when orders.reduce_only then -orders.filled_quantity else orders.filled_quantity end
  ), 0)
  into owned_quantity
  from public.broker_orders orders
  where orders.connection_id = target_connection_id
    and upper(orders.symbol) = normalized_symbol
    and orders.position_side = target_direction
    and (last_settlement_at is null or orders.created_at > last_settlement_at);

  if owned_quantity <= 0 then
    raise exception 'no owned position to close';
  end if;

  if exists (
    select 1
    from public.broker_order_intents intents
    where intents.connection_id = target_connection_id
      and upper(intents.symbol) = normalized_symbol
      and intents.status in ('QUEUED', 'SUBMITTING', 'SUBMITTED', 'PARTIALLY_FILLED')
  ) then
    raise exception 'the connection already has an order in flight';
  end if;

  select *
  into binding_record
  from public.broker_strategy_bindings bindings
  where bindings.connection_id = target_connection_id
    and upper(bindings.symbol) = normalized_symbol
  order by bindings.enabled desc
  limit 1;

  if not found then
    raise exception 'no strategy binding for that instrument';
  end if;

  insert into public.broker_signals (
    id, external_signal_id, strategy_code, symbol, timeframe,
    action, direction, signal_time, reference_price, nonce, payload_hash
  ) values (
    new_signal_id,
    'manual-close-' || new_intent_id::text,
    binding_record.strategy_code,
    normalized_symbol,
    binding_record.timeframe,
    'CLOSE',
    target_direction,
    now(),
    null,
    'manual-' || new_signal_id::text,
    md5('manual-close-' || new_intent_id::text)
  );

  insert into public.broker_order_intents (
    id, user_id, connection_id, binding_id, signal_id,
    action, direction, symbol, status, policy_version, client_order_id, origin
  ) values (
    new_intent_id,
    connection_record.user_id,
    target_connection_id,
    binding_record.id,
    new_signal_id,
    'CLOSE',
    target_direction,
    normalized_symbol,
    'QUEUED',
    policy_record.version,
    'gv-m' || replace(new_intent_id::text, '-', ''),
    'MANUAL'
  );

  insert into public.broker_execution_jobs (connection_id, intent_id, job_type)
  values (target_connection_id, new_intent_id, 'EXECUTE_ORDER');

  return new_intent_id;
end;
$$;

revoke all on function public.request_manual_position_close(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.request_manual_position_close(uuid, uuid, text, text)
  to service_role;
