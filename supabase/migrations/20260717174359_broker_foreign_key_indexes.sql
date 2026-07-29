create index if not exists broker_audit_actor_user_idx
  on public.broker_audit_events (actor_user_id);
create index if not exists broker_audit_connection_idx
  on public.broker_audit_events (connection_id);
create index if not exists broker_connections_approved_by_idx
  on public.broker_connections (approved_by);
create index if not exists broker_jobs_connection_idx
  on public.broker_execution_jobs (connection_id);
create index if not exists broker_ledger_order_idx
  on public.broker_ledger_entries (order_id);
create index if not exists broker_memberships_reviewed_by_idx
  on public.broker_memberships (reviewed_by);
create index if not exists broker_intents_binding_idx
  on public.broker_order_intents (binding_id);
create index if not exists broker_intents_signal_idx
  on public.broker_order_intents (signal_id);
create index if not exists broker_intents_user_idx
  on public.broker_order_intents (user_id);
create index if not exists broker_orders_connection_idx
  on public.broker_orders (connection_id);
create index if not exists broker_positions_user_idx
  on public.broker_position_snapshots (user_id);
