import { runAlgoTrend, PRESET, type AlgoTrendResult, type Candle } from './algotrend'
import { latestAtrPercent } from './atr'
import type { Trade } from './db'
import { entryPresentation, localTradeDate, tradePrice } from './telegram-performance'

export type SignalNotice = {
  kind: 'PREALERT' | 'TRIGGER'
  identity: string
  direction: Trade['direction']
  time: number
  validUntil?: number
  probabilityPct?: number
  openPrice?: number
  stopLoss?: number
  reversal?: boolean
  tradeId?: number
}

export function evaluatePrealert(input: {
  candles: Candle[]; now: number; atrFilterOn: boolean; atrThreshold: number
  openTrade: Trade | null; run?: (candles: Candle[]) => AlgoTrendResult[]
}): SignalNotice | null {
  const { candles, now, openTrade } = input
  const hour = Math.floor(now / 3600) * 3600
  const elapsed = now - hour
  // Observe near the close, never retrospectively or at the boundary.
  if (elapsed < 55 * 60 || elapsed >= 3570 || candles.length < PRESET.windowSize + 3 * PRESET.momentumWindow + PRESET.maLen) return null
  const current = candles.at(-1)!
  if (current.time !== hour || candles.at(-2)?.time !== hour - 3600) return null
  if (candles.some((c, i) => ![c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) ||
      c.low <= 0 || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close) ||
      c.volume < 0 || (i > 0 && c.time !== candles[i - 1].time + 3600))) return null
  const result = (input.run ?? runAlgoTrend)(candles).at(-1)
  if (!result || result.time !== hour || result.longSig === result.shortSig) return null
  const direction = result.longSig ? 'LONG' : 'SHORT'
  const probability = direction === 'LONG' ? result.probUp : result.probDown
  if (!Number.isFinite(probability) || probability <= PRESET.probThreshold || probability > 1) return null
  if (openTrade?.direction === direction) return null
  if (input.atrFilterOn) {
    const atr = latestAtrPercent(candles, 14)
    if (atr === null || !Number.isFinite(input.atrThreshold) || atr < input.atrThreshold) return null
  }
  return { kind: 'PREALERT', identity: `prealert:${hour}`, direction, time: hour,
    validUntil: hour + 3600, probabilityPct: probability * 100,
    reversal: openTrade !== null && openTrade.direction !== direction }
}

export function triggerNotice(before: Trade, saved: Trade): SignalNotice | null {
  if (before.id !== saved.id || before.direction !== saved.direction || before.status !== 'OPEN' || saved.status !== 'OPEN' ||
      before.take_profit === null || saved.take_profit !== null || !saved.last_managed_time ||
      !Number.isFinite(saved.stop_loss) || !Number.isFinite(saved.open_price) || saved.open_price <= 0 ||
      (saved.direction === 'LONG' ? saved.stop_loss < saved.open_price : saved.stop_loss > saved.open_price)) return null
  return { kind: 'TRIGGER', identity: `trigger:${saved.id}`, tradeId: saved.id, direction: saved.direction,
    time: saved.last_managed_time, openPrice: saved.open_price, stopLoss: saved.stop_loss }
}

export function noticeLines(notice: SignalNotice) {
  if (notice.kind === 'TRIGGER') return [
    `Entrada: ${tradePrice(notice.openPrice ?? null)}`,
    `Stop móvil: ${tradePrice(notice.stopLoss ?? null)}`,
    'La operación continúa abierta. El TP fijo deja de aplicarse.',
    `Vela confirmada: ${localTradeDate(notice.time)} · CDMX`,
  ]
  return [
    `Probabilidad de señal: ${notice.probabilityPct!.toFixed(1)}%`,
    ...(notice.reversal ? [`Posible giro de ${notice.direction === 'LONG' ? 'VENTA a COMPRA' : 'COMPRA a VENTA'}.`] : []),
    `Cierre de vela: ${localTradeDate(notice.validUntil!)} · CDMX`,
    'Señal sin confirmar.',
  ]
}

export function formatNotice(notice: SignalNotice) {
  const direction = entryPresentation(notice.direction)
  return [notice.kind === 'TRIGGER' ? `TRIGGER ACTIVADO · ${direction.emoji} ${direction.label}`
    : `CONDICIONES FAVORABLES · ${direction.emoji} ${direction.label}`, 'BTC · 1H', ...noticeLines(notice)].join('\n')
}

type SendResult = { status: 'sent'; messageId: number } | { status: 'failed'; code: number } | { status: 'unknown' }
export async function deliverOnce(destination: string, notice: SignalNotice, deps: {
  claim: (key: string, notice: SignalNotice) => Promise<boolean>
  finish: (key: string, state: SendResult['status'] | 'expired', messageId?: number) => Promise<void>
  send: (notice: SignalNotice) => Promise<SendResult>
  now: () => number
}) {
  if (notice.validUntil !== undefined && deps.now() >= notice.validUntil - 15) return
  const key = `${destination}:${notice.identity}`
  if (!await deps.claim(key, notice)) return
  if (notice.validUntil !== undefined && deps.now() >= notice.validUntil - 15) {
    await deps.finish(key, 'expired'); return
  }
  let result: SendResult
  try { result = await deps.send(notice) } catch { result = { status: 'unknown' } }
  await deps.finish(key, result.status, result.status === 'sent' ? result.messageId : undefined)
}
