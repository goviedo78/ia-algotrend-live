import 'server-only'

import { fetchBingxTickerPrice } from './adapters/bingx'
import type { BrokerEnvironment } from './domain'
import type { BrokerOpenPositionSummary } from './order-history-types'

/**
 * El panel se recarga cada diez segundos. Un precio de hasta cinco segundos es
 * indistinguible en pantalla y evita pedirle un ticker a BingX por cada visita.
 */
const PRICE_TTL_MS = 5_000

function isSupportedEnvironment(value: string): value is BrokerEnvironment {
  return value === 'DEMO' || value === 'LIVE'
}

async function loadMarkPrices(
  positions: BrokerOpenPositionSummary[],
): Promise<Map<string, number>> {
  const wanted = new Map<string, { symbol: string; environment: BrokerEnvironment }>()
  for (const position of positions) {
    // Hoy el único adaptador es BingX. Cualquier otro broker se muestra sin valuar
    // hasta que tenga su propia fuente de precio, en vez de asumir un ticker ajeno.
    if (position.broker !== 'BINGX') continue
    if (!isSupportedEnvironment(position.environment)) continue
    wanted.set(`${position.environment}:${position.symbol}`, {
      symbol: position.symbol,
      environment: position.environment,
    })
  }
  if (!wanted.size) return new Map()

  const entries = await Promise.all([...wanted].map(async ([key, request]) => {
    try {
      const price = await fetchBingxTickerPrice(request.symbol, request.environment, { ttlMs: PRICE_TTL_MS })
      return [key, price] as const
    } catch {
      // Un ticker caído no puede tumbar el historial entero: esa posición queda sin valuar.
      return null
    }
  }))

  return new Map(entries.filter((entry): entry is readonly [string, number] => entry !== null))
}

/**
 * Valúa una posición al precio dado. El porcentaje se calcula sobre el capital
 * realmente usado en la entrada, el mismo denominador que `netReturnPct` usa en las
 * operaciones ya cerradas, para que una posición abierta y una cerrada se puedan
 * comparar de frente. Un precio inservible devuelve la posición intacta, sin valuar:
 * en una pantalla de dinero, "—" es mejor que una cifra inventada.
 */
export function applyMarkPrice(
  position: BrokerOpenPositionSummary,
  markPrice: number | null | undefined,
  pricedAt: string,
): BrokerOpenPositionSummary {
  if (markPrice == null || !Number.isFinite(markPrice) || markPrice <= 0) return position
  if (!(position.quantity > 0) || !(position.averageEntryPrice > 0)) return position

  const direction = position.direction === 'SHORT' ? -1 : 1
  const grossPnlUsd = (markPrice - position.averageEntryPrice) * position.quantity * direction
  const netPnlUsd = grossPnlUsd - position.entryFeesUsd

  return {
    ...position,
    markPrice,
    unrealizedGrossPnlUsd: grossPnlUsd,
    unrealizedNetPnlUsd: netPnlUsd,
    unrealizedReturnPct: position.notionalUsd > 0 ? (netPnlUsd / position.notionalUsd) * 100 : null,
    pricedAt,
  }
}

/**
 * Agrega a cada posición abierta cuánto lleva ganado o perdido al precio de mercado
 * actual, con una sola consulta de ticker por símbolo.
 */
export async function valueOpenPositions(
  positions: BrokerOpenPositionSummary[],
): Promise<BrokerOpenPositionSummary[]> {
  if (!positions.length) return positions
  const prices = await loadMarkPrices(positions)
  if (!prices.size) return positions
  const pricedAt = new Date().toISOString()
  return positions.map((position) => applyMarkPrice(
    position,
    prices.get(`${position.environment}:${position.symbol}`),
    pricedAt,
  ))
}
