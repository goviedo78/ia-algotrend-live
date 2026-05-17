// Public delayed candles for BTC 1H from Bitstamp.
// Bitstamp's OHLC endpoint accepts an `end` cutoff in unix seconds, which we
// pin to `now - PUBLIC_DELAY_HOURS`. Cached at the fetch layer for 1h since
// candles past the cutoff are immutable.

import type { Candle } from '@/lib/algotrend'

const DELAY_HOURS = Number(process.env.PUBLIC_DELAY_HOURS ?? 24)

interface BitstampOhlcEntry {
  timestamp: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

function parseOhlc(entries: BitstampOhlcEntry[]): Candle[] {
  return entries.map((e) => ({
    time: parseInt(e.timestamp),
    open: parseFloat(e.open),
    high: parseFloat(e.high),
    low: parseFloat(e.low),
    close: parseFloat(e.close),
    volume: parseFloat(e.volume),
  }))
}

export interface GetPublicCandlesOpts {
  pair?: string
  step?: number
  limit?: number
  tag?: string
}

export async function getPublicCandlesDelayed(
  opts: GetPublicCandlesOpts = {}
): Promise<Candle[]> {
  const pair = opts.pair ?? 'btcusd'
  const step = opts.step ?? 3600
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 1000)
  const tag = opts.tag ?? `public-candles-${pair}-${step}`
  const endTs = Math.floor(Date.now() / 1000) - DELAY_HOURS * 3600

  const url = `https://www.bitstamp.net/api/v2/ohlc/${pair}/?step=${step}&limit=${limit}&end=${endTs}`

  const resp = await fetch(url, {
    next: { revalidate: 3600, tags: [tag] },
  })

  if (!resp.ok) {
    throw new Error(`bitstamp_public_fetch_failed_${resp.status}`)
  }

  const json = (await resp.json()) as { data?: { ohlc?: BitstampOhlcEntry[] } }
  const ohlc = json.data?.ohlc ?? []
  return parseOhlc(ohlc).sort((a, b) => a.time - b.time)
}

export function getPublicDelayHours(): number {
  return DELAY_HOURS
}
