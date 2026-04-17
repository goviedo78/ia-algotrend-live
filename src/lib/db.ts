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
  open_time: number
  open_price: number
  stop_loss: number
  take_profit: number
  close_time: number | null
  close_price: number | null
  close_reason: CloseReason | null
  pnl_usd: number | null
  pnl_pct: number | null
  status: TradeStatus
}

const TABLE = 'algotrend_trades'
const POSITION_SIZE_USD = 10000

export async function openTrade(
  direction: TradeDirection,
  openTime: number,
  openPrice: number,
  stopLoss: number,
  takeProfit: number
): Promise<Trade> {
  // Close any open trade first
  const open = await getOpenTrade()
  if (open) await closeTrade(open.id, openTime, openPrice, 'SIGNAL')

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ direction, open_time: openTime, open_price: openPrice, stop_loss: stopLoss, take_profit: takeProfit, status: 'OPEN' })
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
  const pnlUsd = POSITION_SIZE_USD * pnlPct / 100

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
  const { data } = await supabase.from(TABLE).select().eq('status', 'CLOSED')
  const closed   = (data ?? []) as Trade[]
  const total    = closed.length
  const wins     = closed.filter(t => (t.pnl_usd ?? 0) > 0).length
  const totalPnl = closed.reduce((s, t) => s + (t.pnl_usd ?? 0), 0)
  const winRate  = total > 0 ? wins / total * 100 : 0
  return { total, wins, winRate, totalPnl, balance: 10000 + totalPnl }
}
