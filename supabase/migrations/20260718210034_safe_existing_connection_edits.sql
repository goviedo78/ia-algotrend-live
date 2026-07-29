-- Serialize signal fanout and risk-policy edits per connection. Editing first
-- pauses new opens while preserving close signals, then transitions the same
-- connection and binding to approval without creating replacement records.

create or replace function public.suspend_broker_connection_for_edit(
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

revoke all on function public.suspend_broker_connection_for_edit(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.suspend_broker_connection_for_edit(uuid, uuid)
  to service_role;

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

create or replace function public.fanout_broker_signal(target_signal_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  signal_record public.broker_signals%rowtype;
  accepted_count integer;
  locked_connection_id uuid;
begin
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

revoke all on function public.fanout_broker_signal(uuid)
  from public, anon, authenticated;
grant execute on function public.fanout_broker_signal(uuid)
  to service_role;
