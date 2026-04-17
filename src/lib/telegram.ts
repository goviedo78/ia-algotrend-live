import type { Trade } from './db'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
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
  const dir   = trade.direction === 'LONG' ? '🟢 LONG' : '🔴 SHORT'
  const emoji = trade.direction === 'LONG' ? '📈' : '📉'
  await send(
    `${emoji} <b>Fusion Engine X10 — Nueva operación</b>\n\n` +
    `${dir} <b>BTC/USDT</b> (1H)\n` +
    `━━━━━━━━━━━━━━\n` +
    `💰 Entrada:    <b>$${fmt(trade.open_price)}</b>\n` +
    `🛑 Stop Loss:  <b>$${fmt(trade.stop_loss)}</b>\n` +
    `🎯 Take Profit: <b>$${fmt(trade.take_profit)}</b>\n` +
    `📊 Capital:    $10,000 USDT`
  )
}

export async function notifyClose(trade: Trade) {
  if (!trade.close_price || trade.pnl_usd === null) return
  const win    = (trade.pnl_usd) >= 0
  const emoji  = win ? '✅' : '❌'
  const reason = trade.close_reason === 'TP' ? '🎯 Take Profit alcanzado'
               : trade.close_reason === 'SL' ? '🛑 Stop Loss tocado'
               : '🔄 Señal contraria'
  await send(
    `${emoji} <b>Fusion Engine X10 — Trade cerrado</b>\n\n` +
    `${trade.direction} BTC/USDT\n` +
    `━━━━━━━━━━━━━━\n` +
    `📥 Entrada:  <b>$${fmt(trade.open_price)}</b>\n` +
    `📤 Cierre:   <b>$${fmt(trade.close_price)}</b>\n` +
    `${reason}\n` +
    `━━━━━━━━━━━━━━\n` +
    `PnL: <b>${win ? '+' : ''}$${fmt(trade.pnl_usd)}</b>  (${win ? '+' : ''}${fmt(trade.pnl_pct ?? 0)}%)`
  )
}
