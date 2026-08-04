-- Reversos: cerrar y abrir en sentido contrario en la misma vela.
--
-- La estrategia emite CLOSE y OPEN con el MISMO signal_time. La app externa los entrega en
-- POSTs separados y el OPEN suele quedar creado antes que el CLOSE. `claim_broker_execution_jobs`
-- ordenaba por `created_at` y sólo deja reclamar un job si no hay otro más viejo no terminal de
-- la misma conexión, así que el OPEN quedaba adelante y BLOQUEABA a su propio cierre:
--
--   08:02:31  se crea el job del OPEN LONG   → reclamado primero
--   08:02:41..08:07:03  el OPEN reintenta 5 veces esperando un cierre que no puede correr
--   08:07:03  el OPEN agota intentos → DEAD_LETTER
--   08:07:05  recién entonces el CLOSE queda libre y ejecuta
--
-- Un deadlock: la apertura esperaba a un cierre atascado detrás de ella. Se perdía el reverso.
--
-- Arreglo: ordenar el trabajo de cada cuenta por (signal_time, CLOSE antes que OPEN) en vez de
-- por hora de creación. Los dos lados de un reverso comparten signal_time, así que el cierre
-- sale primero y la apertura lo encuentra todo limpio. Sin señal asociada (VALIDATE_CONNECTION)
-- se conserva el orden cronológico de siempre.

-- Clave de orden de un job dentro de su cuenta. Ancho fijo para que comparar texto equivalga a
-- comparar la tupla (momento de la señal, acción, creación, id).
create or replace function public.broker_job_order_key(target_job public.broker_execution_jobs)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
      (
        select to_char(signals.signal_time at time zone 'utc', 'YYYYMMDDHH24MISSUS')
          -- CLOSE antes que OPEN cuando comparten momento de señal: liberar la posición
          -- siempre habilita la apertura contraria, nunca al revés.
          || case when intents.action = 'CLOSE' then '0' else '1' end
        from public.broker_order_intents intents
        join public.broker_signals signals on signals.id = intents.signal_id
        where intents.id = target_job.intent_id
      ),
      to_char(target_job.created_at at time zone 'utc', 'YYYYMMDDHH24MISSUS') || '1'
    )
    || to_char(target_job.created_at at time zone 'utc', 'YYYYMMDDHH24MISSUS')
    || target_job.id::text
$$;

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

revoke all on function public.broker_job_order_key(public.broker_execution_jobs)
  from public, anon, authenticated;
grant execute on function public.broker_job_order_key(public.broker_execution_jobs)
  to service_role;

revoke all on function public.claim_broker_execution_jobs(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_broker_execution_jobs(text, integer)
  to service_role;
