import type { Trade } from './db'
import { formatCardCaption, type TradeCardData } from './telegram-performance'

type TelegramConfig = { token: string; chatId: string; threadId?: number }
type Quote = { price: number; time: number }
type Delivery = { status: 'sent'; messageId: number } | { status: 'failed'; code: number } | { status: 'unknown' }

// Signals deliberately never fall back to the operational/PilotControl bot.
export function getAlgoTrendTelegramConfig(env: Record<string, string | undefined> = process.env): TelegramConfig | null {
  const token = env.ALGOTREND_TELEGRAM_BOT_TOKEN?.trim()
  const chatId = env.ALGOTREND_TELEGRAM_CHAT_ID?.trim()
  const topic = env.ALGOTREND_TELEGRAM_THREAD_ID?.trim()
  if (!token || !chatId) return null
  if (topic && (!/^\d+$/.test(topic) || !Number.isSafeInteger(Number(topic)) || Number(topic) < 1)) return null
  return { token, chatId, ...(topic ? { threadId: Number(topic) } : {}) }
}

function fmt(n: number | null | undefined) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(n: number | null) {
  if (n === null || !Number.isFinite(n)) return '—'
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}%`
}

function date(time: number) {
  return new Date(time * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
}

function reason(trade: Trade) {
  return trade.close_reason === 'TP' ? 'Objetivo alcanzado' : trade.close_reason === 'SL' ? 'Stop loss / stop móvil' : 'Señal contraria'
}

function formatHistory(recent: Trade[] | null, quote: Quote | null, trade?: Trade) {
  const rows = new Map<number, Trade>()
  for (const row of recent ?? []) rows.set(row.id, row)
  if (trade) rows.set(trade.id, trade) // The committed event wins over any stale snapshot.
  const latest = [...rows.values()].sort((a, b) => b.open_time - a.open_time || b.id - a.id).slice(0, 5)
  if (recent === null) return 'Historial temporalmente no disponible.'
  if (!latest.length) return 'Todavía no hay operaciones.'
  return latest.map(row => {
    const dir = row.direction === 'LONG' ? 'LONG' : 'SHORT'
    const closed = row.status === 'CLOSED'
    const change = closed ? row.pnl_pct : quote && quote.time >= row.open_time && Number.isFinite(quote.price) && quote.price > 0 && row.open_price > 0
      ? (quote.price / row.open_price - 1) * (row.direction === 'LONG' ? 100 : -100) : null
    const state = closed ? 'Cerrada' : 'Abierta'
    const icon = closed ? change === null ? '⚪' : change > 0 ? '✅' : change < 0 ? '❌' : '⚪' : '🟡'
    const result = closed ? pct(change) : change === null ? 'Sin cotización' : `${pct(change)} flotante`
    return `${icon} <b>#${row.id} ${dir}</b> · ${state} · <b>${result}</b>\n   ${date(row.open_time)} · Entrada $${fmt(row.open_price)}${closed ? ` → $${fmt(row.close_price)}` : ''}`
  }).join('\n\n')
}

const DEMO_FOOTER = '<i>Demo del indicador. Variación del precio sin comisiones, slippage ni apalancamiento. El resultado de tu cuenta puede diferir. Resumen al emitir esta alerta.</i>'

export function formatTradeSummary(recent: Trade[], quote: Quote | null) {
  return [
    '<b>GONOVI · AlgoTrend</b>',
    '<b>DEMO · BTC/USD · 1H</b>',
    '━━━━━━━━━━━━━━━━━━',
    '<b>📋 RESUMEN INICIAL</b>',
    'Historial del indicador. Este mensaje no es una señal nueva.',
    '',
    '<b>Últimas 5 operaciones</b>',
    formatHistory(recent, quote),
    '',
    ...(quote ? [`Cotización de referencia: $${fmt(quote.price)} · ${date(quote.time)}`] : []),
    DEMO_FOOTER,
  ].join('\n')
}

export function formatTradeAlert(event: 'OPEN' | 'CLOSE', trade: Trade, recent: Trade[] | null, quote: Quote | null) {
  const opening = event === 'OPEN'
  const direction = trade.direction === 'LONG' ? '🟢 LONG · Largo' : '🔴 SHORT · Corto'

  return [
    '<b>GONOVI · AlgoTrend</b>',
    '<b>DEMO · BTC/USD · 1H</b>',
    '━━━━━━━━━━━━━━━━━━',
    `<b>${opening ? '📥 ENTRADA' : '📤 SALIDA'} · #${trade.id}</b>`,
    direction,
    date(opening ? trade.open_time : trade.close_time ?? trade.open_time),
    '',
    `Entrada: <b>$${fmt(trade.open_price)}</b>`,
    ...(opening ? [
      `Stop: <b>$${fmt(trade.stop_loss)}</b>`,
      `Objetivo: <b>${trade.take_profit === null ? 'Stop móvil activo' : `$${fmt(trade.take_profit)}`}</b>`,
    ] : [
      `Salida: <b>$${fmt(trade.close_price)}</b>`,
      `Motivo: ${reason(trade)}`,
      `Resultado: <b>${pct(trade.pnl_pct)}</b>`,
    ]),
    '━━━━━━━━━━━━━━━━━━',
    '<b>Últimas 5 operaciones</b>',
    formatHistory(recent, quote, trade),
    '',
    ...(quote ? [`Cotización de referencia: $${fmt(quote.price)} · ${date(quote.time)}`] : []),
    DEMO_FOOTER,
  ].join('\n')
}

export async function sendTelegramMessage(config: TelegramConfig, text: string, fetchImpl: typeof fetch = fetch): Promise<Delivery> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.chatId, message_thread_id: config.threadId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
    })
    const data = await res.json() as { ok?: boolean; error_code?: number; result?: { message_id?: number } }
    if (!res.ok || !data.ok) return { status: 'failed', code: data.error_code ?? res.status }
    if (!Number.isSafeInteger(data.result?.message_id)) return { status: 'unknown' }
    return { status: 'sent', messageId: data.result!.message_id! }
  } catch {
    // A timeout may mean Telegram accepted the message. Never resend blindly.
    // Do not log fetch errors: their URL can contain the bot token.
    return { status: 'unknown' }
  } finally {
    clearTimeout(timer)
  }
}

export async function sendTelegramPhoto(config: TelegramConfig, bytes: Uint8Array, caption: string, fetchImpl: typeof fetch = fetch): Promise<Delivery> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const form = new FormData()
    form.set('chat_id', config.chatId)
    if (config.threadId) form.set('message_thread_id', String(config.threadId))
    form.set('caption', caption)
    form.set('photo', new Blob([new Uint8Array(bytes).buffer], { type: 'image/png' }), 'algotrend-btc1h.png')
    const response = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendPhoto`, {
      method: 'POST', signal: controller.signal, body: form,
    })
    const data = await response.json() as { ok?: boolean; error_code?: number; result?: { message_id?: number } }
    if (!response.ok || !data.ok) return { status: 'failed', code: data.error_code ?? response.status }
    if (!Number.isSafeInteger(data.result?.message_id)) return { status: 'unknown' }
    return { status: 'sent', messageId: data.result!.message_id! }
  } catch {
    return { status: 'unknown' }
  } finally {
    clearTimeout(timer)
  }
}

export async function deliverTradeCard(config: TelegramConfig, data: TradeCardData, deps: {
  render?: (data: TradeCardData) => Promise<Uint8Array>
  fetchImpl?: typeof fetch
} = {}): Promise<Delivery> {
  const textFallback = () => sendTelegramMessage(config, formatCardCaption(data), deps.fetchImpl)
  let bytes: Uint8Array
  try {
    const render = deps.render ?? (await import('./telegram-card')).renderTradeCard
    bytes = await render(data)
  } catch {
    // Rendering failed before contacting Telegram: text is safe to send once.
    return textFallback()
  }
  const result = await sendTelegramPhoto(config, bytes, formatCardCaption(data), deps.fetchImpl)
  // Only a definitive image rejection permits a text fallback. An ambiguous
  // timeout might already have published the photo, and must never send twice.
  if (result.status === 'failed' && [400, 413].includes(result.code)) {
    return textFallback()
  }
  return result
}

// Infrastructure alerts keep their existing, separate destination.
export async function sendTelegramAlert(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()
  if (token && chatId) {
    const result = await sendTelegramMessage({ token, chatId }, text)
    if (result.status !== 'sent') console.error('[telegram:infrastructure]', result)
  }
}

async function notifyTrade(event: 'OPEN' | 'CLOSE', trade: Trade, probabilityPct?: number, trailingStopActive?: boolean) {
  const config = getAlgoTrendTelegramConfig()
  if (!config) return
  if (event === 'OPEN') {
    const result = await deliverTradeCard(config, { event, trade, probabilityPct, recent: null })
    if (result.status !== 'sent') console.error('[telegram:signal]', { tradeId: trade.id, event, ...result })
    return
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2000)
  let recent: Trade[] | null = null
  try {
    const { getAllTrades } = await import('./db')
    // One open event plus the five latest closed operations for the scorecard.
    recent = await getAllTrades(6, 'algotrend_trades', controller.signal)
  } catch {
    console.error('[telegram:history] unavailable', { tradeId: trade.id })
  } finally {
    clearTimeout(timer)
  }
  const result = await deliverTradeCard(config, { event, trade, recent, trailingStopActive })
  if (result.status !== 'sent') console.error('[telegram:signal]', { tradeId: trade.id, event, ...result })
}

export async function notifyOpen(trade: Trade, probabilityPct?: number) {
  await notifyTrade('OPEN', trade, probabilityPct)
}

export async function notifyClose(trade: Trade, trailingStopActive?: boolean) {
  if (trade.status !== 'CLOSED' || trade.close_price === null) return
  await notifyTrade('CLOSE', trade, undefined, trailingStopActive)
}
