import { NextRequest, NextResponse } from 'next/server'
import { runAlgoTrend, type Candle } from '@/lib/algotrend'
import { getOpenTrade } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PAIR = 'btcusd'
const STEP = 3600
const HISTORY_BATCHES = 5

interface BitstampOhlcEntry {
  timestamp: string; open: string; high: string; low: string; close: string; volume: string
}

async function fetchCandles(): Promise<Candle[]> {
  const url = `https://www.bitstamp.net/api/v2/ohlc/${PAIR}/?step=${STEP}&limit=1000`

  const parse = (arr: BitstampOhlcEntry[]): Candle[] => arr.map(e => ({
    time: parseInt(e.timestamp),
    open: parseFloat(e.open), high: parseFloat(e.high),
    low: parseFloat(e.low), close: parseFloat(e.close),
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

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this header for cron jobs)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const candles = await fetchCandles()
    if (candles.length === 0) {
      return NextResponse.json({ ok: true, action: 'no_candles' })
    }

    const results = runAlgoTrend(candles)
    const last = results[results.length - 1]
    if (!last) {
      return NextResponse.json({ ok: true, action: 'no_results' })
    }

    const lastCandle = candles[candles.length - 1]
    const signal = last.longSig ? 'LONG' : last.shortSig ? 'SHORT' : null

    // Always call /api/signal to process SL/TP/trailing even without a new signal
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://algotrend.vercel.app'

    const signalRes = await fetch(`${baseUrl}/api/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signal,
        time: last.time,
        price: last.close,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        stop: signal === 'LONG' ? last.longStop : last.shortStop,
        tp: signal === 'LONG' ? last.longTp : last.shortTp,
        probUp: last.probUp,
        probDown: last.probDown,
      }),
    })

    const signalResult = await signalRes.json()

    // Also check if there's an open trade that needs risk management on the PREVIOUS candle
    const openTrade = await getOpenTrade()

    return NextResponse.json({
      ok: true,
      time: last.time,
      price: last.close,
      signal,
      probUp: last.probUp,
      probDown: last.probDown,
      hasOpenTrade: !!openTrade,
      signalResult,
    })
  } catch (err) {
    console.error('[cron/check]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
