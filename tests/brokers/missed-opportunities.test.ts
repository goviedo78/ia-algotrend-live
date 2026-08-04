import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { buildMissedOpportunities, computeMissedResult, rejectionReason } from '../../src/lib/brokers/missed-opportunities'

const root = path.resolve(import.meta.dirname, '../..')

test('a rejected long reports the gain it missed, a rejected short reports the inverted move', () => {
  const long = computeMissedResult({ direction: 'LONG', entryPrice: 100, exitPrice: 103, notionalUsd: 50 })
  assert.equal(long.outcome, 'WIN')
  assert.equal(long.missedReturnPct, 3)
  assert.equal(long.missedGrossPnlUsd, 1.5)

  // El mismo movimiento de precio es pérdida para un LONG y ganancia para un SHORT.
  const short = computeMissedResult({ direction: 'SHORT', entryPrice: 100, exitPrice: 97, notionalUsd: 50 })
  assert.equal(short.outcome, 'WIN')
  assert.equal(short.missedReturnPct, 3)
  assert.equal(short.missedGrossPnlUsd, 1.5)

  const losing = computeMissedResult({ direction: 'LONG', entryPrice: 100, exitPrice: 94, notionalUsd: 200 })
  assert.equal(losing.outcome, 'LOSS')
  assert.equal(losing.missedReturnPct, -6)
  assert.equal(losing.missedGrossPnlUsd, -12)
})

test('an open the strategy has not closed yet stays pending instead of inventing a result', () => {
  const pending = computeMissedResult({ direction: 'LONG', entryPrice: 100, exitPrice: null, notionalUsd: 50 })
  assert.equal(pending.outcome, 'PENDING')
  assert.equal(pending.missedReturnPct, null)
  assert.equal(pending.missedGrossPnlUsd, null)

  // Sin precio de referencia en la señal tampoco se puede calcular nada.
  const priceless = computeMissedResult({ direction: 'LONG', entryPrice: null, exitPrice: 120, notionalUsd: 50 })
  assert.equal(priceless.outcome, 'PENDING')

  // Sin lotaje conocido el porcentaje sigue siendo exacto; sólo falta el importe.
  const noNotional = computeMissedResult({ direction: 'LONG', entryPrice: 100, exitPrice: 110, notionalUsd: null })
  assert.equal(noNotional.missedReturnPct, 10)
  assert.equal(noNotional.missedGrossPnlUsd, null)
})

test('insufficient margin is reported to the holder as "sin fondos"', () => {
  assert.match(rejectionReason('RISK_MARGIN_TOO_LOW'), /Sin fondos/)
  assert.match(rejectionReason('RISK_MARGIN_RESERVE'), /Sin fondos/)
  // Un código desconocido no puede romper la vista ni mentir sobre la causa.
  assert.match(rejectionReason('RISK_SOMETHING_NEW'), /RISK_SOMETHING_NEW/)
  assert.match(rejectionReason(null), /rechazada/)
})

test('a rejected open is paired with the strategy close that followed it', () => {
  const signal = {
    id: 'sig-open',
    strategy_code: 'ALGOTREND_GOLD_30M',
    symbol: 'NCCOGOLD2USD-USDT',
    action: 'OPEN',
    direction: 'LONG',
    signal_time: '2026-08-01T10:00:00.000Z',
    reference_price: 2000,
  }
  const result = buildMissedOpportunities({
    intents: [{
      id: 'intent-1',
      connection_id: 'conn-1',
      signal_id: 'sig-open',
      action: 'OPEN',
      direction: 'LONG',
      symbol: 'NCCOGOLD2USD-USDT',
      rejection_code: 'RISK_MARGIN_TOO_LOW',
      created_at: '2026-08-01T10:00:05.000Z',
    }],
    signalsById: new Map([['sig-open', signal]]),
    laterSignals: [
      // Un cierre ANTERIOR a la apertura no puede emparejarse con ella.
      { ...signal, id: 'sig-stale', action: 'CLOSE', signal_time: '2026-08-01T09:00:00.000Z', reference_price: 1900 },
      { ...signal, id: 'sig-close', action: 'CLOSE', signal_time: '2026-08-01T12:00:00.000Z', reference_price: 2040 },
      // Un cierre posterior más lejano no debe ganarle al primero.
      { ...signal, id: 'sig-later', action: 'CLOSE', signal_time: '2026-08-01T18:00:00.000Z', reference_price: 2500 },
    ],
    connections: new Map([['conn-1', { label: 'oro 30 prueba', notionalUsd: 100 }]]),
  })

  assert.equal(result.length, 1)
  const [missed] = result
  assert.equal(missed.insufficientFunds, true)
  assert.match(missed.reason, /Sin fondos/)
  assert.equal(missed.entryPrice, 2000)
  assert.equal(missed.exitPrice, 2040)
  assert.equal(missed.missedReturnPct, 2)
  assert.equal(missed.missedGrossPnlUsd, 2)
  assert.equal(missed.outcome, 'WIN')
  assert.equal(missed.connectionLabel, 'oro 30 prueba')
})

test('a rejected close never produces a phantom trade result', () => {
  const signal = {
    id: 'sig-close-intent',
    strategy_code: 'ALGOTREND_BTC_1H',
    symbol: 'BTC-USDT',
    action: 'CLOSE',
    direction: 'LONG',
    signal_time: '2026-08-01T10:00:00.000Z',
    reference_price: 60000,
  }
  const [missed] = buildMissedOpportunities({
    intents: [{
      id: 'intent-2',
      connection_id: 'conn-2',
      signal_id: 'sig-close-intent',
      action: 'CLOSE',
      direction: 'LONG',
      symbol: 'BTC-USDT',
      rejection_code: 'RISK_POSITION_NOT_OWNED',
      created_at: '2026-08-01T10:00:05.000Z',
    }],
    signalsById: new Map([['sig-close-intent', signal]]),
    laterSignals: [{ ...signal, id: 'other', signal_time: '2026-08-01T14:00:00.000Z', reference_price: 66000 }],
    connections: new Map([['conn-2', { label: 'Prueba conexion', notionalUsd: 50 }]]),
  })

  assert.equal(missed.outcome, 'NOT_APPLICABLE')
  assert.equal(missed.missedReturnPct, null)
  assert.equal(missed.missedGrossPnlUsd, null)
  assert.equal(missed.insufficientFunds, false)
})

test('rejected intents reach the holder even when the connection never executed an order', async () => {
  const [history, types, component] = await Promise.all([
    readFile(path.join(root, 'src/lib/brokers/order-history.ts'), 'utf8'),
    readFile(path.join(root, 'src/lib/brokers/order-history-types.ts'), 'utf8'),
    readFile(path.join(root, 'src/components/brokers/BrokerOrderHistory.tsx'), 'utf8'),
  ])

  // El caso real: broker_orders vacío y aun así hay rechazos que mostrar. Si el early return
  // devolviera EMPTY_BROKER_ORDER_HISTORY pelado, el titular no vería nunca su "sin fondos".
  assert.match(history, /return \{ \.\.\.EMPTY_BROKER_ORDER_HISTORY, missedOpportunities \}/)
  assert.match(history, /loadMissedOpportunities\(\{ userId: filters\.userId, connectionId: filters\.connectionId \}\)/)
  assert.match(types, /missedOpportunities: BrokerMissedOpportunity\[\]/)
  assert.match(component, /Operaciones que no se ejecutaron/)
  assert.match(component, /Sin fondos\./)
})
