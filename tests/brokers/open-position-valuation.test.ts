import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { applyMarkPrice } from '../../src/lib/brokers/open-position-valuation'
import type { BrokerOpenPositionSummary } from '../../src/lib/brokers/order-history-types'

const PRICED_AT = '2026-08-29T01:20:00.000Z'

function position(overrides: Partial<BrokerOpenPositionSummary> = {}): BrokerOpenPositionSummary {
  return {
    key: 'connection-1:NCCOGOLD2USD-USDT:SHORT',
    connectionId: 'connection-1',
    connectionLabel: 'Cuenta Oro',
    broker: 'BINGX',
    environment: 'LIVE',
    strategyCode: 'ALGOTREND_GOLD_30M',
    strategyLabel: 'Oro 30M',
    timeframe: '30m',
    externalSignalId: 'gold30-308-open',
    symbol: 'NCCOGOLD2USD-USDT',
    direction: 'SHORT',
    quantity: 0.02,
    averageEntryPrice: 4639.14,
    notionalUsd: 92.7828,
    entryFeesUsd: 0.046391,
    openedAt: '2026-08-25T10:32:32.295Z',
    markPrice: null,
    unrealizedGrossPnlUsd: null,
    unrealizedNetPnlUsd: null,
    unrealizedReturnPct: null,
    pricedAt: null,
    ...overrides,
  }
}

test('un corto gana cuando el precio baja, y el porcentaje sale sobre el capital de entrada', () => {
  // El trade 308 real: entró a 4639.14 y el mercado quedó en 4466.02.
  const valued = applyMarkPrice(position(), 4466.02, PRICED_AT)

  assert.equal(valued.markPrice, 4466.02)
  assert.ok(Math.abs((valued.unrealizedGrossPnlUsd ?? 0) - 3.4624) < 1e-6)
  // El neto descuenta la comisión de entrada ya pagada, nunca una de salida inventada.
  assert.ok(Math.abs((valued.unrealizedNetPnlUsd ?? 0) - (3.4624 - 0.046391)) < 1e-6)
  assert.ok(Math.abs((valued.unrealizedReturnPct ?? 0) - 3.6816) < 1e-3)
  assert.equal(valued.pricedAt, PRICED_AT)
})

test('un corto pierde cuando el precio sube', () => {
  const valued = applyMarkPrice(position(), 4700, PRICED_AT)

  assert.ok((valued.unrealizedGrossPnlUsd ?? 0) < 0)
  assert.ok((valued.unrealizedNetPnlUsd ?? 0) < (valued.unrealizedGrossPnlUsd ?? 0))
  assert.ok((valued.unrealizedReturnPct ?? 0) < 0)
})

test('un largo invierte el signo respecto del corto', () => {
  const long = position({ direction: 'LONG', entryFeesUsd: 0 })
  const up = applyMarkPrice(long, 4700, PRICED_AT)
  const down = applyMarkPrice(long, 4466.02, PRICED_AT)

  assert.ok((up.unrealizedGrossPnlUsd ?? 0) > 0)
  assert.ok((down.unrealizedGrossPnlUsd ?? 0) < 0)
})

test('sin precio usable la posición queda sin valuar, no en cero', () => {
  for (const price of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const valued = applyMarkPrice(position(), price, PRICED_AT)
    assert.equal(valued.unrealizedNetPnlUsd, null, `precio ${String(price)} no debe valuar`)
    assert.equal(valued.unrealizedReturnPct, null)
    assert.equal(valued.markPrice, null)
    assert.equal(valued.pricedAt, null)
  }
})

test('una posición sin cantidad o sin precio de entrada tampoco se valúa', () => {
  assert.equal(applyMarkPrice(position({ quantity: 0 }), 4466.02, PRICED_AT).unrealizedNetPnlUsd, null)
  assert.equal(applyMarkPrice(position({ averageEntryPrice: 0 }), 4466.02, PRICED_AT).unrealizedNetPnlUsd, null)
})

test('sin capital de entrada hay monto pero no porcentaje, en vez de una división por cero', () => {
  const valued = applyMarkPrice(position({ notionalUsd: 0 }), 4466.02, PRICED_AT)

  assert.ok(valued.unrealizedNetPnlUsd != null)
  assert.equal(valued.unrealizedReturnPct, null)
})

test('el ticker que valúa es el endpoint público, sin firma ni API key', () => {
  const source = readFileSync(new URL('../../src/lib/brokers/adapters/bingx.ts', import.meta.url), 'utf8')
  const helper = source.slice(source.indexOf('export async function fetchBingxTickerPrice'))
  const body = helper.slice(0, helper.indexOf('\n}\n') + 3)

  assert.match(body, /openApi\/swap\/v1\/ticker\/price/)
  assert.doesNotMatch(body, /X-BX-APIKEY/)
  assert.doesNotMatch(body, /signature/)
  // Dos usos con exigencias distintas comparten la función: el TTL entra en la clave de
  // cache para que valuar una pantalla nunca le sirva un precio viejo a una ejecución.
  assert.match(body, /\$\{ttlMs\}/)
})

test('valuar el panel no toca las credenciales del titular', () => {
  const source = readFileSync(new URL('../../src/lib/brokers/open-position-valuation.ts', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /loadBrokerAdapter|credential|envelope|decrypt/i)
  assert.match(source, /import 'server-only'/)
})
