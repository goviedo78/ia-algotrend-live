create index if not exists broker_jobs_connection_pending_idx
  on public.broker_execution_jobs (connection_id, created_at, id)
  where status in ('QUEUED', 'RETRY', 'PROCESSING');

-- Fan out one immutable signal to every eligible account in one transaction.
create or replace function public.fanout_broker_signal(target_signal_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  signal_record public.broker_signals%rowtype;
  accepted_count integer;
begin
  select *
  into signal_record
  from public.broker_signals
  where id = target_signal_id;

  if not found then
    raise exception 'broker signal not found';
  end if;

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

-- Claim only the oldest outstanding job per account so separate runners can
-- execute accounts in parallel without reordering work inside one account.
create or replace function public.claim_broker_execution_jobs(
  worker_id text,
  batch_size integer default 10
)
returns setof public.broker_execution_jobs
language plpgsql
security invoker
set search_path = public
as $$
begin
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
      and not exists (
        select 1
        from public.broker_execution_jobs earlier
        where earlier.connection_id = jobs.connection_id
          and earlier.status in ('QUEUED', 'RETRY', 'PROCESSING')
          and (earlier.created_at, earlier.id) < (jobs.created_at, jobs.id)
      )
    order by
      case jobs.job_type
        when 'EXECUTE_ORDER' then 0
        when 'VALIDATE_CONNECTION' then 1
        else 2
      end,
      jobs.available_at,
      jobs.created_at
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

revoke all on function public.fanout_broker_signal(uuid)
  from public, anon, authenticated;
grant execute on function public.fanout_broker_signal(uuid)
  to service_role;

revoke all on function public.claim_broker_execution_jobs(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_broker_execution_jobs(text, integer)
  to service_role;
