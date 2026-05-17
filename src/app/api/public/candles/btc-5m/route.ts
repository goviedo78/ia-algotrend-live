// Public delayed candles endpoint for BTC 5M.
// Used by the official backtesting trainer, never by the live desk.

import { NextResponse } from 'next/server'
import { getPublicCandlesDelayed, getPublicDelayHours } from '@/lib/public-candles'

export const revalidate = 3600

export async function GET() {
  try {
    const data = await getPublicCandlesDelayed({
      limit: 1000,
      step: 300,
      tag: 'public-candles-btc-5m',
    })

    return NextResponse.json(
      { code: 0, data },
      {
        headers: {
          'Cache-Control':
            'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
          'X-Delay-Hours': String(getPublicDelayHours()),
        },
      }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ code: 1, error: msg }, { status: 502 })
  }
}
