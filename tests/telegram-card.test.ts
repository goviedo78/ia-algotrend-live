import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderTradeCard, tradeCardElement } from '../src/lib/telegram-card'
import type { Trade } from '../src/lib/db'

function textOf(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

const sample: Trade = {
  id: 90, direction: 'LONG', signal_time: 1793000000, open_time: 1793000000,
  open_price: 80000, stop_loss: 78400, take_profit: 82400,
  close_time: 1793028800, close_price: 81000, close_reason: 'SL',
  pnl_pct: 1.25, pnl_usd: 1000, atr_pct: null, status: 'CLOSED',
}

test('entry image includes entry risk data for buys and sells', async () => {
  for (const direction of ['LONG', 'SHORT'] as const) {
    const data = { event: 'OPEN' as const, trade: { ...sample, direction }, recent: [sample] }
    const text = textOf(tradeCardElement(data))
    assert.match(text, /ENTRADA/)
    assert.match(text, direction === 'LONG' ? /COMPRA/ : /VENTA/)
    assert.match(text, /BTC · 1H/)
    assert.match(text, /CDMX/)
    assert.match(text, /Entrada: \$80,000\.00/)
    assert.match(text, /SL \(Stop loss\): \$78,400\.00/)
    assert.match(text, /TP \(Objetivo\): \$82,400\.00/)
    assert.match(text, /ATR: —/)
    assert.doesNotMatch(text, /PNL|aciertos|#|GONOVI|DEMO|LONG|SHORT/)
    const png = Buffer.from(await renderTradeCard(data))
    assert.equal(png.readUInt32BE(20), 900)
  }
})

test('close image puts duration and result above the last five and their accumulated PnL', () => {
  const text = textOf(tradeCardElement({ event: 'CLOSE', trade: sample, recent: [sample] }))
  assert.match(text, /CIERRE/)
  assert.match(text, /Motivo: Stop loss \(SL\)/)
  assert.match(text, /DURACIÓN DE LA OPERACIÓN 8 h/)
  assert.match(text, /OPERACIÓN GANADA \+1.25%/)
  assert.ok(text.indexOf('DURACIÓN DE LA OPERACIÓN') < text.indexOf('ÚLTIMAS'))
  assert.ok(text.indexOf('ÚLTIMAS') < text.indexOf('PNL ACUMULADO'))
  assert.match(text, /Entrada: \$80,000\.00/)
  assert.match(text, /Cierre: \$81,000\.00/)
  assert.doesNotMatch(text, /Objetivo|Salida \$/)
})

test('the real renderer generates a PNG scorecard without a browser or external assets', async () => {
  const bytes = await renderTradeCard({ event: 'SUMMARY', recent: [] })
  const png = Buffer.from(bytes)
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(png.readUInt32BE(16), 1080)
  assert.equal(png.readUInt32BE(20), 1500)
  assert.ok(bytes.length < 10_000_000)
})

test('a five-trade exit card reserves extra height for event prices and footer', async () => {
  const rows: Trade[] = Array.from({ length: 5 }, (_, i) => ({
    id: i, direction: 'SHORT', signal_time: 1793000000, open_time: 1793000000,
    open_price: 80000, stop_loss: 81600, take_profit: null,
    close_time: 1793003600, close_price: 79000, close_reason: 'SIGNAL',
    pnl_pct: 1.25, pnl_usd: 1000, atr_pct: null, status: 'CLOSED',
  }))
  const png = Buffer.from(await renderTradeCard({ event: 'CLOSE', trade: rows[0], recent: rows }))
  assert.equal(png.readUInt32BE(16), 1080)
  assert.equal(png.readUInt32BE(20), 1660)
})

test('entry image shows trailing targets and the same signal probability as its caption', async () => {
  const data = { event: 'OPEN' as const, recent: null,
    trade: { ...sample, direction: 'SHORT' as const, stop_loss: 81600, take_profit: null, atr_pct: 0.437 }, probabilityPct: 73.45 }
  const text = textOf(tradeCardElement(data))
  assert.match(text, /SL \(Stop loss\): \$81,600\.00/)
  assert.match(text, /TP \(Objetivo\): Stop móvil/)
  assert.match(text, /ATR: 0.44%/)
  assert.match(text, /Probabilidad de señal: 73.5%/)
  const png = Buffer.from(await renderTradeCard(data))
  assert.equal(png.readUInt32BE(20), 900)
})

test('trigger exit image uses replay evidence even before the saved TP has been cleared', () => {
  const text = textOf(tradeCardElement({ event: 'CLOSE', trade: sample, recent: [sample], trailingStopActive: true }))
  assert.match(text, /Motivo: Stop móvil \(trigger activado\)/)
  assert.match(text, /OPERACIÓN GANADA/)
})
