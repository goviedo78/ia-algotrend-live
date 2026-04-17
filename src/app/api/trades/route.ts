import { NextResponse } from 'next/server'
import { getAllTrades, getOpenTrade, getStats } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const trades   = getAllTrades(200)
    const openTrade = getOpenTrade()
    const stats    = getStats()
    return NextResponse.json({ trades, openTrade, stats })
  } catch (err) {
    console.error('[trades]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
