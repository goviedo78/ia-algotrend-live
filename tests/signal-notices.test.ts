import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluatePrealert, triggerNotice, formatNotice, deliverOnce } from '../src/lib/signal-notices'
import { runAlgoTrend, type AlgoTrendResult, type Candle } from '../src/lib/algotrend'
import type { Trade } from '../src/lib/db'

const time = 1793239200
const candles: Candle[] = Array.from({ length: 1300 }, (_, i) => ({ time: time - (1299 - i) * 3600, open: 100, high: 102, low: 99, close: 101, volume: 1 }))
const result: AlgoTrendResult = { time, close: 101, supertrend: 99, stDirection: -1, lastStDir: 1, probUp: .9, probDown: .1, longSig: true, shortSig: false, longStop: 98, longTp: 104, shortStop: 104, shortTp: 98, atrVal: 1 }
const trade: Trade = { id: 17, direction: 'LONG', signal_time: time - 7200, open_time: time - 7200, open_price: 100, stop_loss: 98, take_profit: 104, atr_pct: 1, close_time: null, close_price: null, close_reason: null, pnl_pct: null, pnl_usd: null, status: 'OPEN' }
const base = { candles, now: time + 57 * 60, atrFilterOn: false, atrThreshold: .4, openTrade: null, run: () => [result] }

test('only full-engine provisional signals near candle close generate prealerts', () => {
  const notice = evaluatePrealert(base)!
  assert.equal(notice.direction, 'LONG')
  assert.equal(notice.validUntil, time + 3600)
  assert.match(formatNotice(notice), /CONDICIONES FAVORABLES · 🟢 COMPRA/)
  assert.match(formatNotice(notice), /Señal sin confirmar/)
  assert.equal(formatNotice(notice).split('\n').length, 5)
  assert.doesNotMatch(formatNotice(notice), /Con los datos actuales|Si se mantienen|Puede desaparecer/)
  assert.match(formatNotice(notice), /90.0%/)
  assert.doesNotMatch(formatNotice(notice), /sobre \$|debajo de \$/)
  const short = evaluatePrealert({ ...base, run: () => [{ ...result, longSig: false, shortSig: true, probUp: .1, probDown: .9 }] })!
  assert.equal(short.direction, 'SHORT')
  assert.match(formatNotice(short), /🔴 VENTA/)
})

test('missing transitions, ATR blocking, same-side positions and incomplete/stale candles stay silent', () => {
  assert.equal(evaluatePrealert({ ...base, run: () => [{ ...result, longSig: false }] }), null)
  assert.equal(evaluatePrealert({ ...base, atrFilterOn: true, atrThreshold: 20 }), null)
  assert.equal(evaluatePrealert({ ...base, openTrade: trade }), null)
  assert.equal(evaluatePrealert({ ...base, now: time + 47 * 60 }), null)
  assert.equal(evaluatePrealert({ ...base, now: time + 3600 }), null)
  assert.equal(evaluatePrealert({ ...base, now: time + 3590 }), null)
  assert.equal(evaluatePrealert({ ...base, candles: candles.slice(-100) }), null)
  assert.equal(evaluatePrealert({ ...base, candles: candles.slice(0, -1) }), null)
  assert.equal(evaluatePrealert({ ...base, candles: candles.map((c, i) => i === candles.length - 1 ? { ...c, close: NaN } : c) }), null)
  assert.equal(evaluatePrealert({ ...base, run: () => [{ ...result, shortSig: true }] }), null)
  const notice = evaluatePrealert({ ...base, openTrade: { ...trade, direction: 'SHORT' } })!
  assert.match(formatNotice(notice), /Posible giro de VENTA a COMPRA/)
  assert.equal(formatNotice(notice).split('\n').length, 6)
})

test('trigger notices require a persisted transition into a protective trailing stop', () => {
  const updated = { ...trade, stop_loss: 100.7, take_profit: null, last_managed_time: time }
  const notice = triggerNotice(trade, updated)!
  assert.match(formatNotice(notice), /TRIGGER ACTIVADO/)
  assert.match(formatNotice(notice), /Stop móvil: \$100.70/)
  assert.match(formatNotice(notice), /continúa abierta/)
  assert.equal(triggerNotice(updated, updated), null)
  assert.equal(triggerNotice(trade, { ...updated, status: 'CLOSED' }), null)
  assert.equal(triggerNotice(trade, { ...updated, stop_loss: 98 }), null)
  assert.equal(triggerNotice(trade, { ...updated, id: 18 }), null)
  assert.ok(triggerNotice({ ...trade, direction: 'SHORT', stop_loss: 102 }, { ...updated, direction: 'SHORT', stop_loss: 99.3 }))
})

test('atomic reservation prevents concurrent duplicates, expiry and ambiguous sends are never retried', async () => {
  const notice = evaluatePrealert(base)!
  const keys = new Set<string>()
  let sends = 0
  const states: string[] = []
  const deps = { claim: async (key: string) => { if (keys.has(key)) return false; keys.add(key); return true }, finish: async (_key: string, state: string) => { states.push(state) }, send: async () => { sends++; return { status: 'unknown' as const } }, now: () => base.now }
  await Promise.all(Array.from({ length: 8 }, () => deliverOnce('channel', notice, deps)))
  assert.equal(sends, 1)
  assert.deepEqual(states, ['unknown'])
  await deliverOnce('channel', notice, deps)
  assert.equal(sends, 1)
  await deliverOnce('another-channel', notice, { ...deps, now: () => notice.validUntil! })
  assert.equal(sends, 1)
})

test('reservation failure prevents sending, and expiry after a claim is recorded without publishing', async () => {
  const notice = evaluatePrealert(base)!
  let sends = 0
  let now = base.now
  const states: string[] = []
  const deps = { now: () => now, claim: async () => { now = notice.validUntil!; return true },
    finish: async (_key: string, state: string) => { states.push(state) }, send: async () => { sends++; return { status: 'sent' as const, messageId: 1 } } }
  await deliverOnce('channel', notice, deps)
  assert.equal(sends, 0)
  assert.deepEqual(states, ['expired'])
  now = base.now
  await assert.rejects(deliverOnce('channel', notice, { ...deps, claim: async () => { throw new Error('database down') } }), /database down/)
  assert.equal(sends, 0)
})

test('prealert results match the actual engine and prior candles do not change when an open candle is included', () => {
  const rows: Candle[] = Array.from({ length: 2600 }, (_, i) => {
    const open = 80000 + 4000 * Math.sin((i - 1) / 45)
    const close = 80000 + 4000 * Math.sin(i / 45)
    return { time: time - (2599 - i) * 3600, open, close, high: Math.max(open, close) + 80, low: Math.min(open, close) - 80, volume: 20 }
  })
  const engine = runAlgoTrend(rows)
  const candidates = engine.map((r, i) => ({ r, i })).filter(({ r }) => r.longSig || r.shortSig).slice(-3)
  assert.ok(candidates.some(({ r }) => r.longSig))
  assert.ok(candidates.some(({ r }) => r.shortSig))
  for (const { r, i } of candidates) {
    const prefix = rows.slice(0, i + 1)
    const notice = evaluatePrealert({ candles: prefix, now: r.time + 57 * 60, atrFilterOn: false, atrThreshold: .4, openTrade: null })!
    assert.equal(notice.direction, r.longSig ? 'LONG' : 'SHORT')
    assert.equal(notice.probabilityPct, (r.longSig ? r.probUp : r.probDown) * 100)
    assert.deepEqual(runAlgoTrend(prefix.slice(0, -1)), engine.slice(0, i))
  }
})
