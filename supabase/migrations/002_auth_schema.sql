-- GONOVI Auth foundation.
-- Local migration only: do not apply to remote automatically.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.official_orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.official_licenses
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'pending')),
  created_at timestamptz not null default now()
);

alter table public.support_tickets
  add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.support_tickets add column if not exists email text;
alter table public.support_tickets add column if not exists subject text;
alter table public.support_tickets add column if not exists message text;
alter table public.support_tickets add column if not exists status text default 'open';
alter table public.support_tickets add column if not exists created_at timestamptz default now();

update public.support_tickets set email = 'unknown@gonovi.app' where email is null;
update public.support_tickets set subject = 'Soporte' where subject is null;
update public.support_tickets set message = '' where message is null;
update public.support_tickets set status = 'open' where status is null;
update public.support_tickets
set status = 'pending'
where status not in ('open', 'closed', 'pending');
update public.support_tickets set created_at = now() where created_at is null;

alter table public.support_tickets alter column email set not null;
alter table public.support_tickets alter column subject set not null;
alter table public.support_tickets alter column message set not null;
alter table public.support_tickets alter column status set default 'open';
alter table public.support_tickets alter column status set not null;
alter table public.support_tickets alter column created_at set default now();
alter table public.support_tickets alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_status_check'
      and conrelid = 'public.support_tickets'::regclass
  ) then
    alter table public.support_tickets
      add constraint support_tickets_status_check check (status in ('open', 'closed', 'pending'));
  end if;
end
$$;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null default '',
  auth_key text not null default '',
  auth text,
  scope text not null default 'customer',
  tenant_id text not null default 'gonovi',
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.push_subscriptions add column if not exists p256dh text default '';
alter table public.push_subscriptions add column if not exists auth_key text default '';
alter table public.push_subscriptions add column if not exists auth text;
alter table public.push_subscriptions add column if not exists scope text not null default 'customer';
alter table public.push_subscriptions add column if not exists tenant_id text not null default 'gonovi';
alter table public.push_subscriptions add column if not exists user_agent text;

create unique index if not exists idx_push_subscriptions_endpoint_unique
  on public.push_subscriptions(endpoint);

update public.push_subscriptions
set auth_key = coalesce(nullif(auth_key, ''), auth, '')
where auth_key is null or auth_key = '';

update public.push_subscriptions
set p256dh = ''
where p256dh is null;

alter table public.push_subscriptions alter column p256dh set not null;
alter table public.push_subscriptions alter column auth_key set not null;

create table if not exists public.lab_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  scenario_id text not null,
  score int not null,
  attempts int not null default 1,
  last_played_at timestamptz not null default now(),
  unique(user_id, scenario_id)
);

create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_official_orders_user_id on public.official_orders(user_id);
create index if not exists idx_official_licenses_user_id on public.official_licenses(user_id);
create index if not exists idx_support_tickets_user_id on public.support_tickets(user_id);
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);
create index if not exists idx_lab_progress_user_id on public.lab_progress(user_id);

alter table public.profiles enable row level security;
alter table public.official_orders enable row level security;
alter table public.official_licenses enable row level security;
alter table public.support_tickets enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.lab_progress enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists official_orders_select_own on public.official_orders;
create policy official_orders_select_own on public.official_orders
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists official_orders_service_role_all on public.official_orders;
create policy official_orders_service_role_all on public.official_orders
  for all to service_role using (true) with check (true);

drop policy if exists official_licenses_select_own on public.official_licenses;
create policy official_licenses_select_own on public.official_licenses
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists official_licenses_service_role_all on public.official_licenses;
create policy official_licenses_service_role_all on public.official_licenses
  for all to service_role using (true) with check (true);

drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists support_tickets_insert_own on public.support_tickets;
create policy support_tickets_insert_own on public.support_tickets
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists support_tickets_service_role_all on public.support_tickets;
create policy support_tickets_service_role_all on public.support_tickets
  for all to service_role using (true) with check (true);

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists push_subscriptions_service_role_all on public.push_subscriptions;
create policy push_subscriptions_service_role_all on public.push_subscriptions
  for all to service_role using (true) with check (true);

drop policy if exists lab_progress_select_own on public.lab_progress;
create policy lab_progress_select_own on public.lab_progress
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists lab_progress_insert_own on public.lab_progress;
create policy lab_progress_insert_own on public.lab_progress
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists lab_progress_update_own on public.lab_progress;
create policy lab_progress_update_own on public.lab_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists lab_progress_service_role_all on public.lab_progress;
create policy lab_progress_service_role_all on public.lab_progress
  for all to service_role using (true) with check (true);

grant select, update on public.profiles to authenticated;
grant select on public.official_orders to authenticated;
grant select on public.official_licenses to authenticated;
grant select, insert on public.support_tickets to authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant select, insert, update on public.lab_progress to authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
