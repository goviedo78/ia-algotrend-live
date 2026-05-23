-- 004 — Proyecto Montecarlo: tabla de auditorías estocásticas por usuario.

create table if not exists public.simulaciones_montecarlo (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  nombre_estrategia text not null,
  cantidad_trades integer not null,
  winrate numeric(5,2) not null,
  esperanza_matematica numeric(5,2) not null,
  sharpe_ratio numeric(5,2) not null,
  k_ratio numeric(6,3) not null,
  probabilidad_ruina numeric(5,2) not null,
  drawdown_95 numeric(5,2) not null,
  veredicto text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.simulaciones_montecarlo enable row level security;

drop policy if exists "Usuarios pueden insertar sus simulaciones" on public.simulaciones_montecarlo;
create policy "Usuarios pueden insertar sus simulaciones"
  on public.simulaciones_montecarlo for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuarios pueden ver sus simulaciones" on public.simulaciones_montecarlo;
create policy "Usuarios pueden ver sus simulaciones"
  on public.simulaciones_montecarlo for select
  using (auth.uid() = user_id);
