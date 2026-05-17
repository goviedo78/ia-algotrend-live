import { NextResponse } from 'next/server'
import type { Candle } from '@/lib/algotrend'

export const revalidate = 60

const PAIR = 'btcusd'
const STEP = 3600
const HISTORY_BATCHES = 5

interface BitstampOhlcEntry {
  timestamp: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

function parseOhlc(entries: BitstampOhlcEntry[]): Candle[] {
  return entries.map((entry) => ({
    time: parseInt(entry.timestamp),
    open: parseFloat(entry.open),
    high: parseFloat(entry.high),
    low: parseFloat(entry.low),
    close: parseFloat(entry.close),
    volume: parseFloat(entry.volume),
  }))
}

async function getFreshCandles() {
  const baseUrl = `https://www.bitstamp.net/api/v2/ohlc/${PAIR}/?step=${STEP}&limit=1000`
  const batches: Candle[][] = []
  let nextEnd: number | null = null

  for (let i = 0; i < HISTORY_BATCHES; i++) {
    const reqUrl = nextEnd === null ? baseUrl : `${baseUrl}&end=${nextEnd}`
    const resp = await fetch(reqUrl, { next: { revalidate: 55 } }).then((res) => res.json()) as { data: { ohlc: BitstampOhlcEntry[] } }
    const ohlc = resp.data?.ohlc ?? []
    if (ohlc.length === 0) break

    batches.unshift(parseOhlc(ohlc))
    const oldest = parseInt(ohlc[0].timestamp)
    nextEnd = oldest - 1
    if (ohlc.length < 1000) break
  }

  const all = batches.flat()
  const seen = new Set<number>()
  return all
    .filter((candle) => seen.has(candle.time) ? false : (seen.add(candle.time), true))
    .sort((a, b) => a.time - b.time)
}

export async function GET() {
  try {
    const data = await getFreshCandles()

    return NextResponse.json({ code: 0, data }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (err) {
    console.error('[candles proxy]', err)
    return NextResponse.json({ error: 'Failed to fetch candles' }, { status: 500 })
  }
}
