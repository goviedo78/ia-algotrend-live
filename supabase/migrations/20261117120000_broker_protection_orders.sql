-- Stop y take profit reales en el broker, espejo de los de la estrategia.
--
-- Hasta ahora el bot sólo cerraba con una orden de mercado cuando la estrategia confirmaba la
-- salida al cierre de la vela (+~2 min). La estrategia, en cambio, registra la salida AL PRECIO
-- del stop, tocado dentro de la vela. En una operación de margen chico esa diferencia daba vuelta
-- el resultado (#377: estrategia +0,10 %, cuenta −0,24 USD).
--
-- Ahora cada posición propia lleva en el broker un STOP_MARKET al stop vigente de la estrategia y
-- un TAKE_PROFIT_MARKET a su objetivo. Cuando la estrategia activa el trailing (trigger +1 %),
-- el stop se reemplaza por el nuevo y el take profit se retira, igual que en la estrategia.
--
-- 1. `broker_strategy_protection`: el stop/objetivo VIGENTE de cada operación de una estrategia
--    (estado deseado). Lo escribe el motor de la estrategia; lo lee el worker.
-- 2. `broker_protection_orders`: las órdenes condicionales que el worker colocó por conexión.
--    BingX no acepta clientOrderId en órdenes condicionales, así que se siguen por su orderID.
-- 3. Job `SYNC_PROTECTION`: lleva lo que hay en el broker a lo deseado. Puede haber muchos por
--    intención a lo largo de la vida de la operación, pero sólo uno pendiente a la vez.

create table public.broker_strategy_protection (
  strategy_code text not null,
  trade_key text not null,
  symbol text not null,
  direction text not null check (direction in ('LONG', 'SHORT')),
  stop_loss numeric(24, 10) not null check (stop_loss > 0),
  take_profit numeric(24, 10) check (take_profit is null or take_profit > 0),
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (strategy_code, trade_key)
);

alter table public.broker_strategy_protection enable row level security;
revoke all on public.broker_strategy_protection from anon, authenticated;
grant all on public.broker_strategy_protection to service_role;
-- Sin policies: sólo service_role (motor y worker) lee y escribe.

create table public.broker_protection_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  connection_id uuid not null references public.broker_connections(id) on delete restrict,
  open_intent_id uuid not null references public.broker_order_intents(id) on delete restrict,
  strategy_code text not null,
  trade_key text not null,
  kind text not null check (kind in ('STOP_LOSS', 'TAKE_PROFIT')),
  symbol text not null,
  direction text not null check (direction in ('LONG', 'SHORT')),
  trigger_price numeric(24, 10) not null check (trigger_price > 0),
  quantity numeric(28, 12) not null check (quantity > 0),
  broker_order_id text not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'CANCELED', 'TRIGGERED')),
  close_intent_id uuid references public.broker_order_intents(id) on delete restrict,
  protection_version integer not null,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, broker_order_id)
);

alter table public.broker_protection_orders enable row level security;
revoke all on public.broker_protection_orders from anon, authenticated;
grant all on public.broker_protection_orders to service_role;
-- Sin policies: es estado interno de ejecución, sólo service_role.

create index broker_protection_orders_active_idx
  on public.broker_protection_orders(connection_id, symbol, direction)
  where status = 'ACTIVE';
create index broker_protection_orders_trade_idx
  on public.broker_protection_orders(connection_id, trade_key, status);
create index broker_protection_orders_open_intent_idx
  on public.broker_protection_orders(open_intent_id);
create index broker_protection_orders_close_intent_idx
  on public.broker_protection_orders(close_intent_id);

create trigger broker_strategy_protection_touch_updated_at
  before update on public.broker_strategy_protection
  for each row execute function private.touch_updated_at();
create trigger broker_protection_orders_touch_updated_at
  before update on public.broker_protection_orders
  for each row execute function private.touch_updated_at();

-- El cierre que ejecutó un stop/take profit del broker es una intención propia: no la pidió la
-- estrategia ni el titular.
alter table public.broker_order_intents
  drop constraint if exists broker_order_intents_origin_check;
alter table public.broker_order_intents
  add constraint broker_order_intents_origin_check
  check (origin in ('STRATEGY', 'MANUAL', 'PROTECTION'));

alter table public.broker_execution_jobs
  drop constraint if exists broker_execution_jobs_job_type_check;
alter table public.broker_execution_jobs
  add constraint broker_execution_jobs_job_type_check
  check (job_type in ('VALIDATE_CONNECTION', 'EXECUTE_ORDER', 'RECONCILE_ORDER', 'SYNC_PROTECTION'));

-- Un único EXECUTE/RECONCILE por intención, como siempre. SYNC_PROTECTION se repite durante la
-- vida de la operación (apertura, cada trailing, cierre), así que sólo se impide tener dos
-- pendientes a la vez para la misma intención.
drop index if exists public.broker_jobs_intent_type_unique;
create unique index broker_jobs_intent_type_unique
  on public.broker_execution_jobs(intent_id, job_type)
  where intent_id is not null and job_type <> 'SYNC_PROTECTION';
create unique index broker_jobs_protection_pending_unique
  on public.broker_execution_jobs(intent_id)
  where job_type = 'SYNC_PROTECTION' and status in ('QUEUED', 'RETRY');
