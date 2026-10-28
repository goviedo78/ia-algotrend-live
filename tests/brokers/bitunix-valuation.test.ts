import assert from 'node:assert/strict'
import test from 'node:test'
import { valueOpenPositions } from '../../src/lib/brokers/open-position-valuation'
import type { BrokerOpenPositionSummary } from '../../src/lib/brokers/order-history-types'

function position(broker: string, symbol: string): BrokerOpenPositionSummary {
  return {
    key: `${broker}:${symbol}`, connectionId: broker, connectionLabel: broker, broker,
    environment: 'LIVE', strategyCode: 'ALGOTREND_BTC_1H', strategyLabel: 'BTC 1H',
    timeframe: '1h', externalSignalId: 'signal-1', symbol, direction: 'LONG',
    quantity: 0.001, averageEntryPrice: 60000, notionalUsd: 60, entryFeesUsd: 0,
    openedAt: '2026-10-28T00:00:00Z', markPrice: null, unrealizedGrossPnlUsd: null,
    unrealizedNetPnlUsd: null, unrealizedReturnPct: null, pricedAt: null,
  }
}

test('BingX and Bitunix positions use their own market even for identical symbols', async () => {
  const original = globalThis.fetch
  const hosts: string[] = []
  globalThis.fetch = async url => {
    const host = new URL(String(url)).hostname
    hosts.push(host)
    return host === 'fapi.bitunix.com'
      ? Response.json({ code: 0, data: [{ symbol: 'BTCUSDT', lastPrice: '62000' }] })
      : Response.json({ code: 0, data: { price: '61000' } })
  }
  try {
    const result = await valueOpenPositions([position('BINGX', 'BTC-USDT'), position('BITUNIX', 'BTC-USDT')])
    assert.deepEqual(result.map(item => item.markPrice), [61000, 62000])
    assert.deepEqual(hosts.sort(), ['fapi.bitunix.com', 'open-api.bingx.com'])
  } finally { globalThis.fetch = original }
})

test('a Bitunix outage leaves BingX history usable and never falls back to BingX prices', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async url => {
    if (String(url).includes('fapi.bitunix.com')) throw new Error('Bitunix unavailable')
    return Response.json({ code: 0, data: { price: '3000' } })
  }
  try {
    const result = await valueOpenPositions([position('BINGX', 'ETH-USDT'), position('BITUNIX', 'ETH-USDT')])
    assert.equal(result[0].markPrice, 3000)
    assert.equal(result[1].markPrice, null)
  } finally { globalThis.fetch = original }
})
