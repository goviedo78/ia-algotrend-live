import assert from 'node:assert/strict'
import test from 'node:test'
import { readAllHistoryRows, readHistoryByIds } from '../../src/lib/brokers/history-pagination'
import { loadBrokerOrderHistory } from '../../src/lib/brokers/order-history'

test('pagination reads beyond the server row cap, including children, and propagates errors', async () => {
  const rows = Array.from({ length: 1207 }, (_, id) => ({ id }))
  const query = { range: async (from: number, to: number) => ({ data: rows.slice(from, Math.min(to + 1, from + 137)), error: null }) }
  assert.deepEqual(await readAllHistoryRows(query), rows)
  const ids = Array.from({ length: 203 }, (_, i) => String(i))
  const result = await readHistoryByIds(ids, batch => ({ range: async (from, to) => ({ data: batch.slice(from, to + 1), error: null }) }))
  assert.deepEqual(result.data, ids)
  await assert.rejects(readAllHistoryRows({ range: async () => ({ data: null, error: new Error('database unavailable') }) }), /database unavailable/)
})

test('real history loader keeps all 602 cycles, their entry costs and user scope', async () => {
  const originalFetch = globalThis.fetch
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://history-fixture.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-fixture-key'
  const rows = Array.from({ length: 1204 }, (_, i) => ({
    id: `order-${i}`, user_id: 'holder', connection_id: 'btc', intent_id: `intent-${i}`,
    client_order_id: `client-${i}`, broker_order_id: `broker-${i}`, symbol: 'BTC-USDT',
    side: i % 2 ? 'SELL' : 'BUY', position_side: 'LONG', reduce_only: !!(i % 2),
    requested_quantity: 1, filled_quantity: 1, average_price: i % 2 ? 120 : 100,
    notional_usd: i % 2 ? 120 : 100, fee_usd: 1, status: 'FILLED', submitted_at: null, reconciled_at: null,
    created_at: new Date(Date.UTC(2026, 0, 1) + i * 3600000).toISOString(), updated_at: new Date(Date.UTC(2026, 0, 1) + i * 3600000).toISOString(),
  })).reverse()
  const idsIn = (url: URL, field: string) => (url.searchParams.get(field) ?? '').replace(/^in\.(\(|\[)/, '').replace(/[)\]]$/, '').split(',').map(s => s.replaceAll('"', ''))
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    const table = url.pathname.split('/').at(-1)
    let data: unknown[] = []
    if (table === 'broker_orders') {
      assert.equal(url.searchParams.get('user_id'), 'eq.holder')
      data = rows
    }
    if (table === 'broker_order_intents' && !url.searchParams.has('status')) data = idsIn(url, 'id').map(id => ({ id, action: Number(id.split('-')[1]) % 2 ? 'CLOSE' : 'OPEN', direction: 'LONG', signal_id: 'signal' }))
    if (table === 'broker_signals') data = [{ id: 'signal', external_signal_id: 'btc', strategy_code: 'ALGOTREND_BTC_1H', timeframe: '1h', signal_time: '2026-01-01T00:00:00Z' }]
    if (table === 'broker_connections') data = [{ id: 'btc', label: 'BTC', broker: 'BINGX', environment: 'DEMO', requested_strategy_code: 'ALGOTREND_BTC_1H' }]
    const offset = Number(url.searchParams.get('offset') ?? 0)
    // Simulate a configurable API row cap, smaller than the requested page.
    data = data.slice(offset, offset + Math.min(211, Number(url.searchParams.get('limit') ?? 1000)))
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const history = await loadBrokerOrderHistory({ userId: 'holder' })
    assert.equal(history.orders.length, 1204)
    assert.equal(history.performance.closedTradeCount, 602)
    assert.equal(history.performance.netPnlUsd, 602 * 18)
    assert.equal(history.totals.netReturnPct, 18)
    assert.equal(history.openPositions.length, 0)
  } finally {
    globalThis.fetch = originalFetch
    if (originalUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    if (originalKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
  }
})
