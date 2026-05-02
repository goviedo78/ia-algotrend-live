import type { Trade } from './db'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID

function fmt(n: number | null | undefined, decimals = 2) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

async function send(text: string) {
  if (!BOT_TOKEN || !CHAT_ID) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
  }).catch(() => null)
}

export async function notifyOpen(trade: Trade) {
  const dir   = trade.direction === 'LONG' ? '🟢 LARGO' : '🔴 CORTO'
  const emoji = trade.direction === 'LONG' ? '📈' : '📉'
  await send(
    `${emoji} <b>AlgoTrend — Nueva operación</b>\n\n` +
    `${dir} <b>BTC/USD</b> (1H)\n` +
    `━━━━━━━━━━━━━━\n` +
    `💰 Entrada:    <b>$${fmt(trade.open_price)}</b>\n` +
    `🛑 Stop:       <b>$${fmt(trade.stop_loss)}</b>\n` +
    `🎯 Objetivo:   <b>${trade.take_profit !== null ? `$${fmt(trade.take_profit)}` : 'Stop móvil activo'}</b>\n` +
    `📊 Capital base: $10,000`
  )
}

export async function notifyClose(trade: Trade) {
  if (!trade.close_price || trade.pnl_usd === null) return
  const win    = (trade.pnl_usd) >= 0
  const emoji  = win ? '✅' : '❌'
  const reason = trade.close_reason === 'TP' ? '🎯 Salida por objetivo'
               : trade.close_reason === 'SL' ? '🛑 Salida por stop'
               : '🔄 Cierre por señal contraria'
  const dir = trade.direction === 'LONG' ? 'Largo' : 'Corto'
  await send(
    `${emoji} <b>AlgoTrend — Operación cerrada</b>\n\n` +
    `${dir} BTC/USD\n` +
    `━━━━━━━━━━━━━━\n` +
    `📥 Entrada:  <b>$${fmt(trade.open_price)}</b>\n` +
    `📤 Cierre:   <b>$${fmt(trade.close_price)}</b>\n` +
    `${reason}\n` +
    `━━━━━━━━━━━━━━\n` +
    `Resultado: <b>${win ? '+' : ''}$${fmt(trade.pnl_usd)}</b>  (${win ? '+' : ''}${fmt(trade.pnl_pct ?? 0)}%)`
  )
}
