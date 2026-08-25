import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import type { BrokerAdapter, BrokerOrderResult } from '../../src/lib/brokers/adapters/types'
import { BrokerPlatformError } from '../../src/lib/brokers/errors'
import { evaluateLegacyBingxHealth } from '../../src/lib/legacy-bingx-health'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'

const bingxModule = import('../../src/lib/bingx')

const root = process.cwd()
const filledOrder: BrokerOrderResult = {
  brokerOrderId: 'order-1',
  clientOrderId: 'at-open-10-20',
  status: 'FILLED',
  filledQuantity: 0.0001,
  averagePrice: 60_000,
  rawStatus: { status: 'FILLED' },
}

function adapterStub(overrides: Partial<BrokerAdapter>): BrokerAdapter {
  return {
    broker: 'BINGX',
    validateCredentials: async () => { throw new Error('unused') },
    getBalance: async () => { throw new Error('unused') },
    getCommissionRates: async () => ({ taker: 0.0005, maker: 0.0002 }),
    getPositions: async () => [],
    getInstrumentRules: async () => { throw new Error('unused') },
    getLastPrice: async () => { throw new Error('unused') },
    setLeverage: async () => undefined,
    placeMarketOrder: async () => { throw new Error('unused') },
    getOrder: async () => null,
    getOrderFills: async () => [],
    ...overrides,
  }
}

test('legacy execution requires both independent production barriers', async () => {
  const { isLegacyBingxEnabled } = await bingxModule
  const previousLegacy = process.env.BINGX_LEGACY_EXECUTION_ENABLED
  const previousTrading = process.env.BINGX_TRADING_ENABLED
  try {
    process.env.BINGX_LEGACY_EXECUTION_ENABLED = ' true\\n'
    process.env.BINGX_TRADING_ENABLED = 'TRUE\n'
    assert.equal(isLegacyBingxEnabled(), true)
    process.env.BINGX_LEGACY_EXECUTION_ENABLED = 'false'
    assert.equal(isLegacyBingxEnabled(), false)
    process.env.BINGX_LEGACY_EXECUTION_ENABLED = 'true'
    process.env.BINGX_TRADING_ENABLED = 'false'
    assert.equal(isLegacyBingxEnabled(), false)
  } finally {
    if (previousLegacy === undefined) delete process.env.BINGX_LEGACY_EXECUTION_ENABLED
    else process.env.BINGX_LEGACY_EXECUTION_ENABLED = previousLegacy
    if (previousTrading === undefined) delete process.env.BINGX_TRADING_ENABLED
    else process.env.BINGX_TRADING_ENABLED = previousTrading
  }
})

test('legacy client IDs are deterministic and unique per action', async () => {
  const { legacyOrderClientId } = await bingxModule
  const trade = { id: 10, signal_time: 20 }
  assert.equal(legacyOrderClientId('at-open', trade), 'at-open-10-20')
  assert.equal(legacyOrderClientId('at-close', trade), 'at-close-10-20')
})

test('legacy close never exceeds the quantity opened for that trade', async () => {
  const { exactLegacyCloseQuantity } = await bingxModule
  assert.equal(exactLegacyCloseQuantity(0.0001, 0.0002), 0.0001)
  assert.equal(exactLegacyCloseQuantity(0.0001, 0.00005), 0.00005)
  assert.equal(exactLegacyCloseQuantity(0.0001, 0), 0)
})

test('legacy health reports paused exposure and live desynchronization', () => {
  const shortPosition = {
    symbol: 'BTC-USDT',
    direction: 'SHORT' as const,
    quantity: 0.0001,
    availableQuantity: 0.0001,
    entryPrice: 60_000,
    markPrice: 60_000,
    leverage: 1,
    unrealizedPnl: 0,
  }
  assert.equal(evaluateLegacyBingxHealth({
    tradingEnabled: false,
    appTrade: null,
    positions: [shortPosition],
    openOrderCount: 0,
    unresolvedExecutions: [],
  }), 'PAUSED_WITH_OPEN_POSITION')
  assert.equal(evaluateLegacyBingxHealth({
    tradingEnabled: true,
    appTrade: { id: 1, direction: 'LONG' },
    positions: [shortPosition],
    openOrderCount: 0,
    unresolvedExecutions: [],
  }), 'DESYNCHRONIZED')
})

test('existing deterministic order is reconciled without another submission', async () => {
  const { submitIdempotentBingxMarketOrder } = await bingxModule
  let submissions = 0
  const adapter = adapterStub({
    getOrder: async () => filledOrder,
    placeMarketOrder: async () => {
      submissions += 1
      return filledOrder
    },
  })
  const result = await submitIdempotentBingxMarketOrder(adapter, {
    direction: 'LONG',
    side: 'BUY',
    quantity: 0.0001,
    reduceOnly: false,
    clientOrderId: filledOrder.clientOrderId,
  })
  assert.equal(result.status, 'FILLED')
  assert.equal(submissions, 0)
})

test('ambiguous network submission is reconciled before retrying the order', async () => {
  const { submitIdempotentBingxMarketOrder } = await bingxModule
  let lookups = 0
  let submissions = 0
  const adapter = adapterStub({
    getOrder: async () => {
      lookups += 1
      return lookups === 1 ? null : filledOrder
    },
    placeMarketOrder: async () => {
      submissions += 1
      throw new BrokerPlatformError('BINGX_NETWORK_ERROR', 'network', 503, true)
    },
  })
  const result = await submitIdempotentBingxMarketOrder(adapter, {
    direction: 'LONG',
    side: 'BUY',
    quantity: 0.0001,
    reduceOnly: false,
    clientOrderId: filledOrder.clientOrderId,
  })
  assert.equal(result.status, 'FILLED')
  assert.equal(submissions, 1)
})

test('legacy ledger is private and the cron owns broker side effects', async () => {
  const [migration, databaseSource, cronSource, webhookSource] = await Promise.all([
    readFile(path.join(root, 'supabase/migrations/20260726030938_legacy_bingx_execution_ledger.sql'), 'utf8'),
    readFile(path.join(root, 'src/lib/db.ts'), 'utf8'),
    readFile(path.join(root, 'src/app/api/cron/check/route.ts'), 'utf8'),
    readFile(path.join(root, 'src/app/api/webhook/tradingview/route.ts'), 'utf8'),
  ])
  assert.match(migration, /unique \(trade_id, action\)/i)
  assert.match(migration, /alter table public\.legacy_bingx_executions enable row level security/i)
  assert.match(migration, /revoke all on table public\.legacy_bingx_executions from anon, authenticated/i)
  assert.doesNotMatch(databaseSource, /safeExecuteBingx/)
  assert.match(cronSource, /reconcileLegacyBingxExecutions\(actions\)/)
  assert.match(cronSource, /closeTrade\([\s\S]*closeTradeEverywhere\(closed, actions\)[\s\S]*openTrade\(/)
  assert.match(webhookSource, /BTC_TRADINGVIEW_WEBHOOK_ENABLED !== 'true'/)
})
