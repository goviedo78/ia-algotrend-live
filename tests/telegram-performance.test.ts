import test from 'node:test'
import assert from 'node:assert/strict'
import type { Trade } from '../src/lib/db'
import { getPerformanceWindow, elapsedPeriod, localTradeDate, formatCardCaption, operationDuration } from '../src/lib/telegram-performance'

function trade(id: number, pnl: number | null, open: number, close: number | null): Trade {
  return { id, direction: 'LONG', open_time: open, signal_time: open, open_price: 100,
    stop_loss: 98, take_profit: 103, close_time: close, close_price: close === null ? null : 101,
    close_reason: close === null ? null : 'SIGNAL', pnl_pct: pnl, pnl_usd: pnl,
    atr_pct: null, status: close === null ? 'OPEN' : 'CLOSED' }
}

test('five-trade headline uses exact compounded return, win rate and entry-to-final-close period', () => {
  const pnls = [0.782757573652991, -1.36945558923848, 1.61138441675221, 1.45198647630322, 0.723636935168922]
  const start = Date.parse('2026-10-07T01:00:00Z') / 1000
  const end = Date.parse('2026-10-22T16:00:00Z') / 1000
  const trades = pnls.map((pnl, i) => trade(i + 1, pnl, start + i * 86400, i === 4 ? end : start + i * 86400 + 3600))
  const result = getPerformanceWindow(trades)
  assert.ok(Math.abs(result.compoundedPct! - 3.2124269001587047) < 1e-10)
  assert.equal(result.winRate, 80)
  assert.equal(result.wins, 4)
  assert.equal(result.startTime, start)
  assert.equal(result.endTime, end)
  assert.equal(elapsedPeriod(result.elapsedSeconds!), '15 días y 15 h')
  assert.match(localTradeDate(start), /06.*oct.*2026.*19:00/)
})

test('an open trade is not counted as a win and the five most recent closed trades are chosen', () => {
  const rows = Array.from({ length: 7 }, (_, i) => trade(i, i, 1000 + i * 100, 1050 + i * 100))
  const open = trade(8, null, 3000, null)
  const result = getPerformanceWindow([...rows, open])
  assert.deepEqual(result.trades.map(t => t.id), [6, 5, 4, 3, 2])
  assert.equal(result.winRate, 100)
  assert.equal(result.openCount, 1)
})

test('closed event replaces stale open row, duplicates do not change metrics and ties sort by ID', () => {
  const closed = trade(2, -1, 1000, 2000)
  const result = getPerformanceWindow([trade(2, null, 1000, null), trade(1, 1, 1000, 1500)], closed)
  assert.deepEqual(result.trades.map(t => t.id), [2, 1])
  assert.equal(result.winRate, 50)
  assert.equal(result.openCount, 0)
  assert.ok(result.compoundedPct! < 0)
})

test('breakeven is not a win, and missing results or invalid time windows never produce a headline', () => {
  assert.equal(getPerformanceWindow([trade(1, 0, 1000, 2000)]).winRate, 0)
  assert.equal(getPerformanceWindow([trade(1, null, 1000, 2000)]).compoundedPct, null)
  assert.equal(getPerformanceWindow([trade(1, 1, 2000, 1000)]).elapsedSeconds, null)
  assert.equal(getPerformanceWindow(null).compoundedPct, null)
  assert.deepEqual(getPerformanceWindow(null, trade(1, 1, 1000, 2000)).trades, [])
  assert.equal(getPerformanceWindow([]).winRate, null)
})

test('summary caption is brief and leaves detailed dates and trades in the image', () => {
  const recent = Array.from({ length: 5 }, (_, i) => trade(100 + i, 1, 1793000000 + i * 3600, 1793003000 + i * 3600))
  const caption = formatCardCaption({ event: 'SUMMARY', recent })
  assert.match(caption, /Últimas 5 operaciones: aciertos 100% · PNL acumulado/)
  assert.doesNotMatch(caption, /GONOVI|AlgoTrend|Desde|HASTA|CDMX|#|Reinversión|comisiones/)
  assert.match(caption, /no es una señal nueva/)
  assert.ok(caption.length < 1024)
})

test('entry caption includes prices, risk and ATR without closed-trade statistics', () => {
  const caption = formatCardCaption({ event: 'OPEN', trade: trade(8, null, 1793000000, null), recent: [trade(1, 1, 1792900000, 1792903600)] })
  assert.match(caption, /ENTRADA · 🟢 COMPRA/)
  assert.match(caption, /BTC · 1H/)
  assert.match(caption, /CDMX/)
  assert.equal(caption.split('\n').length, 8)
  assert.match(caption, /Entrada: \$100\.00/)
  assert.match(caption, /SL \(Stop loss\): \$98\.00/)
  assert.match(caption, /TP \(Objetivo\): \$103\.00/)
  assert.match(caption, /ATR: —/)
  assert.match(caption, /Probabilidad de señal: —/)
  assert.doesNotMatch(caption, /PnL|aciertos|#|Demo|LONG/)
})

test('close caption shows operation duration/result before latest trades and accumulated PnL', () => {
  const closed = trade(8, 2, 1793000000, 1793010800)
  const caption = formatCardCaption({ event: 'CLOSE', trade: closed, recent: [closed] })
  assert.match(caption, /CIERRE/)
  assert.match(caption, /^CIERRE · ✅ OPERACIÓN GANADORA \(\+2\.00%\)/)
  assert.match(caption, /Duración: 3 h/)
  assert.match(caption, /Entrada: \$100\.00/)
  assert.match(caption, /Cierre: \$101\.00/)
  assert.ok(caption.indexOf('Duración:') < caption.indexOf('Últimas'))
  assert.match(caption, /Últimas 1 operaciones: aciertos 100% · PNL acumulado \+2\.00% en 3 h/)
  assert.doesNotMatch(caption, /GONOVI|AlgoTrend|BTC\/USD|Resultado:|Desde|CDMX|#|comisiones/)
  assert.equal(operationDuration(trade(9, 1, 1000, 1000 + 25 * 3600 + 30 * 60)), '1 día 1 h 30 min')
  assert.equal(operationDuration(trade(9, null, 1000, null)), '—')
})

test('sale is red and closed outcomes follow PnL, including profitable stops, losses, zero and unavailable', () => {
  const short = { ...trade(1, null, 1793000000, null), direction: 'SHORT' as const }
  assert.match(formatCardCaption({ event: 'OPEN', trade: short, recent: null }), /🔴 VENTA/)
  for (const [pnl, label] of [[1, '✅ OPERACIÓN GANADORA'], [-1, '❌ OPERACIÓN PERDEDORA'], [0, '⚪ OPERACIÓN SIN CAMBIO'], [null, '⚪ RESULTADO NO DISPONIBLE']] as const) {
    const closed = { ...trade(1, pnl, 1793000000, 1793003600), close_reason: 'SL' as const }
    const caption = formatCardCaption({ event: 'CLOSE', trade: closed, recent: [closed] })
    assert.ok(caption.includes(label))
    assert.match(caption, /Duración: 1 h/)
    assert.match(caption, /PNL acumulado/)
  }
})

test('close caption shows the accumulated period in whole elapsed days without rounding up', () => {
  const closed = trade(1, 1.25, 1793000000, 1793000000 + 15 * 86400 + 15 * 3600)
  const caption = formatCardCaption({ event: 'CLOSE', trade: closed, recent: [closed] })
  assert.match(caption, /PNL acumulado \+1\.25% en 15 días/)
  assert.doesNotMatch(caption.split('\n').at(-1)!, /15 h|16 días/)
  assert.equal(caption.split('\n').length, 7)
})

test('entry risk respects direction, trailing target and unavailable values', () => {
  for (const direction of ['LONG', 'SHORT'] as const) {
    const caption = formatCardCaption({ event: 'OPEN', recent: null,
      trade: { ...trade(1, null, 1793000000, null), direction, stop_loss: direction === 'LONG' ? 98 : 102, take_profit: null, atr_pct: 0.437 } })
    assert.match(caption, /TP \(Objetivo\): Stop móvil/)
    assert.match(caption, /ATR: 0.44%/)
    assert.ok(caption.includes(`SL (Stop loss): $${direction === 'LONG' ? '98.00' : '102.00'}`))
    assert.ok(caption.length < 1024)
  }
})

test('signal probability is supplied in percentage points, never confused with historical win rate', () => {
  const data = { event: 'OPEN' as const, recent: null, trade: trade(1, null, 1793000000, null) }
  assert.match(formatCardCaption({ ...data, probabilityPct: 73.45 }), /Probabilidad de señal: 73.5%/)
  assert.match(formatCardCaption({ ...data, probabilityPct: 0 }), /Probabilidad de señal: 0.0%/)
  for (const probabilityPct of [undefined, NaN, Infinity, -1, 101]) {
    assert.match(formatCardCaption({ ...data, probabilityPct }), /Probabilidad de señal: —/)
  }
  const invalidRisk = { ...data.trade, stop_loss: NaN, take_profit: Infinity, atr_pct: -1 }
  const caption = formatCardCaption({ ...data, trade: invalidRisk })
  assert.match(caption, /SL \(Stop loss\): —/)
  assert.match(caption, /TP \(Objetivo\): —/)
  assert.match(caption, /ATR: —/)
  assert.doesNotMatch(caption, /NaN|Infinity|Stop móvil/)
})

test('close reason distinguishes fixed stop, trailing trigger, TP and signal without using PnL as evidence', () => {
  const base = { ...trade(1, 1, 1793000000, 1793003600), close_reason: 'SL' as const }
  const caption = (row: Trade, trailingStopActive?: boolean) => formatCardCaption({ event: 'CLOSE', trade: row, recent: [row], trailingStopActive })
  assert.match(caption(base), /Motivo: Stop loss \(SL\)/)
  assert.match(caption({ ...base, take_profit: null, stop_loss: 100.5 }), /Motivo: Stop móvil \(trigger activado\)/)
  assert.match(caption({ ...base, direction: 'SHORT', take_profit: null, stop_loss: 99.5 }), /Motivo: Stop móvil \(trigger activado\)/)
  assert.match(caption({ ...base, take_profit: null, stop_loss: 98 }), /Motivo: Stop loss \(SL\)/)
  assert.match(caption(base, true), /Motivo: Stop móvil \(trigger activado\)/)
  assert.match(caption({ ...base, close_reason: 'TP' }), /Motivo: Take profit \(TP\)/)
  assert.match(caption({ ...base, close_reason: 'SIGNAL' }, true), /Motivo: Cambio de señal/)
})
