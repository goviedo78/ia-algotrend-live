-- Regla 4 de AGENTS.md: toda función privilegiada usa SECURITY DEFINER y valida
-- el rol del caller adentro. Nueve funciones de brokers quedaron en SECURITY
-- INVOKER, protegidas sólo por el grant a service_role. Este archivo las iguala
-- al patrón que ya usan retry_broker_missed_open y request_manual_position_close.
--
-- Los cuerpos no cambian. Lo único que se agrega es el guard de rol y el cambio
-- de modo. Las nueve se invocan sólo con createAdminClient (service role), así
-- que el guard no altera ningún camino existente.

create or replace function public.finalize_broker_connection_revocation(
  target_connection_id uuid,
  expected_user_id uuid,
  requested_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  final_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  if requested_status not in ('REVOKED', 'MANUAL_INTERVENTION_REQUIRED') then
    raise exception 'invalid requested connection status';
  end if;

  select status
  into current_status
  from public.broker_connections
  where id = target_connection_id
    and user_id = expected_user_id
  for update;

  if not found then
    return null;
  end if;

  if current_status = 'DELETED' then
    return current_status;
  end if;

  final_status := case
    when current_status in ('REVOKED', 'MANUAL_INTERVENTION_REQUIRED') then current_status
    else requested_status
  end;

  update public.broker_connections
  set status = final_status,
      revoked_at = coalesce(revoked_at, now())
  where id = target_connection_id;

  update public.broker_risk_policies
  set enabled = false
  where connection_id = target_connection_id;

  update public.broker_strategy_bindings
  set enabled = false
  where connection_id = target_connection_id;

  delete from public.broker_credential_envelopes
  where connection_id = target_connection_id;

  return final_status;
end;
$$;

create or replace function public.soft_delete_broker_connection(
  target_connection_id uuid,
  expected_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  select status
  into current_status
  from public.broker_connections
  where id = target_connection_id
    and user_id = expected_user_id
  for update;

  if not found then
    return null;
  end if;

  if current_status = 'DELETED' then
    return current_status;
  end if;

  if current_status not in ('REVOKED', 'REJECTED', 'VALIDATION_FAILED') then
    return current_status;
  end if;

  delete from public.broker_credential_envelopes
  where connection_id = target_connection_id;

  update public.broker_risk_policies
  set enabled = false
  where connection_id = target_connection_id;

  update public.broker_strategy_bindings
  set enabled = false
  where connection_id = target_connection_id;

  update public.broker_connections
  set status = 'DELETED',
      deleted_at = coalesce(deleted_at, now()),
      label = 'deleted-' || target_connection_id::text,
      account_reference = null,
      permissions_confirmed = '{}'::jsonb,
      ip_restriction_confirmed = false
  where id = target_connection_id;

  return 'DELETED';
end;
$$;

create or replace function public.reject_broker_connection(
  target_connection_id uuid,
  expected_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  select status
  into current_status
  from public.broker_connections
  where id = target_connection_id
    and user_id = expected_user_id
  for update;

  if not found then
    return null;
  end if;

  if current_status in ('REJECTED', 'DELETED') then
    return current_status;
  end if;

  if current_status <> 'PENDING_APPROVAL' then
    return current_status;
  end if;

  update public.broker_connections
  set status = 'REJECTED',
      last_error_code = 'ADMIN_REJECTED'
  where id = target_connection_id;

  update public.broker_risk_policies
  set enabled = false
  where connection_id = target_connection_id;

  update public.broker_strategy_bindings
  set enabled = false
  where connection_id = target_connection_id;

  delete from public.broker_credential_envelopes
  where connection_id = target_connection_id;

  return 'REJECTED';
end;
$$;

create or replace function public.suspend_broker_connection_for_edit(
  target_connection_id uuid,
  expected_user_id uuid
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
  if connection_record.status not in ('ACTIVE', 'SUSPENDED') then
    raise exception 'connection cannot be edited';
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

  update public.broker_risk_policies
  set enabled = false,
      updated_at = now()
  where connection_id = target_connection_id;

  if not found then
    raise exception 'risk policy is missing';
  end if;

  update public.broker_connections
  set status = 'SUSPENDED',
      suspended_at = coalesce(suspended_at, now()),
      updated_at = now()
  where id = target_connection_id;

  return 'SUSPENDED';
end;
$$;

create or replace function public.prepare_broker_connection_edit(
  target_connection_id uuid,
  expected_user_id uuid
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

create or replace function public.fanout_broker_signal(target_signal_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  signal_record public.broker_signals%rowtype;
  accepted_count integer;
  locked_connection_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  select *
  into signal_record
  from public.broker_signals
  where id = target_signal_id;

  if not found then
    raise exception 'broker signal not found';
  end if;

  -- Lock candidate accounts in a deterministic order. An edit either finishes
  -- before this signal is evaluated or waits until its jobs are committed.
  for locked_connection_id in
    select distinct binding.connection_id
    from public.broker_strategy_bindings binding
    where binding.strategy_code = signal_record.strategy_code
      and binding.symbol = signal_record.symbol
      and binding.timeframe = signal_record.timeframe
    order by binding.connection_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(locked_connection_id::text, 0));
  end loop;

  with eligible as materialized (
    select
      binding.id as binding_id,
      connection.id as connection_id,
      connection.user_id,
      policy.version as policy_version
    from public.broker_strategy_bindings binding
    join public.broker_connections connection
      on connection.id = binding.connection_id
    join public.broker_risk_policies policy
      on policy.connection_id = connection.id
    join public.broker_memberships membership
      on membership.user_id = connection.user_id
     and membership.status = 'ACTIVE'
    where binding.strategy_code = signal_record.strategy_code
      and binding.symbol = signal_record.symbol
      and binding.timeframe = signal_record.timeframe
      and binding.enabled = true
      and (
        (
          signal_record.action = 'OPEN'
          and connection.status = 'ACTIVE'
          and policy.enabled = true
        )
        or (
          signal_record.action = 'CLOSE'
          and connection.status in ('ACTIVE', 'SUSPENDED')
        )
      )
  ), inserted_intents as (
    insert into public.broker_order_intents (
      id,
      user_id,
      connection_id,
      binding_id,
      signal_id,
      action,
      direction,
      symbol,
      policy_version,
      client_order_id
    )
    select
      gen_random_uuid(),
      eligible.user_id,
      eligible.connection_id,
      eligible.binding_id,
      signal_record.id,
      signal_record.action,
      signal_record.direction,
      signal_record.symbol,
      eligible.policy_version,
      'gv-' || left(encode(digest(eligible.connection_id::text || ':' || signal_record.id::text, 'sha256'), 'hex'), 32)
    from eligible
    on conflict (connection_id, signal_id) do nothing
    returning id, connection_id
  ), executable_intents as (
    select inserted_intents.id, inserted_intents.connection_id
    from inserted_intents
    union
    select intent.id, intent.connection_id
    from public.broker_order_intents intent
    join eligible on eligible.connection_id = intent.connection_id
    where intent.signal_id = signal_record.id
  ), inserted_jobs as (
    insert into public.broker_execution_jobs (connection_id, intent_id, job_type)
    select executable_intents.connection_id, executable_intents.id, 'EXECUTE_ORDER'
    from executable_intents
    on conflict do nothing
    returning connection_id
  )
  select count(distinct eligible.connection_id)::integer
  into accepted_count
  from eligible
  left join inserted_jobs on inserted_jobs.connection_id = eligible.connection_id;

  return accepted_count;
end;
$$;

create or replace function public.claim_broker_execution_jobs(
  worker_id text,
  batch_size integer default 10
)
returns setof public.broker_execution_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  if batch_size < 1 or batch_size > 50 then
    raise exception 'invalid batch size';
  end if;

  update public.broker_execution_jobs
  set status = case when attempts >= max_attempts then 'DEAD_LETTER' else 'RETRY' end,
      available_at = now(),
      locked_at = null,
      locked_by = null,
      last_error_code = 'STALE_WORKER_LOCK',
      updated_at = now()
  where status = 'PROCESSING'
    and locked_at < now() - interval '5 minutes';

  return query
  with candidates as (
    select jobs.id
    from public.broker_execution_jobs jobs
    where jobs.status in ('QUEUED', 'RETRY')
      and jobs.available_at <= now()
      and jobs.attempts < jobs.max_attempts
      -- Sigue habiendo un solo job en vuelo por cuenta; lo que cambia es cuál va primero.
      and not exists (
        select 1
        from public.broker_execution_jobs earlier
        where earlier.connection_id = jobs.connection_id
          and earlier.status in ('QUEUED', 'RETRY', 'PROCESSING')
          and public.broker_job_order_key(earlier) < public.broker_job_order_key(jobs)
      )
    order by
      case jobs.job_type
        when 'EXECUTE_ORDER' then 0
        when 'VALIDATE_CONNECTION' then 1
        else 2
      end,
      jobs.available_at,
      public.broker_job_order_key(jobs)
    for update of jobs skip locked
    limit batch_size
  )
  update public.broker_execution_jobs jobs
  set status = 'PROCESSING',
      attempts = jobs.attempts + 1,
      locked_at = now(),
      locked_by = worker_id,
      updated_at = now()
  from candidates
  where jobs.id = candidates.id
  returning jobs.*;
end;
$$;

create or replace function public.consume_broker_rate_limit(
  p_bucket_key text,
  p_window_seconds integer,
  p_max_hits integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket_start timestamptz;
  current_hits integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  if char_length(p_bucket_key) < 10 or char_length(p_bucket_key) > 180
     or p_window_seconds < 1 or p_window_seconds > 3600
     or p_max_hits < 1 or p_max_hits > 10000 then
    raise exception 'invalid rate limit parameters';
  end if;

  bucket_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.broker_rate_limit_buckets (
    bucket_key, window_start, hits, expires_at
  ) values (
    p_bucket_key,
    bucket_start,
    1,
    bucket_start + make_interval(secs => p_window_seconds * 2)
  )
  on conflict (bucket_key, window_start)
  do update set
    hits = public.broker_rate_limit_buckets.hits + 1,
    expires_at = excluded.expires_at
  returning hits into current_hits;

  if random() < 0.01 then
    delete from public.broker_rate_limit_buckets where expires_at < now();
  end if;

  return current_hits <= p_max_hits;
end;
$$;

-- Pasa de `language sql` a plpgsql: es la única forma de cortar por rol adentro.
-- La consulta es idéntica; los alias del select son etiquetas de salida, no
-- referencias, así que no chocan con los OUT parameters de `returns table`.
create or replace function public.get_broker_risk_runtime(target_connection_id uuid)
returns table (
  daily_net_pnl_usd numeric,
  lifetime_net_pnl_usd numeric,
  compound_capital_usd numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  return query
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
end;
$$;

-- `create or replace` conserva los privilegios existentes, pero los repetimos
-- para que este archivo se lea solo: service_role y nadie más.
revoke all on function public.finalize_broker_connection_revocation(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.finalize_broker_connection_revocation(uuid, uuid, text)
  to service_role;

revoke all on function public.soft_delete_broker_connection(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.soft_delete_broker_connection(uuid, uuid)
  to service_role;

revoke all on function public.reject_broker_connection(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reject_broker_connection(uuid, uuid)
  to service_role;

revoke all on function public.suspend_broker_connection_for_edit(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.suspend_broker_connection_for_edit(uuid, uuid)
  to service_role;

revoke all on function public.prepare_broker_connection_edit(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_broker_connection_edit(uuid, uuid)
  to service_role;

revoke all on function public.fanout_broker_signal(uuid)
  from public, anon, authenticated;
grant execute on function public.fanout_broker_signal(uuid)
  to service_role;

revoke all on function public.claim_broker_execution_jobs(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_broker_execution_jobs(text, integer)
  to service_role;

revoke all on function public.consume_broker_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_broker_rate_limit(text, integer, integer)
  to service_role;

revoke all on function public.get_broker_risk_runtime(uuid)
  from public, anon, authenticated;
grant execute on function public.get_broker_risk_runtime(uuid)
  to service_role;
