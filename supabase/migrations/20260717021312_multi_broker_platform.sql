-- Multi-broker control plane. Local migration only: review before remote apply.
-- Secrets are envelope-encrypted outside Postgres. This table stores ciphertext only.

create extension if not exists pgcrypto;

create table public.broker_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text check (char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.broker_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  broker text not null check (broker in ('BINGX', 'BINANCE')),
  environment text not null check (environment in ('DEMO', 'LIVE')),
  label text not null check (char_length(label) between 1 and 80),
  account_reference text check (char_length(account_reference) <= 160),
  status text not null default 'PENDING_VALIDATION' check (status in (
    'DRAFT', 'PENDING_VALIDATION', 'VALIDATION_FAILED', 'PENDING_APPROVAL',
    'REJECTED', 'ACTIVE', 'SUSPENDED', 'ROTATION_REQUIRED',
    'MANUAL_INTERVENTION_REQUIRED', 'REVOKED', 'DELETED'
  )),
  permissions_confirmed jsonb not null default '{}'::jsonb,
  ip_restriction_confirmed boolean not null default false,
  validated_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  suspended_at timestamptz,
  revoked_at timestamptz,
  deleted_at timestamptz,
  last_health_check_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, broker, environment, label)
);

create table public.broker_credential_envelopes (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.broker_connections(id) on delete cascade,
  ciphertext text not null,
  encrypted_data_key text not null,
  iv text not null,
  auth_tag text not null,
  aad jsonb not null,
  kms_key_id text not null,
  algorithm text not null default 'AES-256-GCM'
    check (algorithm = 'AES-256-GCM'),
  version integer not null default 1 check (version > 0),
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.broker_risk_policies (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.broker_connections(id) on delete cascade,
  enabled boolean not null default false,
  allowed_symbols text[] not null default '{}',
  sizing_mode text not null default 'FIXED_NOTIONAL'
    check (sizing_mode = 'FIXED_NOTIONAL'),
  fixed_notional_usd numeric(18, 8) not null default 0 check (fixed_notional_usd >= 0),
  max_notional_per_order_usd numeric(18, 8) not null default 0 check (max_notional_per_order_usd >= 0),
  max_total_exposure_usd numeric(18, 8) not null default 0 check (max_total_exposure_usd >= 0),
  max_leverage numeric(8, 4) not null default 1 check (max_leverage >= 1),
  max_open_positions integer not null default 0 check (max_open_positions >= 0),
  max_orders_per_minute integer not null default 0 check (max_orders_per_minute >= 0),
  daily_loss_limit_usd numeric(18, 8) not null default 0 check (daily_loss_limit_usd >= 0),
  min_available_margin_usd numeric(18, 8) not null default 0 check (min_available_margin_usd >= 0),
  close_only_when_suspended boolean not null default true,
  declared_capital_usd numeric(18, 8) not null default 0 check (declared_capital_usd >= 0),
  risk_profile text not null default 'CONSERVATIVE'
    check (risk_profile in ('ULTRA_CONSERVATIVE', 'CONSERVATIVE', 'MODERATE')),
  exposure_per_order_pct numeric(8, 4) not null default 0 check (exposure_per_order_pct between 0 and 10),
  max_total_exposure_pct numeric(8, 4) not null default 0 check (max_total_exposure_pct between 0 and 20),
  daily_loss_limit_pct numeric(8, 4) not null default 0 check (daily_loss_limit_pct between 0 and 3),
  margin_reserve_pct numeric(8, 4) not null default 0 check (margin_reserve_pct between 0 and 100),
  suggested_notional_per_order_usd numeric(18, 8) not null default 0 check (suggested_notional_per_order_usd >= 0),
  suggested_max_total_exposure_usd numeric(18, 8) not null default 0 check (suggested_max_total_exposure_usd >= 0),
  suggested_daily_loss_limit_usd numeric(18, 8) not null default 0 check (suggested_daily_loss_limit_usd >= 0),
  suggested_min_available_margin_usd numeric(18, 8) not null default 0 check (suggested_min_available_margin_usd >= 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.broker_strategy_bindings (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.broker_connections(id) on delete cascade,
  strategy_code text not null check (char_length(strategy_code) between 1 and 80),
  symbol text not null check (char_length(symbol) between 1 and 40),
  timeframe text not null check (char_length(timeframe) between 1 and 20),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, strategy_code, symbol, timeframe)
);

create table public.broker_signals (
  id uuid primary key default gen_random_uuid(),
  external_signal_id text not null,
  strategy_code text not null,
  symbol text not null,
  timeframe text not null,
  action text not null check (action in ('OPEN', 'CLOSE')),
  direction text not null check (direction in ('LONG', 'SHORT')),
  signal_time timestamptz not null,
  reference_price numeric(24, 10),
  nonce text not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  unique (strategy_code, external_signal_id),
  unique (nonce)
);

create table public.broker_order_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  connection_id uuid not null references public.broker_connections(id) on delete restrict,
  binding_id uuid not null references public.broker_strategy_bindings(id) on delete restrict,
  signal_id uuid not null references public.broker_signals(id) on delete restrict,
  action text not null check (action in ('OPEN', 'CLOSE')),
  direction text not null check (direction in ('LONG', 'SHORT')),
  symbol text not null,
  status text not null default 'QUEUED' check (status in (
    'QUEUED', 'RISK_REJECTED', 'SUBMITTING', 'SUBMITTED', 'PARTIALLY_FILLED',
    'FILLED', 'CANCELED', 'FAILED', 'UNKNOWN', 'MANUAL_INTERVENTION_REQUIRED'
  )),
  policy_version integer not null,
  rejection_code text,
  client_order_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, signal_id)
);

create table public.broker_execution_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.broker_connections(id) on delete cascade,
  intent_id uuid references public.broker_order_intents(id) on delete cascade,
  job_type text not null check (job_type in ('VALIDATE_CONNECTION', 'EXECUTE_ORDER', 'RECONCILE_ORDER')),
  status text not null default 'QUEUED'
    check (status in ('QUEUED', 'PROCESSING', 'RETRY', 'COMPLETED', 'FAILED', 'DEAD_LETTER')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((job_type = 'VALIDATE_CONNECTION' and intent_id is null) or
         (job_type <> 'VALIDATE_CONNECTION' and intent_id is not null))
);

create table public.broker_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  connection_id uuid not null references public.broker_connections(id) on delete restrict,
  intent_id uuid not null unique references public.broker_order_intents(id) on delete restrict,
  broker_order_id text,
  client_order_id text not null unique,
  symbol text not null,
  side text not null check (side in ('BUY', 'SELL')),
  position_side text not null check (position_side in ('LONG', 'SHORT')),
  reduce_only boolean not null,
  requested_quantity numeric(28, 12) not null check (requested_quantity > 0),
  filled_quantity numeric(28, 12) not null default 0 check (filled_quantity >= 0),
  average_price numeric(24, 10),
  notional_usd numeric(18, 8),
  fee_usd numeric(18, 8) not null default 0,
  status text not null check (status in (
    'NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'UNKNOWN'
  )),
  submitted_at timestamptz,
  reconciled_at timestamptz,
  raw_status jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.broker_fills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid not null references public.broker_orders(id) on delete restrict,
  broker_fill_id text not null,
  quantity numeric(28, 12) not null check (quantity > 0),
  price numeric(24, 10) not null check (price > 0),
  fee numeric(18, 8) not null default 0,
  fee_asset text,
  filled_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (order_id, broker_fill_id)
);

create table public.broker_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  connection_id uuid not null references public.broker_connections(id) on delete restrict,
  order_id uuid references public.broker_orders(id) on delete set null,
  entry_type text not null check (entry_type in ('REALIZED_PNL', 'FEE', 'FUNDING', 'ADJUSTMENT')),
  asset text not null,
  amount numeric(24, 10) not null,
  amount_usd numeric(18, 8),
  external_reference text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (connection_id, entry_type, external_reference)
);

create table public.broker_position_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  connection_id uuid not null references public.broker_connections(id) on delete cascade,
  symbol text not null,
  position_side text not null check (position_side in ('LONG', 'SHORT')),
  quantity numeric(28, 12) not null,
  entry_price numeric(24, 10),
  mark_price numeric(24, 10),
  leverage numeric(8, 4),
  unrealized_pnl_usd numeric(18, 8),
  captured_at timestamptz not null default now()
);

create table public.broker_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  connection_id uuid references public.broker_connections(id) on delete set null,
  event_type text not null,
  outcome text not null check (outcome in ('SUCCESS', 'DENIED', 'FAILED')),
  request_id text,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index broker_connections_user_idx on public.broker_connections(user_id, status);
create index broker_bindings_lookup_idx on public.broker_strategy_bindings(strategy_code, symbol, timeframe) where enabled;
create index broker_signals_received_idx on public.broker_signals(received_at desc);
create index broker_intents_connection_idx on public.broker_order_intents(connection_id, created_at desc);
create index broker_jobs_claim_idx on public.broker_execution_jobs(status, available_at, created_at);
create unique index broker_jobs_intent_type_unique
  on public.broker_execution_jobs(intent_id, job_type)
  where intent_id is not null;
create index broker_orders_user_idx on public.broker_orders(user_id, created_at desc);
create index broker_fills_user_idx on public.broker_fills(user_id, filled_at desc);
create index broker_ledger_user_idx on public.broker_ledger_entries(user_id, occurred_at desc);
create index broker_positions_latest_idx on public.broker_position_snapshots(connection_id, captured_at desc);
create index broker_audit_user_idx on public.broker_audit_events(user_id, created_at desc);

alter table public.broker_memberships enable row level security;
alter table public.broker_connections enable row level security;
alter table public.broker_credential_envelopes enable row level security;
alter table public.broker_risk_policies enable row level security;
alter table public.broker_strategy_bindings enable row level security;
alter table public.broker_signals enable row level security;
alter table public.broker_order_intents enable row level security;
alter table public.broker_execution_jobs enable row level security;
alter table public.broker_orders enable row level security;
alter table public.broker_fills enable row level security;
alter table public.broker_ledger_entries enable row level security;
alter table public.broker_position_snapshots enable row level security;
alter table public.broker_audit_events enable row level security;

-- Authenticated users may only read their own non-secret records with an AAL2 session.
create policy broker_memberships_select_own_aal2 on public.broker_memberships
  for select to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt()->>'aal') = 'aal2');
create policy broker_connections_select_own_aal2 on public.broker_connections
  for select to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt()->>'aal') = 'aal2');
create policy broker_risk_select_own_aal2 on public.broker_risk_policies
  for select to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2' and exists (
    select 1 from public.broker_connections c where c.id = connection_id and c.user_id = (select auth.uid())
  ));
create policy broker_bindings_select_own_aal2 on public.broker_strategy_bindings
  for select to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2' and exists (
    select 1 from public.broker_connections c where c.id = connection_id and c.user_id = (select auth.uid())
  ));
create policy broker_intents_select_own_aal2 on public.broker_order_intents
  for select to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt()->>'aal') = 'aal2');
create policy broker_orders_select_own_aal2 on public.broker_orders
  for select to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt()->>'aal') = 'aal2');
create policy broker_fills_select_own_aal2 on public.broker_fills
  for select to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt()->>'aal') = 'aal2');
create policy broker_ledger_select_own_aal2 on public.broker_ledger_entries
  for select to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt()->>'aal') = 'aal2');
create policy broker_positions_select_own_aal2 on public.broker_position_snapshots
  for select to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt()->>'aal') = 'aal2');
create policy broker_audit_select_own_aal2 on public.broker_audit_events
  for select to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt()->>'aal') = 'aal2');

-- No policy is intentionally created for credential envelopes, signals, or jobs.
revoke all on table public.broker_memberships from anon, authenticated;
revoke all on table public.broker_connections from anon, authenticated;
revoke all on table public.broker_credential_envelopes from anon, authenticated;
revoke all on table public.broker_risk_policies from anon, authenticated;
revoke all on table public.broker_strategy_bindings from anon, authenticated;
revoke all on table public.broker_signals from anon, authenticated;
revoke all on table public.broker_order_intents from anon, authenticated;
revoke all on table public.broker_execution_jobs from anon, authenticated;
revoke all on table public.broker_orders from anon, authenticated;
revoke all on table public.broker_fills from anon, authenticated;
revoke all on table public.broker_ledger_entries from anon, authenticated;
revoke all on table public.broker_position_snapshots from anon, authenticated;
revoke all on table public.broker_audit_events from anon, authenticated;

grant select on table public.broker_memberships to authenticated;
grant select on table public.broker_connections to authenticated;
grant select on table public.broker_risk_policies to authenticated;
grant select on table public.broker_strategy_bindings to authenticated;
grant select on table public.broker_order_intents to authenticated;
grant select on table public.broker_orders to authenticated;
grant select on table public.broker_fills to authenticated;
grant select on table public.broker_ledger_entries to authenticated;
grant select on table public.broker_position_snapshots to authenticated;
grant select on table public.broker_audit_events to authenticated;

grant all privileges on table public.broker_memberships to service_role;
grant all privileges on table public.broker_connections to service_role;
grant all privileges on table public.broker_credential_envelopes to service_role;
grant all privileges on table public.broker_risk_policies to service_role;
grant all privileges on table public.broker_strategy_bindings to service_role;
grant all privileges on table public.broker_signals to service_role;
grant all privileges on table public.broker_order_intents to service_role;
grant all privileges on table public.broker_execution_jobs to service_role;
grant all privileges on table public.broker_orders to service_role;
grant all privileges on table public.broker_fills to service_role;
grant all privileges on table public.broker_ledger_entries to service_role;
grant all privileges on table public.broker_position_snapshots to service_role;
grant all privileges on table public.broker_audit_events to service_role;

create trigger broker_memberships_touch_updated_at before update on public.broker_memberships
  for each row execute function private.touch_updated_at();
create trigger broker_connections_touch_updated_at before update on public.broker_connections
  for each row execute function private.touch_updated_at();
create trigger broker_credentials_touch_updated_at before update on public.broker_credential_envelopes
  for each row execute function private.touch_updated_at();
create trigger broker_risk_touch_updated_at before update on public.broker_risk_policies
  for each row execute function private.touch_updated_at();
create trigger broker_bindings_touch_updated_at before update on public.broker_strategy_bindings
  for each row execute function private.touch_updated_at();
create trigger broker_intents_touch_updated_at before update on public.broker_order_intents
  for each row execute function private.touch_updated_at();
create trigger broker_jobs_touch_updated_at before update on public.broker_execution_jobs
  for each row execute function private.touch_updated_at();
create trigger broker_orders_touch_updated_at before update on public.broker_orders
  for each row execute function private.touch_updated_at();

-- Atomically claims jobs. SECURITY INVOKER + service_role-only EXECUTE keeps it
-- outside the authenticated Data API surface while preserving RLS semantics.
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
    select id
    from public.broker_execution_jobs
    where status in ('QUEUED', 'RETRY')
      and available_at <= now()
      and attempts < max_attempts
    order by available_at, created_at
    for update skip locked
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

revoke all on function public.claim_broker_execution_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_broker_execution_jobs(text, integer) to service_role;

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
  if not connection_record.ip_restriction_confirmed
     or not coalesce((connection_record.permissions_confirmed->>'read')::boolean, false)
     or not coalesce((connection_record.permissions_confirmed->>'perpetualTrading')::boolean, false) then
    raise exception 'permissions or IP restriction are not confirmed';
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
