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
const HISTORY_BATCHES = 12
const TRADES_TO_STORE = 60

interface BitstampOhlcEntry {
  timestamp: string; open: string; high: string; low: string; close: string; volume: string
}

async function fetchCandles(): Promise<Candle[]> {
  const url  = `https://www.bitstamp.net/api/v2/ohlc/${PAIR}/?step=${STEP}&limit=1000`

  const parse = (arr: BitstampOhlcEntry[]): Candle[] => arr.map(e => ({
    time: parseInt(e.timestamp),
    open: parseFloat(e.open), high: parseFloat(e.high),
    low:  parseFloat(e.low),  close: parseFloat(e.close),
    volume: parseFloat(e.volume),
  }))

  const batches: Candle[][] = []
  let nextEnd: number | null = null

  for (let i = 0; i < HISTORY_BATCHES; i++) {
    const reqUrl = nextEnd === null ? url : `${url}&end=${nextEnd}`
    const resp = await fetch(reqUrl).then(r => r.json()) as { data: { ohlc: BitstampOhlcEntry[] } }
    const ohlc = resp.data?.ohlc ?? []
    if (ohlc.length === 0) break
    batches.unshift(parse(ohlc))
    const oldest = parseInt(ohlc[0].timestamp)
    nextEnd = oldest - 1
    if (ohlc.length < 1000) break
  }

  const all = batches.flat()
  const seen = new Set<number>()
  return all.filter(c => seen.has(c.time) ? false : (seen.add(c.time), true)).sort((a, b) => a.time - b.time)
}

// Backtest aligned with TradingView strategy behavior (close-based script with OHLC traversal)
function simulateTrades(candles: Candle[], results: ReturnType<typeof runAlgoTrend>, count = TRADES_TO_STORE) {
  type SimTrade = {
    direction: 'LONG' | 'SHORT'
    open_time: number; open_price: number
    stop_loss: number; take_profit: number
    close_time: number; close_price: number
    close_reason: 'SL' | 'TP' | 'SIGNAL'
    pnl_usd: number; pnl_pct: number
    status: 'CLOSED'
  }

  type OpenState = {
    direction: 'LONG' | 'SHORT'
    open_time: number
    open_price: number
    stop_loss: number
    take_profit: number | null
    trailing_active: boolean
    trail_price: number | null
  }

  const TRAIL_TRIGGER_PCT = 1.0
  const TRAIL_OFFSET_PCT = 0.3

  const trades: SimTrade[] = []
  let open: OpenState | null = null

  const getPath = (c: Candle): ('high' | 'low')[] => {
    const distHigh = Math.abs(c.open - c.high)
    const distLow = Math.abs(c.open - c.low)
    return distHigh < distLow ? ['high', 'low'] : ['low', 'high']
  }

  const closeTrade = (idx: number, closePrice: number, reason: 'SL' | 'TP' | 'SIGNAL') => {
    if (!open) return
    const mult = open.direction === 'LONG' ? 1 : -1
    const pnlPct = ((closePrice - open.open_price) / open.open_price) * mult * 100
    const pnlUsd = (closePrice - open.open_price) * mult

    trades.push({
      direction: open.direction,
      open_time: open.open_time,
      open_price: open.open_price,
      stop_loss: open.stop_loss,
      take_profit: open.take_profit ?? open.stop_loss,
      close_time: candles[idx].time,
      close_price: closePrice,
      close_reason: reason,
      pnl_usd: pnlUsd,
      pnl_pct: pnlPct,
      status: 'CLOSED',
    })
    open = null
  }

  const openTrade = (idx: number, direction: 'LONG' | 'SHORT') => {
    const r = results[idx]
    open = {
      direction,
      open_time: candles[idx].time,
      open_price: candles[idx].close,
      stop_loss: direction === 'LONG' ? r.longStop : r.shortStop,
      take_profit: direction === 'LONG' ? r.longTp : r.shortTp,
      trailing_active: false,
      trail_price: null,
    }
  }

  const checkPathExit = (idx: number, leg: 'high' | 'low') => {
    if (!open) return
    const c = candles[idx]

    if (open.direction === 'LONG') {
      if (leg === 'low' && c.low <= open.stop_loss) {
        closeTrade(idx, open.stop_loss, 'SL')
        return
      }
      if (leg === 'high' && open.take_profit !== null && c.high >= open.take_profit) {
        closeTrade(idx, open.take_profit, 'TP')
        return
      }
    } else {
      if (leg === 'high' && c.high >= open.stop_loss) {
        closeTrade(idx, open.stop_loss, 'SL')
        return
      }
      if (leg === 'low' && open.take_profit !== null && c.low <= open.take_profit) {
        closeTrade(idx, open.take_profit, 'TP')
        return
      }
    }
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const r = results[i]
    const signalLong = Boolean(r?.longSig)
    const signalShort = Boolean(r?.shortSig)

    if (open) {
      const [firstLeg, secondLeg] = getPath(c)

      // Active stop/TP check using default TradingView intrabar path approximation.
      checkPathExit(i, firstLeg)
      if (open) checkPathExit(i, secondLeg)

      if (open !== null) {
        const position: OpenState = open as OpenState

        // Trailing update (same formulas as Pine strategy).
        if (position.direction === 'LONG') {
          const gainPct = ((c.high - position.open_price) / position.open_price) * 100
          if (!position.trailing_active && gainPct >= TRAIL_TRIGGER_PCT) {
            position.trailing_active = true
            position.trail_price = c.high * (1 - TRAIL_OFFSET_PCT / 100)
            position.stop_loss = Math.max(position.open_price, position.trail_price)
            position.take_profit = null
          }
          if (position.trailing_active) {
            const newTrail = c.high * (1 - TRAIL_OFFSET_PCT / 100)
            if (newTrail > (position.trail_price ?? -Infinity)) {
              position.trail_price = newTrail
              position.stop_loss = Math.max(position.open_price, position.trail_price)
            }
          }
        } else {
          const gainPct = ((position.open_price - c.low) / position.open_price) * 100
          if (!position.trailing_active && gainPct >= TRAIL_TRIGGER_PCT) {
            position.trailing_active = true
            position.trail_price = c.low * (1 + TRAIL_OFFSET_PCT / 100)
            position.stop_loss = Math.min(position.open_price, position.trail_price)
            position.take_profit = null
          }
          if (position.trailing_active) {
            const newTrail = c.low * (1 + TRAIL_OFFSET_PCT / 100)
            if (newTrail < (position.trail_price ?? Infinity)) {
              position.trail_price = newTrail
              position.stop_loss = Math.min(position.open_price, position.trail_price)
            }
          }
        }
      }

      if (open !== null) {
        const position: OpenState = open as OpenState

        // Close-bar validation after trailing update (matches process_orders_on_close behavior closely).
        if (position.direction === 'LONG') {
          if (c.close <= position.stop_loss) closeTrade(i, c.close, 'SL')
          else if (position.take_profit !== null && c.close >= position.take_profit) closeTrade(i, c.close, 'TP')
        } else {
          if (c.close >= position.stop_loss) closeTrade(i, c.close, 'SL')
          else if (position.take_profit !== null && c.close <= position.take_profit) closeTrade(i, c.close, 'TP')
        }
      }

      // Reverse on opposite signal at bar close.
      if (open !== null) {
        const active: OpenState = open as OpenState
        if ((active.direction === 'LONG' && signalShort) || (active.direction === 'SHORT' && signalLong)) {
          const nextDirection: 'LONG' | 'SHORT' = signalLong ? 'LONG' : 'SHORT'
          closeTrade(i, c.close, 'SIGNAL')
          openTrade(i, nextDirection)
        }
      }
    } else if (signalLong || signalShort) {
      openTrade(i, signalLong ? 'LONG' : 'SHORT')
    }
  }

  return trades.slice(-count)
}

export async function POST() {
  try {
    // Clear existing trades
    await supabase.from(TABLE).delete().neq('id', 0)

    const candles = await fetchCandles()
    const results = runAlgoTrend(candles)
    const trades  = simulateTrades(candles, results, TRADES_TO_STORE)

    if (trades.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, message: 'No se encontraron señales' })
    }

    const { error } = await supabase.from(TABLE).insert(trades)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, inserted: trades.length })
  } catch (err) {
    console.error('[backfill]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
