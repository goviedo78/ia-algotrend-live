import type { Trade } from './db'

export function getPerformanceWindow(recent: Trade[] | null, eventTrade?: Trade) {
  const unique = new Map<number, Trade>()
  for (const trade of recent ?? []) unique.set(trade.id, trade)
  if (eventTrade) unique.set(eventTrade.id, eventTrade)
  const all = recent === null ? [] : [...unique.values()].sort((a, b) => b.open_time - a.open_time || b.id - a.id)
  const trades = all.filter(t => t.status === 'CLOSED').slice(0, 5)
  const validResults = recent !== null && trades.length > 0 && trades.every(t =>
    t.pnl_pct !== null && Number.isFinite(t.pnl_pct) && t.pnl_pct >= -100)
  const validTimes = trades.length > 0 && trades.every(t => Number.isFinite(t.open_time) &&
    t.open_time > 0 && t.close_time !== null && Number.isFinite(t.close_time) && t.close_time >= t.open_time)
  const startTime = validTimes ? Math.min(...trades.map(t => t.open_time)) : null
  const endTime = validTimes ? Math.max(...trades.map(t => t.close_time!)) : null
  const wins = validResults ? trades.filter(t => t.pnl_pct! > 0).length : null
  return {
    trades, openCount: all.filter(t => t.status === 'OPEN').length,
    wins, losses: validResults ? trades.filter(t => t.pnl_pct! < 0).length : null,
    winRate: wins !== null ? wins / trades.length * 100 : null,
    compoundedPct: validResults && validTimes ? (trades.reduce((factor, t) => factor * (1 + t.pnl_pct! / 100), 1) - 1) * 100 : null,
    startTime, endTime, elapsedSeconds: startTime !== null && endTime !== null ? endTime - startTime : null,
  }
}

export function elapsedPeriod(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  if (!days) return hours ? `${hours} h` : `${Math.floor(seconds / 60)} min`
  return `${days} ${days === 1 ? 'día' : 'días'}${rest ? ` y ${rest} h` : ''}`
}

export function localTradeDate(time: number) {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(time * 1000))
}

export function tradePercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

export function tradePrice(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
}

export function operationDuration(trade: Trade) {
  if (trade.close_time === null || !Number.isFinite(trade.close_time) ||
      !Number.isFinite(trade.open_time) || trade.close_time < trade.open_time) return '—'
  const minutes = Math.floor((trade.close_time - trade.open_time) / 60)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor(minutes / 60) % 24
  const rest = minutes % 60
  return [days ? `${days} ${days === 1 ? 'día' : 'días'}` : '', hours ? `${hours} h` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ') || '0 min'
}

export type TradeCardData = { recent: Trade[] | null } & (
  | { event: 'SUMMARY'; trade?: never }
  | { event: 'OPEN'; trade: Trade; probabilityPct?: number }
  | { event: 'CLOSE'; trade: Trade; trailingStopActive?: boolean }
)

export type SignalMark = 'buy' | 'sell' | 'win' | 'loss' | 'neutral'

export function entryPresentation(direction: Trade['direction']) {
  return direction === 'LONG'
    ? { emoji: '🟢', label: 'COMPRA', mark: 'buy' as const }
    : { emoji: '🔴', label: 'VENTA', mark: 'sell' as const }
}

export function outcomePresentation(pnl: number | null) {
  if (pnl === null || !Number.isFinite(pnl)) return { emoji: '⚪', label: 'RESULTADO NO DISPONIBLE', mark: 'neutral' as const }
  if (pnl > 0) return { emoji: '✅', label: 'OPERACIÓN GANADA', mark: 'win' as const }
  if (pnl < 0) return { emoji: '❌', label: 'OPERACIÓN PERDIDA', mark: 'loss' as const }
  return { emoji: '⚪', label: 'OPERACIÓN SIN CAMBIO', mark: 'neutral' as const }
}

// Use the saved entry values; ATR is already a percentage, while callers
// supply signal probability in percentage points (0–100).
export function entryRiskLines(trade: Trade, probabilityPct?: number) {
  const atr = trade.atr_pct
  const validProbability = typeof probabilityPct === 'number' && Number.isFinite(probabilityPct) && probabilityPct >= 0 && probabilityPct <= 100
  return [
    `SL (Stop loss): ${tradePrice(trade.stop_loss)}`,
    `TP (Objetivo): ${trade.take_profit === null ? 'Stop móvil' : tradePrice(trade.take_profit)}`,
    `ATR: ${typeof atr === 'number' && Number.isFinite(atr) && atr >= 0 ? `${atr.toFixed(2)}%` : '—'}`,
    `Probabilidad de señal: ${validProbability ? `${probabilityPct.toFixed(1)}%` : '—'}`,
  ]
}

export function closeReasonText(trade: Trade, trailingStopActive = false) {
  if (trade.close_reason === 'SIGNAL') return 'Cambio de señal'
  if (trade.close_reason === 'TP') return 'Take profit (TP)'
  if (trade.close_reason === 'SL') {
    // A missing fixed TP alone is not enough: the stop must protect the entry.
    const protectedStop = Number.isFinite(trade.stop_loss) && trade.open_price > 0 &&
      (trade.direction === 'LONG' ? trade.stop_loss >= trade.open_price : trade.stop_loss <= trade.open_price)
    return trailingStopActive || (trade.take_profit === null && protectedStop)
      ? 'Stop móvil (trigger activado)' : 'Stop loss (SL)'
  }
  return 'No disponible'
}

export function formatCardCaption(data: TradeCardData) {
  const entry = data.trade ? entryPresentation(data.trade.direction) : null
  if (data.event === 'OPEN') return [
    `ENTRADA · ${entry!.emoji} ${entry!.label}`,
    'BTC · 1H', `Entrada: ${tradePrice(data.trade.open_price)}`,
    ...entryRiskLines(data.trade, data.probabilityPct),
    `${localTradeDate(data.trade.open_time)} · CDMX`,
  ].join('\n')
  const stats = getPerformanceWindow(data.recent, data.trade)
  const days = stats.elapsedSeconds !== null ? Math.floor(stats.elapsedSeconds / 86400) : 0
  const period = stats.elapsedSeconds === null ? null : days > 0 ? `${days} ${days === 1 ? 'día' : 'días'}` : elapsedPeriod(stats.elapsedSeconds)
  const summary = data.recent === null ? 'Últimas operaciones: resumen no disponible.'
    : !stats.trades.length ? 'Últimas operaciones: todavía no hay cierres.'
      : `Últimas ${stats.trades.length} operaciones: aciertos ${stats.winRate === null ? '—' : `${stats.winRate.toFixed(0)}%`} · PNL acumulado ${stats.compoundedPct !== null && period !== null ? `${tradePercent(stats.compoundedPct)} en ${period}` : 'no disponible'}.`
  if (data.event === 'SUMMARY') return ['RESUMEN · Historial, no es una señal nueva.', summary].join('\n')
  const outcome = outcomePresentation(data.trade.pnl_pct)
  const label = outcome.mark === 'win' ? 'OPERACIÓN GANADORA' : outcome.mark === 'loss' ? 'OPERACIÓN PERDEDORA' : outcome.label
  return [
    `CIERRE · ${outcome.emoji} ${label} (${tradePercent(data.trade.pnl_pct)})`,
    `Entrada: ${tradePrice(data.trade.open_price)}`,
    `Cierre: ${tradePrice(data.trade.close_price)}`,
    `Duración: ${operationDuration(data.trade)}`,
    `Motivo: ${closeReasonText(data.trade, data.trailingStopActive)}`, '', summary,
  ].join('\n')
}
