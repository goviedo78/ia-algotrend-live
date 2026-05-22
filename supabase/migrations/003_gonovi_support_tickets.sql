-- 003 — Tabla dedicada GONOVI para tickets de soporte.
-- Motivo: support_tickets remota está compartida con otro proyecto y exige
-- columnas NOT NULL (tenant_id, code, customer, ...) que no aplican a GONOVI.
-- Aislamos el dominio GONOVI con una tabla propia + RLS propias.

create table if not exists public.gonovi_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'closed', 'pending')),
  created_at timestamptz not null default now()
);

create index if not exists idx_gonovi_support_tickets_user_id
  on public.gonovi_support_tickets(user_id);

create index if not exists idx_gonovi_support_tickets_created_at
  on public.gonovi_support_tickets(created_at desc);

alter table public.gonovi_support_tickets enable row level security;

drop policy if exists gonovi_support_tickets_select_own on public.gonovi_support_tickets;
create policy gonovi_support_tickets_select_own on public.gonovi_support_tickets
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists gonovi_support_tickets_insert_own on public.gonovi_support_tickets;
create policy gonovi_support_tickets_insert_own on public.gonovi_support_tickets
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists gonovi_support_tickets_service_role_all on public.gonovi_support_tickets;
create policy gonovi_support_tickets_service_role_all on public.gonovi_support_tickets
  for all to service_role using (true) with check (true);

grant select, insert on public.gonovi_support_tickets to authenticated;
