import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateOpenTradeAgainstCandle } from '../src/lib/trade-management'

// Velas reales de Bitstamp BTC/USD 1h del 2026-09-03, la fuente que usa el motor.
const candle14h = { time: 1788444000, open: 78820.99, high: 80557.46, low: 78685.73, close: 80538.84, volume: 0 }
const candle15h = { time: 1788447600, open: 80534.52, high: 80995.30, low: 80356.40, close: 80903.11, volume: 0 }

// AlgoTrend #358: entró al cierre de la vela de las 14:00, con stop 2% abajo.
const trade358 = {
  direction: 'LONG' as const,
  signalTime: 1788444000,
  openPrice: 80538.84,
  stopLoss: 78923.0632,
  takeProfit: 82962.5052,
}

test('the entry candle never closes the trade it just opened', () => {
  // El caso real: la vela de entrada recorrió 78685.73 → 80557.46 (+2.38%) y entró al cierre,
  // en 80538.84. Su mínimo quedó por debajo del stop, pero ocurrió ANTES de que el trade
  // existiera. El cron reanaliza esa misma vela durante toda la hora siguiente, y sin este
  // corte cerraba la operación con un −2% que nunca pasó.
  assert.ok(candle14h.low < trade358.stopLoss)
  assert.deepEqual(evaluateOpenTradeAgainstCandle(trade358, candle14h), { kind: 'BEFORE_ENTRY' })
})

test('the next candle does manage the trade', () => {
  // La vela de las 15:00 nunca se acercó al stop y el trade quedó arriba: sigue vivo, y como
  // no llegó al gatillo del trailing (+1%) tampoco mueve nada.
  assert.deepEqual(evaluateOpenTradeAgainstCandle(trade358, candle15h), { kind: 'HOLD' })
})

test('a genuine stop on a later candle still closes at the stop price', () => {
  const stopped = evaluateOpenTradeAgainstCandle(trade358, {
    ...candle15h,
    low: 78000,
    close: 78500,
  })
  assert.deepEqual(stopped, { kind: 'CLOSE', reason: 'SL', closePrice: trade358.stopLoss })
})

test('the trailing stop still arms above the trigger and gives up the take profit', () => {
  // +1.5% sobre la entrada dispara el trailing: stop a 0.3% del máximo y sin objetivo fijo.
  const high = trade358.openPrice * 1.015
  const trailed = evaluateOpenTradeAgainstCandle(trade358, {
    ...candle15h,
    high,
    low: trade358.openPrice,
    close: high * 0.999,
  })
  assert.equal(trailed.kind, 'TRAIL')
  assert.equal(trailed.kind === 'TRAIL' && trailed.takeProfit, null)
  assert.equal(trailed.kind === 'TRAIL' && trailed.stopLoss, high * (1 - 0.3 / 100))
})

test('a short is managed with the mirrored boundaries', () => {
  const short = {
    direction: 'SHORT' as const,
    signalTime: 1788444000,
    openPrice: 80000,
    stopLoss: 81600,
    takeProfit: 77600,
  }
  assert.deepEqual(evaluateOpenTradeAgainstCandle(short, candle14h), { kind: 'BEFORE_ENTRY' })
  assert.deepEqual(
    evaluateOpenTradeAgainstCandle(short, { ...candle15h, high: 81700, close: 81000 }),
    { kind: 'CLOSE', reason: 'SL', closePrice: 81600 },
  )
})
