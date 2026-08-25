import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { evaluateRisk } from '../../src/lib/brokers/risk'
import type { RiskPolicy } from '../../src/lib/brokers/domain'

const root = path.resolve(import.meta.dirname, '../..')

const policy: RiskPolicy = {
  enabled: true,
  allowedSymbols: ['BTC-USDT'],
  sizingMode: 'FIXED_NOTIONAL',
  fixedNotionalUsd: 8,
  maxNotionalPerOrderUsd: 8,
  maxTotalExposureUsd: 8,
  maxLeverage: 1,
  maxOpenPositions: 1,
  maxOrdersPerMinute: 2,
  dailyLossLimitUsd: 3,
  minAvailableMarginUsd: 0,
  closeOnlyWhenSuspended: true,
  declaredCapitalUsd: 100,
  riskProfile: 'MODERATE',
  exposurePerOrderPct: 8,
  maxTotalExposurePct: 16,
  dailyLossLimitPct: 3,
  marginReservePct: 0,
  suggestedNotionalPerOrderUsd: 8,
  suggestedMaxTotalExposureUsd: 16,
  suggestedDailyLossLimitUsd: 3,
  suggestedMinAvailableMarginUsd: 0,
  version: 2,
}

const rules = {
  symbol: 'BTC-USDT',
  quantityStep: 0.0001,
  quantityPrecision: 4,
  pricePrecision: 2,
  minimumQuantity: 0.0001,
  maximumQuantity: 100,
  minimumNotional: 1,
  maximumLongLeverage: 20,
  maximumShortLeverage: 20,
  openEnabled: true,
  closeEnabled: true,
}

const stillHeldLong = [{
  symbol: 'BTC-USDT', direction: 'LONG' as const, quantity: 0.0002, availableQuantity: 0.0002,
  entryPrice: 40_000, markPrice: 40_000, leverage: 1, unrealizedPnl: 0,
}]

function openShort(overrides: Partial<Parameters<typeof evaluateRisk>[0]> = {}) {
  return evaluateRisk({
    action: 'OPEN', direction: 'SHORT', symbol: 'BTC-USDT', price: 40_000,
    sizingCapitalUsd: 100, availableMargin: 100, rules, policy, ordersLastMinute: 0,
    realizedPnlTodayUsd: 0, openingFeeRate: 0, connectionStatus: 'ACTIVE',
    positions: [], ownedPositions: [],
    ...overrides,
  })
}

// Las dos ventanas por las que un reverso (cerrar y abrir al toque en sentido contrario) moría.
// Ambas son 422 terminales: sin el gate del worker el reverso se perdía para siempre.

test('reversal window A: books still own the closed position and the engine hits the position limit', () => {
  assert.throws(() => openShort({
    positions: stillHeldLong,
    ownedPositions: [{ symbol: 'BTC-USDT', direction: 'LONG', quantity: 0.0002 }],
  }), { code: 'RISK_POSITION_LIMIT' })
})

test('reversal window B: books already closed it but the broker still reports it as foreign', () => {
  assert.throws(() => openShort({
    positions: stillHeldLong,
    ownedPositions: [],
  }), { code: 'RISK_FOREIGN_OPPOSITE_POSITION' })
})

test('once the close settles at the broker the opposite open goes through untouched', () => {
  const approved = openShort({ positions: [], ownedPositions: [] })
  assert.equal(approved.side, 'SELL')
  assert.equal(approved.direction, 'SHORT')
  assert.equal(approved.reduceOnly, false)
  assert.equal(approved.quantity, 0.0002)
})

test('the worker waits for close settlement instead of burning the reversal', async () => {
  const worker = await readFile(path.join(root, 'src/lib/brokers/worker.ts'), 'utf8')

  // El gate corre ANTES de evaluar riesgo: si evaluara después, el rechazo ya sería terminal.
  const gateIndex = worker.indexOf('POSITION_SETTLEMENT_PENDING')
  const evaluateIndex = worker.indexOf('const approved = evaluateRisk(')
  assert.ok(gateIndex > 0 && evaluateIndex > 0 && gateIndex < evaluateIndex)

  // Sólo aplica a aperturas y sólo si el broker todavía muestra posición en ese símbolo.
  assert.match(worker, /if \(intent\.action === 'OPEN'\)/)
  assert.match(worker, /const symbolStillHeld = positions\.some/)
  assert.match(worker, /symbolStillHeld && await closeIsStillSettling\(/)

  // Reintentable (503, true) para que el job vuelva con backoff en vez de morir en 422.
  assert.match(worker, /'El cierre anterior todavía se está asentando en el broker; la reapertura reintenta\.',\s*503,\s*true,/)

  // Detecta tanto un cierre en vuelo como uno recién asentado dentro de la ventana de gracia.
  assert.match(worker, /\.eq\('action', 'CLOSE'\)[\s\S]*\.in\('status', IN_FLIGHT_INTENT_STATUSES\)/)
  assert.match(worker, /\.eq\('reduce_only', true\)[\s\S]*\.gte\('submitted_at'/)

  // Esperar no es rechazar: la intención vuelve a QUEUED, nunca a UNKNOWN ni a RISK_REJECTED.
  assert.match(worker, /error\.code === 'POSITION_SETTLEMENT_PENDING'\s*\?\s*'QUEUED'/)
  assert.doesNotMatch(worker, /POSITION_SETTLEMENT_PENDING[\s\S]{0,80}RISK_REJECTED/)
})
