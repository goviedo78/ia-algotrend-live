import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { strategyTradeKey } from '../../src/lib/brokers/domain'
import {
  enrichBrokerTradeCycles,
  openBrokerPositionsFromOrders,
} from '../../src/lib/brokers/order-history-metrics'
import type { BrokerOrderHistoryItem } from '../../src/lib/brokers/order-history-types'

const root = path.resolve(import.meta.dirname, '../..')

function order(overrides: Partial<BrokerOrderHistoryItem>): BrokerOrderHistoryItem {
  return {
    id: 'order',
    userId: 'user',
    userEmail: null,
    connectionId: 'conn',
    connectionLabel: 'oro 30',
    broker: 'BINGX',
    environment: 'LIVE',
    strategyCode: 'ALGOTREND_GOLD_30M',
    strategyLabel: 'Oro 30m',
    timeframe: '30m',
    externalSignalId: null,
    signalTime: null,
    action: 'OPEN',
    symbol: 'NCCOGOLD2USD-USDT',
    side: 'BUY',
    direction: 'LONG',
    reduceOnly: false,
    requestedQuantity: 0.1,
    filledQuantity: 0.1,
    averagePrice: 4000,
    notionalUsd: 400,
    realizedPnlUsd: 0,
    feesUsd: 0.2,
    fundingUsd: 0,
    adjustmentsUsd: 0,
    netPnlUsd: 0,
    tradeNetPnlUsd: null,
    tradeFeesUsd: null,
    entryNotionalUsd: null,
    netReturnPct: null,
    status: 'FILLED',
    clientOrderId: 'gv-1',
    brokerOrderId: '1',
    submittedAt: null,
    reconciledAt: null,
    firstFillAt: null,
    lastFillAt: null,
    createdAt: '2026-09-02T19:32:20.000Z',
    updatedAt: '2026-09-02T19:32:20.000Z',
    fills: [],
    ...overrides,
  }
}

test('the trade key survives both signal id shapes and refuses anything else', () => {
  assert.equal(strategyTradeKey('algotrend-btc-1h-358-open-1788444000'), 'algotrend-btc-1h-358')
  assert.equal(strategyTradeKey('algotrend-btc-1h-358-close-1788444000'), 'algotrend-btc-1h-358')
  assert.equal(strategyTradeKey('gold30-309-open'), 'gold30-309')
  assert.equal(strategyTradeKey('gold30-309-close'), 'gold30-309')
  // Distintas operaciones nunca comparten clave, aunque compartan vela.
  assert.notEqual(
    strategyTradeKey('algotrend-btc-1h-357-close-1788444000'),
    strategyTradeKey('algotrend-btc-1h-358-open-1788444000'),
  )
  assert.equal(strategyTradeKey('manual-close-8b1c'), null)
  assert.equal(strategyTradeKey(null), null)
})

test('a position closed outside the platform stops being reported as open', () => {
  const orders = [order({ id: 'open-1' })]
  assert.equal(openBrokerPositionsFromOrders(orders).length, 1)

  const settled = openBrokerPositionsFromOrders(orders, [{
    intentId: 'intent-1',
    connectionId: 'conn',
    connectionLabel: 'oro 30',
    symbol: 'NCCOGOLD2USD-USDT',
    direction: 'LONG',
    settledAt: '2026-09-03T12:00:00.000Z',
  }])
  assert.equal(settled.length, 0)
})

test('the settled entry never contaminates the cost basis of the next operation', () => {
  const orders = [
    order({ id: 'ghost-open', createdAt: '2026-09-02T19:32:20.000Z', averagePrice: 4000, notionalUsd: 400, filledQuantity: 0.1 }),
    order({ id: 'new-open', createdAt: '2026-09-05T10:00:00.000Z', averagePrice: 4500, notionalUsd: 450, filledQuantity: 0.1 }),
    order({
      id: 'new-close',
      action: 'CLOSE',
      side: 'SELL',
      reduceOnly: true,
      createdAt: '2026-09-05T14:00:00.000Z',
      averagePrice: 4600,
      notionalUsd: 460,
      filledQuantity: 0.1,
      feesUsd: 0.2,
    }),
  ]

  const settlement = {
    intentId: 'intent-1',
    connectionId: 'conn',
    connectionLabel: 'oro 30',
    symbol: 'NCCOGOLD2USD-USDT',
    direction: 'LONG',
    settledAt: '2026-09-03T12:00:00.000Z',
  }

  const close = enrichBrokerTradeCycles(orders, [settlement]).find((item) => item.id === 'new-close')
  // Sólo la entrada de 450 USD paga este cierre: la entrada fantasma ya no promedia nada.
  assert.equal(close?.entryNotionalUsd, 450)
  assert.equal(close?.tradeNetPnlUsd, 10 - 0.4)

  // Y la posición viva después del asiento sigue siendo una sola, la nueva.
  const stillOpen = openBrokerPositionsFromOrders(orders.slice(0, 2), [settlement])
  assert.equal(stillOpen.length, 1)
  assert.equal(stillOpen[0].averageEntryPrice, 4500)
})

test('only a close the holder asked for can settle a position the broker no longer has', async () => {
  const [worker, migration, route] = await Promise.all([
    readFile(path.join(root, 'src/lib/brokers/worker.ts'), 'utf8'),
    readFile(path.join(root, 'supabase/migrations/20260903180000_manual_position_close_and_trade_pairing.sql'), 'utf8'),
    readFile(path.join(root, 'src/app/api/broker-connections/[id]/positions/close/route.ts'), 'utf8'),
  ])

  // Un cierre automático que no encuentra la posición tiene que seguir fallando ruidoso.
  assert.match(worker, /intent\.action === 'CLOSE' && intent\.origin === 'MANUAL'/)
  // El asiento externo nunca inventa una orden ni un resultado.
  assert.match(worker, /status: 'SETTLED_EXTERNALLY'/)
  assert.doesNotMatch(worker, /SETTLED_EXTERNALLY[\s\S]{0,400}?persistOrder/)
  // La tenencia propia descuenta lo asentado: sin eso el motor podría cerrar algo ajeno.
  assert.match(worker, /\.eq\('status', 'SETTLED_EXTERNALLY'\)/)

  // La RPC es sólo para service_role y comprueba propiedad real antes de encolar nada.
  assert.match(migration, /create or replace function public\.request_manual_position_close/)
  assert.match(migration, /if coalesce\(auth\.role\(\), ''\) <> 'service_role' then/)
  assert.match(migration, /no owned position to close/)
  assert.match(migration, /revoke all on function public\.request_manual_position_close\(uuid, uuid, text, text\)\s*\n\s*from public, anon, authenticated;/)

  // El reenvío ya no puede ofrecer una operación que la estrategia cerró en la misma vela.
  assert.match(migration, /broker_strategy_trade_key\(closes\.external_signal_id\) = open_trade_key/)
  assert.match(migration, /closes\.signal_time >= signal_record\.signal_time/)

  assert.match(route, /requireOwnedConnection/)
  assert.match(route, /manualPositionCloseSchema/)
})
