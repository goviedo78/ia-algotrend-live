import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fillBelongsToOrder } from '../../src/lib/brokers/adapters/bingx'

const root = path.resolve(import.meta.dirname, '../..')
const CLIENT_ID = 'gv-940e50cabd5b88071d1dfd9262e63b33'
const ORDER_ID = '2084551686433742848'

test('a fill that carries our client id still matches', () => {
  assert.equal(fillBelongsToOrder({ clientOrderId: CLIENT_ID }, ORDER_ID, CLIENT_ID), true)
  assert.equal(fillBelongsToOrder({ clientOrderID: CLIENT_ID.toUpperCase() }, ORDER_ID, CLIENT_ID), true)
})

test('a fill without client id matches by order id, even mangled by JSON int64 precision', () => {
  // Éste es el caso que dejó ocho órdenes sin contabilidad: BingX no manda clientOrderId en las
  // filas de fills, el filtro comparaba contra '' y descartaba todo.
  assert.equal(fillBelongsToOrder({ orderId: ORDER_ID }, ORDER_ID, CLIENT_ID), true)

  // 2084551686433742848 no es representable como double: vuelve como ...800.
  const mangled = 2084551686433742848
  assert.notEqual(String(mangled), ORDER_ID)
  assert.equal(fillBelongsToOrder({ orderId: mangled }, ORDER_ID, CLIENT_ID), true)
  assert.equal(fillBelongsToOrder({ order_id: '2084551686433742800' }, ORDER_ID, CLIENT_ID), true)
})

test('a fill from a different order is never claimed as ours', () => {
  assert.equal(fillBelongsToOrder({ orderId: '2084551686433999999' }, ORDER_ID, CLIENT_ID), false)
  assert.equal(fillBelongsToOrder({ clientOrderId: 'gv-otro' }, ORDER_ID, CLIENT_ID), false)
  // Sin ningún identificador utilizable no se adopta la ejecución.
  assert.equal(fillBelongsToOrder({ qty: 1 }, ORDER_ID, CLIENT_ID), false)
})

test('reconciliation trusts the quantity we already persisted, not only what getOrder reports', async () => {
  const worker = await readFile(path.join(root, 'src/lib/brokers/worker.ts'), 'utf8')

  // getOrder de BingX devuelve a veces la orden sin cantidad ejecutada; guiarse sólo por eso
  // marcaba la orden como reconciliada con cero fills y cero ledger, en silencio.
  assert.match(worker, /const expectedQuantity = Math\.max\(remoteOrder\.filledQuantity, Number\(storedOrder\.filled_quantity\) \|\| 0\)/)
  assert.match(worker, /expectedQuantity > 0[\s\S]*fillsQuantity < expectedQuantity - fillTolerance/)
  assert.doesNotMatch(worker, /remoteOrder\.filledQuantity > 0\s*\n\s*&& connection\.environment === 'LIVE'/)
})

test('per-account job ordering puts the close of a reversal ahead of its opposite open', async () => {
  const migration = await readFile(
    path.join(root, 'supabase/migrations/20260804120000_order_broker_jobs_by_signal_close_first.sql'),
    'utf8',
  )

  // La clave de orden se arma con el momento de la SEÑAL, no con la hora de creación del job:
  // los dos lados de un reverso comparten signal_time y el cierre tiene que salir primero.
  assert.match(migration, /create or replace function public\.broker_job_order_key/i)
  assert.match(migration, /signals\.signal_time at time zone 'utc'/i)
  assert.match(migration, /case when intents\.action = 'CLOSE' then '0' else '1' end/i)

  // El bloqueo head-of-line por cuenta se mantiene, pero comparando la nueva clave.
  assert.match(migration, /public\.broker_job_order_key\(earlier\) < public\.broker_job_order_key\(jobs\)/i)
  assert.doesNotMatch(migration, /\(earlier\.created_at, earlier\.id\) < \(jobs\.created_at, jobs\.id\)/i)

  // Sigue siendo service-only.
  assert.match(migration, /revoke all on function public\.claim_broker_execution_jobs\(text, integer\)[\s\S]*from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.broker_job_order_key[\s\S]*to service_role/i)
})
