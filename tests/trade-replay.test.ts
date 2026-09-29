import assert from 'node:assert/strict'
import test from 'node:test'
import { replayOpenTrade, type ManagedTrade } from '../src/lib/trade-management'

// #363: SHORT, señal en la vela 2026-09-24 03:00 UTC, velas reales de Bitstamp BTC/USD 1h.
// Stop y TP iniciales son los que el motor calcula en la vela de la señal.
const SIGNAL = 1790218800
const trade363: ManagedTrade = { direction: 'SHORT', signalTime: SIGNAL, openPrice: 83924.56, stopLoss: 85608.0512, takeProfit: 81399.3232 }
const candles = [
  { time: 1790222400, open: 83924.56, high: 84024.55, low: 83765.31, close: 84023.24, volume: 40.8 },
  { time: 1790226000, open: 84023.25, high: 84378.16, low: 83960.01, close: 83972.96, volume: 65.7 },
  { time: 1790229600, open: 83972.96, high: 84202.05, low: 83903.66, close: 84101.47, volume: 32.7 },
  { time: 1790233200, open: 84092.33, high: 84589.27, low: 83943.93, close: 84521.6, volume: 54.3 },
  { time: 1790236800, open: 84517.47, high: 84601.2, low: 83250, close: 83619.15, volume: 117.7 },
  { time: 1790240400, open: 83635.87, high: 83692.49, low: 82873.04, close: 83236.23, volume: 161.9 },
  { time: 1790244000, open: 83242.89, high: 83538.92, low: 83130.97, close: 83489.38, volume: 67.2 },
]

test('candles the cron skipped are all applied, in order', () => {
  // El cron no corrió entre las 04:32 y las 17:35: una sola corrida tiene que ver las 7 velas.
  const decision = replayOpenTrade(trade363, SIGNAL, candles)
  assert.deepEqual(decision, { kind: 'CLOSE', candleTime: 1790240400, reason: 'SL', closePrice: 83236.23 })
})

test('hourly runs reach the same close as one run over the gap', () => {
  let state = { ...trade363 }
  let managed: number | null = SIGNAL
  let closed: unknown = null
  for (let i = 1; i <= candles.length && !closed; i++) {
    // Cuatro corridas por hora sobre la misma vela cerrada.
    for (let run = 0; run < 4 && !closed; run++) {
      const decision = replayOpenTrade(state, managed, candles.slice(0, i))
      if (decision.kind === 'CLOSE') closed = decision
      if (decision.kind === 'MANAGED') {
        state = { ...state, stopLoss: decision.stopLoss, takeProfit: decision.takeProfit }
        managed = decision.lastManagedTime
      }
    }
  }
  assert.deepEqual(closed, { kind: 'CLOSE', candleTime: 1790240400, reason: 'SL', closePrice: 83236.23 })
})

test('a candle already applied is never evaluated again', () => {
  // Con el trailing ya movido por esta vela, reevaluarla "tocaba" el stop nuevo con su mecha.
  const trailed = { ...trade363, stopLoss: 83500, takeProfit: null }
  assert.deepEqual(replayOpenTrade(trailed, 1790236800, candles.slice(0, 5)), { kind: 'NOTHING_NEW' })
})

test('the entry candle is never managed', () => {
  assert.deepEqual(replayOpenTrade(trade363, SIGNAL, [{ ...candles[0], time: SIGNAL }]), { kind: 'NOTHING_NEW' })
})

test('a trade opened before the marker keeps the old rule on its first run', () => {
  const decision = replayOpenTrade(trade363, null, candles.slice(0, 3))
  assert.equal(decision.kind, 'MANAGED')
  assert.equal(decision.kind === 'MANAGED' && decision.lastManagedTime, candles[2].time)
})
