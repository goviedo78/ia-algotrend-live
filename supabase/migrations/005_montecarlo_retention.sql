-- 005 — Retention para simulaciones_montecarlo.
-- Política: máx 5 auditorías por usuario + expiración a 30 días.
-- Cleanup invocado por el cliente después de cada insert (lazy).

-- 1) Agregar policy DELETE (faltaba en 004).
drop policy if exists "Usuarios pueden borrar sus simulaciones"
  on public.simulaciones_montecarlo;
create policy "Usuarios pueden borrar sus simulaciones"
  on public.simulaciones_montecarlo for delete
  to authenticated
  using (auth.uid() = user_id);

grant delete on public.simulaciones_montecarlo to authenticated;

-- 2) Índice para que el cleanup por created_at desc sea barato.
create index if not exists idx_simulaciones_user_created
  on public.simulaciones_montecarlo(user_id, created_at desc);

-- 3) Function que limpia las simulaciones del user actual.
-- security invoker => respeta RLS (solo borra las del propio user).
create or replace function public.cleanup_simulaciones_montecarlo()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  -- a) Borrar las que tengan > 30 días.
  delete from public.simulaciones_montecarlo
  where user_id = uid
    and created_at < now() - interval '30 days';

  -- b) Borrar las que excedan las 5 más recientes.
  delete from public.simulaciones_montecarlo
  where id in (
    select id from public.simulaciones_montecarlo
    where user_id = uid
    order by created_at desc
    offset 5
  );
end;
$$;

grant execute on function public.cleanup_simulaciones_montecarlo() to authenticated;
