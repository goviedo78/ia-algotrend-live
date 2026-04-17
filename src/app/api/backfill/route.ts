import { NextResponse } from 'next/server'
import { runAlgoTrend, type Candle } from '@/lib/algotrend'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLE = 'algotrend_trades'
const PAIR  = 'btcusd'
const STEP  = 3600

interface BitstampOhlcEntry {
  timestamp: string; open: string; high: string; low: string; close: string; volume: string
}

async function fetchCandles(): Promise<Candle[]> {
  const url  = `https://www.bitstamp.net/api/v2/ohlc/${PAIR}/?step=${STEP}&limit=1000`
  const r1   = await fetch(url).then(r => r.json()) as { data: { ohlc: BitstampOhlcEntry[] } }
  const ohlc1 = r1.data.ohlc
  const oldest = parseInt(ohlc1[0].timestamp)
  const r2 = await fetch(`${url}&end=${oldest - 1}`).then(r => r.json()) as { data: { ohlc: BitstampOhlcEntry[] } }

  const parse = (arr: BitstampOhlcEntry[]): Candle[] => arr.map(e => ({
    time: parseInt(e.timestamp),
    open: parseFloat(e.open), high: parseFloat(e.high),
    low:  parseFloat(e.low),  close: parseFloat(e.close),
    volume: parseFloat(e.volume),
  }))

  const all  = [...parse(r2.data.ohlc), ...parse(ohlc1)]
  const seen = new Set<number>()
  return all.filter(c => seen.has(c.time) ? false : (seen.add(c.time), true)).sort((a, b) => a.time - b.time)
}

// Mini-backtester: simulate trades from signals
function simulateTrades(candles: Candle[], results: ReturnType<typeof runAlgoTrend>, count = 20) {
  type SimTrade = {
    direction: 'LONG' | 'SHORT'
    open_time: number; open_price: number
    stop_loss: number; take_profit: number
    close_time: number; close_price: number
    close_reason: 'SL' | 'TP' | 'SIGNAL'
    pnl_usd: number; pnl_pct: number
    status: 'CLOSED'
  }

  const trades: SimTrade[] = []

  // Collect signal indices
  const signals = results
    .map((r, i) => ({ i, r }))
    .filter(({ r }) => r.longSig || r.shortSig)

  // Take last `count` signals
  const window = signals.slice(-count)

  for (let s = 0; s < window.length; s++) {
    const { i, r } = window[s]
    const direction: 'LONG' | 'SHORT' = r.longSig ? 'LONG' : 'SHORT'
    const openPrice = r.close
    const stopLoss  = direction === 'LONG' ? r.longStop  : r.shortStop
    const takePro   = direction === 'LONG' ? r.longTp    : r.shortTp

    let closeBar   = candles.length - 1
    let closePrice = candles[closeBar].close
    let closeReason: 'SL' | 'TP' | 'SIGNAL' = 'SIGNAL'

    // Next signal index (to close on reversal)
    const nextSigIdx = window[s + 1]?.i ?? Infinity

    // Walk forward to find exit
    for (let j = i + 1; j < candles.length; j++) {
      const c = candles[j]

      if (direction === 'LONG') {
        if (c.low <= stopLoss) {
          closePrice = stopLoss; closeReason = 'SL'; closeBar = j; break
        }
        if (c.high >= takePro) {
          closePrice = takePro; closeReason = 'TP'; closeBar = j; break
        }
      } else {
        if (c.high >= stopLoss) {
          closePrice = stopLoss; closeReason = 'SL'; closeBar = j; break
        }
        if (c.low <= takePro) {
          closePrice = takePro; closeReason = 'TP'; closeBar = j; break
        }
      }

      // Close on next opposite signal
      if (j >= nextSigIdx) {
        closePrice = results[j].close; closeReason = 'SIGNAL'; closeBar = j; break
      }
    }

    const mult   = direction === 'LONG' ? 1 : -1
    const pnlPct = (closePrice - openPrice) / openPrice * mult * 100
    const pnlUsd = 10000 * pnlPct / 100

    trades.push({
      direction, open_time: r.time, open_price: openPrice,
      stop_loss: stopLoss, take_profit: takePro,
      close_time: candles[closeBar].time, close_price: closePrice,
      close_reason: closeReason, pnl_usd: pnlUsd, pnl_pct: pnlPct, status: 'CLOSED',
    })
  }

  return trades
}

export async function POST() {
  try {
    // Clear existing trades
    await supabase.from(TABLE).delete().neq('id', 0)

    const candles = await fetchCandles()
    const results = runAlgoTrend(candles)
    const trades  = simulateTrades(candles, results, 20)

    if (trades.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, message: 'No signals found' })
    }

    const { error } = await supabase.from(TABLE).insert(trades)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, inserted: trades.length })
  } catch (err) {
    console.error('[backfill]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
