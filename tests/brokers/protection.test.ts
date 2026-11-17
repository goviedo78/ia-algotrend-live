import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { BingxAdapter, parseBingxJson } from '../../src/lib/brokers/adapters/bingx'
import {
  desiredProtection,
  isTriggerCrossed,
  planProtectionSync,
  roundQuantityDown,
  roundTriggerPrice,
  type ActiveProtection,
} from '../../src/lib/brokers/protection'

const root = path.resolve(import.meta.dirname, '../..')

function active(id: string, kind: ActiveProtection['kind'], triggerPrice: number, quantity = 0.0018): ActiveProtection {
  return { id, kind, triggerPrice, quantity, brokerOrderId: `b-${id}` }
}

const PRECISION = { pricePrecision: 1, quantityPrecision: 4 }

test('a freshly filled position gets its stop and its take profit', () => {
  const desired = desiredProtection({ stopLoss: 77347.8566, takeProfit: 73544.0401 }, 0.0018, 1)
  assert.deepEqual(desired, [
    { kind: 'STOP_LOSS', triggerPrice: 77347.9, quantity: 0.0018 },
    { kind: 'TAKE_PROFIT', triggerPrice: 73544, quantity: 0.0018 },
  ])
  const plan = planProtectionSync({ direction: 'SHORT', desired, active: [], lastPrice: 75800, ...PRECISION })
  assert.deepEqual(plan.place, desired)
  assert.deepEqual(plan.cancel, [])
  assert.equal(plan.crossed, null)
})

test('trigger activation replaces the stop and withdraws the take profit', () => {
  // Trailing activo: la estrategia sube el stop y anula el objetivo.
  const desired = desiredProtection({ stopLoss: 75749.53, takeProfit: null }, 0.0018, 1)
  const oldStop = active('sl', 'STOP_LOSS', 77347.9)
  const oldTarget = active('tp', 'TAKE_PROFIT', 73544)
  const plan = planProtectionSync({ direction: 'SHORT', desired, active: [oldStop, oldTarget], lastPrice: 75300, ...PRECISION })
  assert.deepEqual(plan.place, [{ kind: 'STOP_LOSS', triggerPrice: 75749.5, quantity: 0.0018 }])
  assert.deepEqual(plan.cancel.map((row) => row.id).sort(), ['sl', 'tp'])
  assert.deepEqual(plan.keep, [])
})

test('an unchanged stop is kept, not churned, within the instrument tick', () => {
  const desired = desiredProtection({ stopLoss: 75749.53, takeProfit: null }, 0.0018, 1)
  const current = active('sl', 'STOP_LOSS', 75749.5)
  const plan = planProtectionSync({ direction: 'SHORT', desired, active: [current], lastPrice: 75300, ...PRECISION })
  assert.deepEqual(plan.keep, [current])
  assert.deepEqual(plan.place, [])
  assert.deepEqual(plan.cancel, [])
})

test('a resized position re-places protection for the new quantity', () => {
  const desired = desiredProtection({ stopLoss: 70000, takeProfit: null }, 0.0012, 1)
  const plan = planProtectionSync({
    direction: 'LONG', desired, active: [active('sl', 'STOP_LOSS', 70000, 0.0018)], lastPrice: 75000, ...PRECISION,
  })
  assert.deepEqual(plan.place, [{ kind: 'STOP_LOSS', triggerPrice: 70000, quantity: 0.0012 }])
  assert.deepEqual(plan.cancel.map((row) => row.id), ['sl'])
})

test('no position or a closed strategy trade withdraws every protective order', () => {
  const rows = [active('sl', 'STOP_LOSS', 70000), active('tp', 'TAKE_PROFIT', 80000)]
  const plan = planProtectionSync({ direction: 'LONG', desired: [], active: rows, lastPrice: 0, ...PRECISION })
  assert.deepEqual(plan.cancel, rows)
  assert.deepEqual(plan.place, [])
  assert.deepEqual(desiredProtection({ stopLoss: 70000, takeProfit: 80000 }, 0, 1), [])
})

test('a level the price already crossed exits at market instead of placing an order', () => {
  const desired = desiredProtection({ stopLoss: 75749.53, takeProfit: null }, 0.0018, 1)
  const rows = [active('sl', 'STOP_LOSS', 77347.9)]
  const plan = planProtectionSync({ direction: 'SHORT', desired, active: rows, lastPrice: 75823, ...PRECISION })
  assert.equal(plan.crossed?.kind, 'STOP_LOSS')
  assert.deepEqual(plan.place, [])
  assert.deepEqual(plan.cancel, rows)
})

test('trigger direction follows the protected position', () => {
  assert.equal(isTriggerCrossed('STOP_LOSS', 'LONG', 100, 99), true)
  assert.equal(isTriggerCrossed('STOP_LOSS', 'LONG', 100, 101), false)
  assert.equal(isTriggerCrossed('STOP_LOSS', 'SHORT', 100, 101), true)
  assert.equal(isTriggerCrossed('TAKE_PROFIT', 'LONG', 100, 101), true)
  assert.equal(isTriggerCrossed('TAKE_PROFIT', 'SHORT', 100, 99), true)
  assert.equal(isTriggerCrossed('TAKE_PROFIT', 'SHORT', 100, 101), false)
  assert.equal(isTriggerCrossed('STOP_LOSS', 'LONG', 100, 0), false)
})

test('quantities round down to the contract step and prices to the tick', () => {
  assert.equal(roundQuantityDown(0.0018, 4), 0.0018)
  assert.equal(roundQuantityDown(0.00189, 4), 0.0018)
  assert.equal(roundTriggerPrice(75749.53, 1), 75749.5)
})

test('BingX JSON keeps 19-digit order ids exact', () => {
  const parsed = parseBingxJson('{"code":0,"data":{"orderId":2118735794511286271,"price":75823.0,"time":1793977352000}}') as {
    data: { orderId: string; price: number; time: number }
  }
  assert.equal(parsed.data.orderId, '2118735794511286271')
  assert.equal(parsed.data.price, 75823)
  assert.equal(parsed.data.time, 1793977352000)
})

function recordingAdapter(dualSidePosition: boolean, orderResponse: string) {
  const requests: Array<{ url: string; method: string }> = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    requests.push({ url, method: String(init?.method ?? 'GET') })
    if (url.includes('/positionSide/dual')) return Response.json({ code: 0, data: { dualSidePosition } })
    return new Response(orderResponse)
  }
  const adapter = new BingxAdapter({ credentials: { apiKey: 'key', secretKey: 'secret' }, environment: 'DEMO', fetchImpl, now: () => 2 })
  return { adapter, requests }
}

test('hedge-mode stop closes the short side on last traded price without reduceOnly', async () => {
  const { adapter, requests } = recordingAdapter(true, '{"code":0,"data":{"order":{"orderId":2118735794511286271,"status":"NEW","type":"STOP_MARKET"}}}')
  const result = await adapter.placeTriggerOrder({
    symbol: 'BTC-USDT', direction: 'SHORT', kind: 'STOP_LOSS', triggerPrice: 75749.5, quantity: 0.0018,
  })
  const order = requests.at(-1)!
  assert.equal(order.method, 'POST')
  assert.match(order.url, /\/openApi\/swap\/v2\/trade\/order\?/)
  assert.match(order.url, /type=STOP_MARKET/)
  assert.match(order.url, /side=BUY/)
  assert.match(order.url, /positionSide=SHORT/)
  assert.match(order.url, /stopPrice=75749.5/)
  assert.match(order.url, /quantity=0.0018/)
  assert.match(order.url, /workingType=CONTRACT_PRICE/)
  assert.doesNotMatch(order.url, /reduceOnly=/)
  // BingX rechaza clientOrderId en órdenes condicionales.
  assert.doesNotMatch(order.url, /clientOrderId=/)
  assert.equal(result.brokerOrderId, '2118735794511286271')
})

test('one-way take profit is reduce-only on the BOTH side', async () => {
  const { adapter, requests } = recordingAdapter(false, '{"code":0,"data":{"order":{"orderID":"55","status":"NEW"}}}')
  await adapter.placeTriggerOrder({ symbol: 'BTC-USDT', direction: 'LONG', kind: 'TAKE_PROFIT', triggerPrice: 80000, quantity: 0.002 })
  const order = requests.at(-1)!.url
  assert.match(order, /type=TAKE_PROFIT_MARKET/)
  assert.match(order, /side=SELL/)
  assert.match(order, /positionSide=BOTH/)
  assert.match(order, /reduceOnly=true/)
})

test('open trigger orders are listed with exact ids and only protective types', async () => {
  const { adapter } = recordingAdapter(true, `{"code":0,"data":{"orders":[
    {"orderId":2118735794511286271,"symbol":"BTC-USDT","type":"STOP_MARKET","side":"BUY","positionSide":"SHORT","stopPrice":"75749.5","origQty":"0.0018"},
    {"orderId":2118735794511286272,"symbol":"BTC-USDT","type":"TAKE_PROFIT_MARKET","side":"SELL","positionSide":"BOTH","stopPrice":"80000","origQty":"0.0020"},
    {"orderId":2118735794511286273,"symbol":"BTC-USDT","type":"LIMIT","side":"BUY","positionSide":"LONG","price":"70000","origQty":"0.1"}
  ]}}`)
  const orders = await adapter.listOpenTriggerOrders('BTC-USDT')
  assert.deepEqual(orders, [
    { brokerOrderId: '2118735794511286271', kind: 'STOP_LOSS', direction: 'SHORT', triggerPrice: 75749.5, quantity: 0.0018 },
    { brokerOrderId: '2118735794511286272', kind: 'TAKE_PROFIT', direction: 'LONG', triggerPrice: 80000, quantity: 0.002 },
  ])
})

test('cancel uses DELETE with the exact order id; REST PARTIALLYFILLED is understood', async () => {
  const { adapter, requests } = recordingAdapter(true, '{"code":0,"data":{"order":{"orderId":2118735794511286271,"status":"PARTIALLYFILLED","executedQty":"0.001"}}}')
  await adapter.cancelOrderById('BTC-USDT', '2118735794511286271')
  assert.equal(requests.at(-1)!.method, 'DELETE')
  assert.match(requests.at(-1)!.url, /orderId=2118735794511286271/)
  const order = await adapter.getOrderById('BTC-USDT', '2118735794511286271')
  assert.equal(order?.status, 'PARTIALLY_FILLED')
  assert.equal(order?.brokerOrderId, '2118735794511286271')
})

test('protection is wired safely into the execution path and the schema', async () => {
  const [sync, worker, cron, migration] = await Promise.all([
    readFile(path.join(root, 'src/lib/brokers/protection-sync.ts'), 'utf8'),
    readFile(path.join(root, 'src/lib/brokers/worker.ts'), 'utf8'),
    readFile(path.join(root, 'src/app/api/cron/check/route.ts'), 'utf8'),
    readFile(path.join(root, 'supabase/migrations/20261117120000_broker_protection_orders.sql'), 'utf8'),
  ])
  // Nunca sin stop: se coloca lo nuevo y recién después se cancela lo viejo.
  const placeAt = sync.indexOf('adapter.placeTriggerOrder({')
  const cancelAt = sync.indexOf('for (const active of plan.cancel) await cancelProtectionRow')
  assert.ok(placeAt > 0 && cancelAt > placeAt)
  // Sólo lo propio y nunca más que lo abierto en el broker.
  assert.match(sync, /Math\.min\(ownedQuantity\(owned, symbol, direction\), liveQuantity\)/)
  // El cierre tardío de la estrategia no se rechaza ruidoso.
  assert.match(worker, /closeAlreadyDoneByProtection\(/)
  assert.match(worker, /rejection_code: 'CLOSED_BY_PROTECTION'/)
  assert.match(worker, /cancelStaleProtection\(/)
  assert.match(cron, /publishBrokerProtection\(saved, decision\.stopLoss, decision\.takeProfit/)
  assert.match(cron, /closeBrokerProtection\(trade, actions\)/)
  // Regla de RLS del repo: toda tabla nueva con RLS en la misma migración.
  for (const table of ['broker_strategy_protection', 'broker_protection_orders']) {
    assert.match(migration, new RegExp(`create table public\\.${table}`))
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
  }
  assert.doesNotMatch(migration, /create policy/i)
})
