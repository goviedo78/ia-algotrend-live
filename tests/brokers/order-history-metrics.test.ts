import assert from 'node:assert/strict'
import test from 'node:test'
import {
  enrichBrokerTradeCycles,
  summarizeBrokerOrderHistory,
} from '../../src/lib/brokers/order-history-metrics'
import type { BrokerOrderHistoryItem } from '../../src/lib/brokers/order-history-types'

function order(overrides: Partial<BrokerOrderHistoryItem>): BrokerOrderHistoryItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    userId: 'user-1',
    userEmail: null,
    connectionId: 'connection-1',
    connectionLabel: 'Cuenta BTC',
    broker: 'BINGX',
    environment: 'LIVE',
    strategyCode: 'BTC_1H',
    strategyLabel: 'BTC 1H',
    timeframe: '1h',
    externalSignalId: null,
    signalTime: null,
    action: 'OPEN',
    symbol: 'BTC-USDT',
    side: 'BUY',
    direction: 'LONG',
    reduceOnly: false,
    requestedQuantity: 1,
    filledQuantity: 1,
    averagePrice: 100,
    notionalUsd: 100,
    realizedPnlUsd: 0,
    feesUsd: 0,
    fundingUsd: 0,
    adjustmentsUsd: 0,
    netPnlUsd: 0,
    tradeNetPnlUsd: null,
    tradeFeesUsd: null,
    entryNotionalUsd: null,
    netReturnPct: null,
    status: 'FILLED',
    clientOrderId: 'client-order',
    brokerOrderId: 'broker-order',
    submittedAt: null,
    reconciledAt: null,
    firstFillAt: null,
    lastFillAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    fills: [],
    ...overrides,
  }
}

test('a complete long cycle uses entry notional and both sides of fees', () => {
  const enriched = enrichBrokerTradeCycles([
    order({ id: 'open', filledQuantity: 2, averagePrice: 100, notionalUsd: 200, feesUsd: 1 }),
    order({
      id: 'close',
      action: 'CLOSE',
      side: 'SELL',
      reduceOnly: true,
      filledQuantity: 2,
      averagePrice: 120,
      notionalUsd: 240,
      feesUsd: 1,
      createdAt: '2026-08-01T01:00:00.000Z',
    }),
  ])
  const close = enriched.find((item) => item.id === 'close')!
  const summary = summarizeBrokerOrderHistory(enriched)

  assert.equal(close.entryNotionalUsd, 200)
  assert.equal(close.tradeFeesUsd, 2)
  assert.equal(close.tradeNetPnlUsd, 38)
  assert.equal(close.netReturnPct, 19)
  assert.equal(summary.performance.netPnlUsd, 38)
  assert.equal(summary.performance.totalFeesUsd, 2)
  assert.equal(summary.performance.closedEntryNotionalUsd, 200)
  assert.equal(summary.totals.notionalUsd, 440)
  assert.equal(summary.totals.netReturnPct, 19)
})

test('partial closes allocate opening cost basis and fees without double counting', () => {
  const enriched = enrichBrokerTradeCycles([
    order({ id: 'open', filledQuantity: 2, averagePrice: 100, notionalUsd: 200, feesUsd: 2 }),
    order({
      id: 'close-1', action: 'CLOSE', side: 'SELL', reduceOnly: true,
      filledQuantity: 1, averagePrice: 110, notionalUsd: 110, feesUsd: 0.5,
      createdAt: '2026-08-01T01:00:00.000Z',
    }),
    order({
      id: 'close-2', action: 'CLOSE', side: 'SELL', reduceOnly: true,
      filledQuantity: 1, averagePrice: 90, notionalUsd: 90, feesUsd: 0.5,
      createdAt: '2026-08-01T02:00:00.000Z',
    }),
  ])
  const summary = summarizeBrokerOrderHistory(enriched)

  assert.equal(enriched.find((item) => item.id === 'close-1')?.tradeNetPnlUsd, 8.5)
  assert.equal(enriched.find((item) => item.id === 'close-2')?.tradeNetPnlUsd, -11.5)
  assert.equal(summary.performance.closedTradeCount, 2)
  assert.equal(summary.performance.totalFeesUsd, 3)
  assert.equal(summary.performance.netPnlUsd, -3)
  assert.equal(summary.performance.closedEntryNotionalUsd, 200)
})

test('a broker realized PnL value is authoritative and unmatched closes are excluded', () => {
  const enriched = enrichBrokerTradeCycles([
    order({ id: 'open', direction: 'SHORT', side: 'SELL', feesUsd: 1 }),
    order({
      id: 'close', action: 'CLOSE', direction: 'SHORT', side: 'BUY', reduceOnly: true,
      averagePrice: 90, notionalUsd: 90, realizedPnlUsd: 12, feesUsd: 1,
      createdAt: '2026-08-01T01:00:00.000Z',
    }),
    order({
      id: 'unmatched', action: 'CLOSE', direction: 'LONG', side: 'SELL', reduceOnly: true,
      createdAt: '2026-08-01T02:00:00.000Z',
    }),
  ])
  const summary = summarizeBrokerOrderHistory(enriched)

  assert.equal(enriched.find((item) => item.id === 'close')?.tradeNetPnlUsd, 10)
  assert.equal(summary.performance.closedTradeCount, 1)
  assert.equal(summary.performance.unmatchedCloseCount, 1)
  assert.equal(summary.performance.netPnlUsd, 10)
})
