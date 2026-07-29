-- Keep credential destruction and lifecycle state changes in one transaction.
alter function private.touch_updated_at() set search_path = pg_catalog;

create or replace function public.finalize_broker_connection_revocation(
  target_connection_id uuid,
  expected_user_id uuid,
  requested_status text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_status text;
  final_status text;
begin
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
security invoker
set search_path = public
as $$
declare
  current_status text;
begin
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
security invoker
set search_path = public
as $$
declare
  current_status text;
begin
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
