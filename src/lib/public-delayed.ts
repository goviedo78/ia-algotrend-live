// Public delayed read-layer for the official site.
// Reads ONLY from `public_algotrend_trades_delayed` (Supabase view).
// The view enforces a 24h cutoff on signal visibility and a separate 24h
// cutoff on trade closure, so anything we read is already safe to expose.
//
// Defense in depth: this module is the only Supabase entry point used by
// /official routes. It must not be used to read base tables.

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

const VIEW = 'public_algotrend_trades_delayed'
const TAG_BTC_1H = 'public-delayed-trades-btc-1h'

// Prefer the anon key when available so the request goes through RLS and
// the base table stays unreachable even if this module is misused.
// Falls back to service role until NEXT_PUBLIC_SUPABASE_ANON_KEY is added.
function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('public_delayed_missing_supabase_env')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type PublicTradeStatus = 'OPEN' | 'CLOSED'
export type PublicTradeDirection = 'LONG' | 'SHORT'
export type PublicCloseReason = 'SL' | 'TP' | 'SIGNAL'

export interface PublicDelayedTrade {
  id: number
  signal_time: number
  open_time: number
  direction: PublicTradeDirection
  open_price: number
  stop_loss: number | null
  take_profit: number | null
  atr_pct: number | null
  close_time: number | null
  status: PublicTradeStatus
  close_price: number | null
  close_reason: PublicCloseReason | null
  pnl_usd: number | null
  pnl_pct: number | null
}

async function fetchPublicTradesBtc1h(limit: number): Promise<PublicDelayedTrade[]> {
  const { data, error } = await publicClient()
    .from(VIEW)
    .select(
      'id,signal_time,open_time,direction,open_price,stop_loss,take_profit,atr_pct,close_time,status,close_price,close_reason,pnl_usd,pnl_pct'
    )
    .order('signal_time', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`public_delayed_query_failed: ${error.message}`)
  return (data ?? []) as PublicDelayedTrade[]
}

/**
 * Returns the most recent delayed trades for BTC 1H, cached for 10 minutes
 * (data is immutable past the 24h cutoff so a stale window of minutes is safe).
 */
export const getPublicTradesBtc1h = unstable_cache(
  async (limit = 120) => fetchPublicTradesBtc1h(limit),
  ['public-delayed-trades-btc-1h-v1'],
  { revalidate: 600, tags: [TAG_BTC_1H] }
)
