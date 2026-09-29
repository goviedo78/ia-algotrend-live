-- Última vela cerrada que el motor ya aplicó a una operación abierta (SL/TP/trailing).
--
-- El cron corre varias veces por vela y, si se cae, puede saltear horas. Sin este
-- marcador sólo miraba la última vela cerrada: (1) la reevaluaba en cada corrida, y
-- con el trailing ya movido la misma mecha "tocaba" el stop nuevo y cerraba antes que
-- TradingView (#355, #356, #358); (2) las velas salteadas nunca se evaluaban, así el
-- #363 siguió abierto 4 días después de tocar su stop el 2026-09-24 09:00.
-- Con el marcador cada vela cerrada se evalúa una sola vez y en orden.
--
-- Nullable a propósito: una operación abierta antes de esta migración cae en la regla
-- vieja (sólo la última vela) en su primera corrida y desde ahí queda marcada.
-- No crea tablas: RLS de ambas ya está habilitado.

alter table public.algotrend_trades add column if not exists last_managed_time bigint;
alter table public.gold30_trades add column if not exists last_managed_time bigint;
