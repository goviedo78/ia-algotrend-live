import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type TradeStatus    = 'OPEN' | 'CLOSED'
export type TradeDirection = 'LONG' | 'SHORT'
export type CloseReason    = 'SL' | 'TP' | 'SIGNAL'

export interface Trade {
  id: number
  direction: TradeDirection
  signal_time: number
  open_time: number
  open_price: number
  stop_loss: number
  take_profit: number | null
  close_time: number | null
  close_price: number | null
  close_reason: CloseReason | null
  pnl_usd: number | null
  pnl_pct: number | null
  atr_pct: number | null
  status: TradeStatus
}

// Settings are stored as the LATEST event of type 'setting_change' for each key
export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from('algotrend_events')
    .select('metadata')
    .eq('event_type', 'setting_change')
    .contains('metadata', { key })
    .order('created_at', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    return (data[0].metadata as Record<string, string>).value ?? null
  }
  return null
}

const TABLE = 'algotrend_trades'

// Returns the inserted trade, or null if a trade for this signal_time already exists.
// Idempotency is enforced by a UNIQUE index on signal_time.
export async function openTrade(
  direction: TradeDirection,
  signalTime: number,
  openTime: number,
  openPrice: number,
  stopLoss: number,
  takeProfit: number | null,
  atrPct: number | null
): Promise<Trade | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      direction,
      signal_time: signalTime,
      open_time: openTime,
      open_price: openPrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      atr_pct: atrPct,
      status: 'OPEN',
    })
    .select()
    .single()

  if (error) {
    // 23505 = unique_violation — another request already processed this signal
    if ((error as { code?: string }).code === '23505') return null
    throw new Error(error.message)
  }

  // Insert succeeded — close any other OPEN trade (legacy or different signal_time)
  const { data: others } = await supabase
    .from(TABLE)
    .select()
    .eq('status', 'OPEN')
    .neq('id', data.id)

  for (const other of (others ?? []) as Trade[]) {
    await closeTrade(other.id, openTime, openPrice, 'SIGNAL')
  }

  return data as Trade
}

export async function updateOpenTradeRisk(
  id: number,
  stopLoss: number,
  takeProfit: number | null
): Promise<Trade> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ stop_loss: stopLoss, take_profit: takeProfit })
    .eq('id', id)
    .eq('status', 'OPEN')
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Trade
}

export async function closeTrade(
  id: number,
  closeTime: number,
  closePrice: number,
  reason: CloseReason
): Promise<Trade> {
  const { data: trade } = await supabase.from(TABLE).select().eq('id', id).single()
  const t = trade as Trade

  const mult   = t.direction === 'LONG' ? 1 : -1
  const pnlPct = ((closePrice - t.open_price) / t.open_price) * mult * 100
  const pnlUsd = (closePrice - t.open_price) * mult

  const { data, error } = await supabase
    .from(TABLE)
    .update({ close_time: closeTime, close_price: closePrice, close_reason: reason, pnl_usd: pnlUsd, pnl_pct: pnlPct, status: 'CLOSED' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Trade
}

export async function getOpenTrade(): Promise<Trade | null> {
  const { data } = await supabase.from(TABLE).select().eq('status', 'OPEN').maybeSingle()
  return (data as Trade) ?? null
}

export async function getAllTrades(limit = 200): Promise<Trade[]> {
  const { data } = await supabase.from(TABLE).select().order('open_time', { ascending: false }).limit(limit)
  return (data ?? []) as Trade[]
}

export async function getStats() {
  const { data } = await supabase.from(TABLE).select().eq('status', 'CLOSED').order('id', { ascending: true })
  const closed   = (data ?? []) as Trade[]
  const total    = closed.length
  const wins     = closed.filter(t => (t.pnl_usd ?? 0) > 0).length
  const winRate  = total > 0 ? wins / total * 100 : 0

  // Compound returns: multiply (1 + pnl%) for each trade
  let balance = 10000
  let totalPnlPct = 0
  for (const t of closed) {
    const pct = t.pnl_pct ?? 0
    balance *= (1 + pct / 100)
  }
  const totalPnl = balance - 10000
  totalPnlPct = (balance / 10000 - 1) * 100

  return { total, wins, winRate, totalPnl, balance, totalPnlPct }
}
