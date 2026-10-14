import assert from 'node:assert/strict'
import test from 'node:test'
import { selectBrokerHistory, historyDateRange, brokerHistoryBars } from '../../src/lib/brokers/history-filters'
import { EMPTY_BROKER_ORDER_HISTORY, type BrokerOrderHistoryItem } from '../../src/lib/brokers/order-history-types'

const order = (overrides: Partial<BrokerOrderHistoryItem>): BrokerOrderHistoryItem => ({
  id: 'open', userId: 'u1', connectionId: 'btc', connectionLabel: 'BTC', strategyCode: 'BTC_1H',
  symbol: 'BTC-USDT', direction: 'LONG', action: 'OPEN', filledQuantity: 1, averagePrice: 100,
  notionalUsd: 100, feesUsd: 1, fundingUsd: 0, adjustmentsUsd: 0, realizedPnlUsd: 0,
  netPnlUsd: -1, createdAt: '2026-10-01T01:00:00Z', fills: [],
  lastFillAt: null, reconciledAt: null, submittedAt: null, ...overrides,
} as BrokerOrderHistoryItem)
const history = { ...EMPTY_BROKER_ORDER_HISTORY, orders: [
  order({}),
  order({ id: 'close', action: 'CLOSE', averagePrice: 120, notionalUsd: 120, createdAt: '2026-10-04T03:00:00Z' }),
  order({ id: 'other-open', connectionId: 'gold' }),
  order({ id: 'other-close', connectionId: 'gold', action: 'CLOSE', averagePrice: 80, notionalUsd: 80, createdAt: '2026-10-04T03:00:00Z' }),
] }

test('connection and range isolate a 74h trade while retaining its old opening cost', () => {
  const selected = selectBrokerHistory(history, { connectionId: 'btc', start: '2026-10-04', end: '2026-10-04', timeZone: 'UTC' })
  assert.deepEqual(selected.orders.map(o => o.id), ['close'])
  assert.equal(selected.performance.netPnlUsd, 18)
  assert.equal(selected.totals.netReturnPct, 18)
  assert.equal(selected.totals.notionalUsd, 120)
  assert.equal(selected.performance.totalFeesUsd, 2)
  assert.equal(brokerHistoryBars(selected.orders, 'day', 'UTC')[0].netPnlUsd, 18)
})
test('all history has no 100-order display cutoff and aggregates both connections', () => {
  const selected = selectBrokerHistory(history, { timeZone: 'UTC' })
  assert.equal(selected.performance.closedTradeCount, 2)
  assert.equal(selected.performance.netPnlUsd, -4)
  assert.equal(selected.totals.netReturnPct, -2)
})
test('date boundaries use execution time and local calendar, not creation or signal time', () => {
  const selected = selectBrokerHistory({ ...history, orders: [
    order({ id: 'local-end', createdAt: '2026-10-01T00:00:00Z', lastFillAt: '2026-10-05T05:59:59Z' }),
    order({ id: 'next-day', lastFillAt: '2026-10-05T06:00:00Z' }),
  ] }, { start: '2026-10-04', end: '2026-10-04', timeZone: 'America/Mexico_City' })
  assert.deepEqual(selected.orders.map(o => o.id), ['local-end'])
})
test('reversed or invalid ranges fail closed', () => {
  assert.equal(selectBrokerHistory(history, { start: '2026-10-05', end: '2026-10-01', timeZone: 'UTC' }).orders.length, 0)
  assert.equal(selectBrokerHistory(history, { start: '2026-02-30', timeZone: 'UTC' }).orders.length, 0)
})
test('weekly and monthly presets include today and use calendar dates', () => {
  assert.deepEqual(historyDateRange('week', new Date('2026-10-14T12:00:00Z'), 'UTC'), { start: '2026-10-08', end: '2026-10-14' })
  assert.deepEqual(historyDateRange('month', new Date('2026-10-14T12:00:00Z'), 'UTC'), { start: '2026-09-15', end: '2026-10-14' })
})
test('partial exits in separate periods allocate entry fees exactly once', () => {
  const h = { ...history, orders: [order({ filledQuantity: 2, notionalUsd: 200, feesUsd: 2 }),
    order({ id: 'c1', action: 'CLOSE', averagePrice: 110, notionalUsd: 110, createdAt: '2026-10-03T12:00:00Z' }),
    order({ id: 'c2', action: 'CLOSE', averagePrice: 90, notionalUsd: 90, createdAt: '2026-10-04T12:00:00Z' }),
  ] }
  assert.equal(selectBrokerHistory(h, { start: '2026-10-04', end: '2026-10-04', timeZone: 'UTC' }).performance.netPnlUsd, -12)
})

test('quiet days stay on the chart time axis and bucket totals match selected results', () => {
  const selected = selectBrokerHistory(history, { connectionId: 'btc', timeZone: 'UTC' })
  const bars = brokerHistoryBars(selected.orders, 'day', 'UTC')
  assert.equal(bars.length, 4)
  assert.equal(bars[1].volumeUsd, 0)
  assert.equal(bars.reduce((sum, bar) => sum + bar.netPnlUsd, 0), selected.performance.netPnlUsd)
  assert.equal(bars.reduce((sum, bar) => sum + bar.volumeUsd, 0), selected.totals.notionalUsd)
})
test('external settlements still prevent pairing a later unrelated close', () => {
  const selected = selectBrokerHistory({ ...history, externalSettlements: [{ intentId: 'external', connectionId: 'btc', connectionLabel: 'BTC', symbol: 'BTC-USDT', direction: 'LONG', settledAt: '2026-10-02T00:00:00Z' }] }, { connectionId: 'btc', start: '2026-10-04', end: '2026-10-04', timeZone: 'UTC' })
  assert.equal(selected.performance.closedTradeCount, 0)
  assert.equal(selected.performance.unmatchedCloseCount, 1)
  assert.equal(selected.externalSettlements.length, 0)
})

test('late reconciliation does not shift an executed order into another reporting day', () => {
  const selected = selectBrokerHistory({ ...history, orders: [order({
    submittedAt: '2026-10-03T12:00:00Z', createdAt: '2026-10-03T11:59:00Z',
    reconciledAt: '2026-10-05T12:00:00Z', lastFillAt: null,
  })] }, { start: '2026-10-03', end: '2026-10-03', timeZone: 'UTC' })
  assert.equal(selected.orders.length, 1)
})
