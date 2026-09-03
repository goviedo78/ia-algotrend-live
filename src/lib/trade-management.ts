import type { Candle } from './algotrend'
import type { CloseReason, TradeDirection } from './db'

/**
 * Estado mínimo de una operación viva para decidir qué hacer con una vela cerrada.
 * `signalTime` es la vela de la señal: la entrada es SU CIERRE.
 */
export interface ManagedTrade {
  direction: TradeDirection
  signalTime: number
  openPrice: number
  stopLoss: number
  takeProfit: number | null
}

export type TradeManagementDecision =
  | { kind: 'BEFORE_ENTRY' }
  | { kind: 'CLOSE'; reason: CloseReason; closePrice: number }
  | { kind: 'TRAIL'; stopLoss: number; takeProfit: number | null }
  | { kind: 'HOLD' }

export const TRAIL_TRIGGER_PCT = 1.0
export const TRAIL_OFFSET_PCT = 0.3

/**
 * Decide qué hacer con una operación abierta frente a UNA vela cerrada.
 *
 * La regla que da nombre a `BEFORE_ENTRY`: la entrada es el cierre de la vela de la señal, así
 * que todo lo que esa vela recorrió pasó ANTES de que la operación existiera. Su mecha no puede
 * haber tocado el stop. El cron reanaliza la última vela cerrada durante toda la hora, de modo
 * que entre la apertura y el cierre de la vela siguiente vuelve a mirar la vela de entrada una y
 * otra vez: sin este corte, una vela cuyo rango supere la distancia al stop cierra la operación
 * en el mismo instante en que la abre, con una pérdida que nunca ocurrió. Es la misma frontera
 * que ya respeta la reconstrucción histórica al evaluar sólo `candles.slice(i + 1)`.
 */
export function evaluateOpenTradeAgainstCandle(
  trade: ManagedTrade,
  candle: Candle,
): TradeManagementDecision {
  if (candle.time <= trade.signalTime) return { kind: 'BEFORE_ENTRY' }

  const { open: o, high: h, low: l, close: price } = candle
  let stopLoss = trade.stopLoss
  let takeProfit = trade.takeProfit

  // Sin datos intravela, el recorrido se asume por el extremo más cercano a la apertura.
  const path: ('high' | 'low')[] = Math.abs(o - h) < Math.abs(o - l) ? ['high', 'low'] : ['low', 'high']

  const hitPath = (leg: 'high' | 'low'): TradeManagementDecision | null => {
    if (trade.direction === 'LONG') {
      if (leg === 'low' && l <= stopLoss) return { kind: 'CLOSE', reason: 'SL', closePrice: stopLoss }
      if (leg === 'high' && takeProfit !== null && h >= takeProfit) return { kind: 'CLOSE', reason: 'TP', closePrice: takeProfit }
      return null
    }
    if (leg === 'high' && h >= stopLoss) return { kind: 'CLOSE', reason: 'SL', closePrice: stopLoss }
    if (leg === 'low' && takeProfit !== null && l <= takeProfit) return { kind: 'CLOSE', reason: 'TP', closePrice: takeProfit }
    return null
  }

  const hit = hitPath(path[0]) ?? hitPath(path[1])
  if (hit) return hit

  if (trade.direction === 'LONG') {
    const gainPct = ((h - trade.openPrice) / trade.openPrice) * 100
    if (gainPct >= TRAIL_TRIGGER_PCT) {
      stopLoss = Math.max(trade.openPrice, stopLoss, h * (1 - TRAIL_OFFSET_PCT / 100))
      takeProfit = null
    }
  } else {
    const gainPct = ((trade.openPrice - l) / trade.openPrice) * 100
    if (gainPct >= TRAIL_TRIGGER_PCT) {
      stopLoss = Math.min(trade.openPrice, stopLoss, l * (1 + TRAIL_OFFSET_PCT / 100))
      takeProfit = null
    }
  }

  // Confirmación al cierre de la vela, ya con el stop movido.
  const closeReason: CloseReason | null = trade.direction === 'LONG'
    ? (price <= stopLoss ? 'SL' : (takeProfit !== null && price >= takeProfit ? 'TP' : null))
    : (price >= stopLoss ? 'SL' : (takeProfit !== null && price <= takeProfit ? 'TP' : null))
  if (closeReason) return { kind: 'CLOSE', reason: closeReason, closePrice: price }

  if (stopLoss !== trade.stopLoss || takeProfit !== trade.takeProfit) {
    return { kind: 'TRAIL', stopLoss, takeProfit }
  }
  return { kind: 'HOLD' }
}
