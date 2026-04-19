import { NextResponse } from 'next/server'
import { runAlgoTrend, type Candle } from '@/lib/algotrend'

export const dynamic = 'force-dynamic'

const PAIR = 'btcusd'
const STEP = 3600
const HISTORY_BATCHES = 12

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

export async function GET() {
  try {
    let candles = await fetchCandles()

    // Strip current open candle
    const nowHour = Math.floor(Date.now() / 1000 / STEP) * STEP
    if (candles[candles.length - 1].time >= nowHour) {
      candles = candles.slice(0, -1)
    }

    const results = runAlgoTrend(candles)

    // Last 15 candles with full diagnostic data
    const lastN = 15
    const diagnostics = results.slice(-lastN).map((r, idx) => {
      const globalIdx = results.length - lastN + idx
      const c = candles[globalIdx]
      const dt = new Date(r.time * 1000).toISOString()
      return {
        bar: globalIdx,
        time: dt.replace('T', ' ').substring(0, 19) + ' UTC',
        close: r.close,
        supertrend: +r.supertrend.toFixed(2),
        stDirection: r.stDirection,
        lastStDir: r.lastStDir,
        probUp: +(r.probUp * 100).toFixed(2),
        probDown: +(r.probDown * 100).toFixed(2),
        longSig: r.longSig,
        shortSig: r.shortSig,
        candle: c ? { o: c.open, h: c.high, l: c.low, c: c.close } : null,
      }
    })

    return NextResponse.json({
      totalCandles: candles.length,
      totalResults: results.length,
      diagnostics,
    })
  } catch (err) {
    console.error('[debug/engine]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
