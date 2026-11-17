import type { ProtectionKind } from './adapters/types'
import type { TradeDirection } from './domain'

/**
 * Stop y take profit reales en el broker, espejo de los de la estrategia.
 *
 * La estrategia registra la salida AL PRECIO de su stop/objetivo, tocado dentro de la vela. El
 * bot, sin órdenes en el broker, sólo podía salir a mercado cuando la estrategia confirmaba el
 * cierre (+~2 min tras la vela), y en operaciones de margen chico eso daba vuelta el resultado.
 * Con una orden condicional en el broker la cuenta sale donde sale la estrategia.
 *
 * Este módulo es la parte pura: dado lo deseado y lo que hay en el broker, decide qué conservar,
 * qué colocar y qué cancelar. El worker (`protection-sync.ts`) lo ejecuta.
 */

export interface ProtectionTarget {
  stopLoss: number
  takeProfit: number | null
}

export interface DesiredProtection {
  kind: ProtectionKind
  triggerPrice: number
  quantity: number
}

export interface ActiveProtection {
  id: string
  kind: ProtectionKind
  triggerPrice: number
  quantity: number
  brokerOrderId: string
}

export interface ProtectionPlan<T extends ActiveProtection = ActiveProtection> {
  keep: T[]
  // Se colocan ANTES de cancelar las viejas: la posición nunca queda sin stop.
  place: DesiredProtection[]
  cancel: T[]
  // Precio ya del otro lado del nivel: la orden dispararía al instante (o BingX la rechaza).
  // Lo que corresponde es salir a mercado, igual que habría salido el stop.
  crossed: DesiredProtection | null
}

export function roundTriggerPrice(price: number, pricePrecision: number) {
  const digits = Math.max(0, Math.min(12, Math.trunc(pricePrecision)))
  return Number(price.toFixed(digits))
}

export function roundQuantityDown(quantity: number, quantityPrecision: number) {
  const digits = Math.max(0, Math.min(12, Math.trunc(quantityPrecision)))
  const factor = 10 ** digits
  // El épsilon absorbe 0.0018 * 10000 = 17.999999999999996 sin redondear hacia arriba nunca.
  return Math.floor(quantity * factor + 1e-9) / factor
}

/** Lo que debería haber en el broker para una posición propia de `quantity`. */
export function desiredProtection(
  target: ProtectionTarget,
  quantity: number,
  pricePrecision: number,
): DesiredProtection[] {
  if (!(quantity > 0) || !(target.stopLoss > 0)) return []
  const desired: DesiredProtection[] = [
    { kind: 'STOP_LOSS', triggerPrice: roundTriggerPrice(target.stopLoss, pricePrecision), quantity },
  ]
  if (target.takeProfit != null && target.takeProfit > 0) {
    desired.push({ kind: 'TAKE_PROFIT', triggerPrice: roundTriggerPrice(target.takeProfit, pricePrecision), quantity })
  }
  return desired
}

/** ¿El precio actual ya cruzó el nivel? Un stop largo dispara cuando el precio baja hasta él. */
export function isTriggerCrossed(
  kind: ProtectionKind,
  direction: TradeDirection,
  triggerPrice: number,
  lastPrice: number,
) {
  if (!(lastPrice > 0)) return false
  const losingSide = kind === 'STOP_LOSS'
  if (direction === 'LONG') return losingSide ? lastPrice <= triggerPrice : lastPrice >= triggerPrice
  return losingSide ? lastPrice >= triggerPrice : lastPrice <= triggerPrice
}

export function planProtectionSync<T extends ActiveProtection>(input: {
  direction: TradeDirection
  desired: DesiredProtection[]
  active: T[]
  lastPrice: number
  pricePrecision: number
  quantityPrecision: number
}): ProtectionPlan<T> {
  const priceTolerance = 0.5 * 10 ** -Math.max(0, input.pricePrecision)
  const quantityTolerance = 0.5 * 10 ** -Math.max(0, input.quantityPrecision)
  const keep: T[] = []
  const place: DesiredProtection[] = []
  const cancel: T[] = []

  for (const wanted of input.desired) {
    const ofKind = input.active.filter((row) => row.kind === wanted.kind)
    const match = ofKind.find((row) => (
      Math.abs(row.triggerPrice - wanted.triggerPrice) <= priceTolerance
      && Math.abs(row.quantity - wanted.quantity) <= quantityTolerance
    ))
    if (match) {
      keep.push(match)
      cancel.push(...ofKind.filter((row) => row !== match))
      continue
    }
    if (isTriggerCrossed(wanted.kind, input.direction, wanted.triggerPrice, input.lastPrice)) {
      // Salir a mercado reemplaza a TODA la protección de la posición.
      return { keep: [], place: [], cancel: [...input.active], crossed: wanted }
    }
    place.push(wanted)
    cancel.push(...ofKind)
  }

  const desiredKinds = new Set(input.desired.map((wanted) => wanted.kind))
  cancel.push(...input.active.filter((row) => !desiredKinds.has(row.kind)))
  return { keep, place, cancel, crossed: null }
}
