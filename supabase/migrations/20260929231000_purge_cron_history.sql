-- Limpieza diaria del historial de pg_cron.
--
-- `cron.job_run_details` guarda una fila por corrida y nunca se purga solo. Con el drenaje
-- del broker cada minuto más los disparadores de oro300/oro15, el 2026-09-29 tenía 115.076
-- filas desde julio: 66 MB de los 89 MB de toda la base, en una instancia Nano de 0,5 GB que
-- ese mismo día se colgó. Se conservan 7 días, suficiente para auditar una caída reciente.

select cron.unschedule(jobid) from cron.job where jobname = 'purge-cron-history';

select cron.schedule(
  'purge-cron-history',
  '17 3 * * *',
  $$delete from cron.job_run_details where coalesce(end_time, start_time) < now() - interval '7 days'$$
);

delete from cron.job_run_details where coalesce(end_time, start_time) < now() - interval '7 days';
