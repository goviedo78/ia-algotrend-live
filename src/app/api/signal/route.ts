import { NextRequest, NextResponse } from 'next/server'
import { openTrade, closeTrade, getOpenTrade } from '@/lib/db'
import { notifyOpen, notifyClose } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

// Called by the browser whenever a new candle closes with engine results
// Body: { signal: 'LONG'|'SHORT'|null, time, price, stop, tp }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { signal, time, price, stop, tp } = body as {
      signal: 'LONG' | 'SHORT' | null
      time: number
      price: number
      stop: number
      tp: number
    }

    const openTrade_ = getOpenTrade()

    // Check SL/TP hit on open trade
    if (openTrade_) {
      const hitSL = openTrade_.direction === 'LONG'
        ? price <= openTrade_.stop_loss
        : price >= openTrade_.stop_loss
      const hitTP = openTrade_.direction === 'LONG'
        ? price >= openTrade_.take_profit
        : price <= openTrade_.take_profit

      if (hitSL) {
        const closed = closeTrade(openTrade_.id, time, openTrade_.stop_loss, 'SL')
        await notifyClose(closed)
      } else if (hitTP) {
        const closed = closeTrade(openTrade_.id, time, openTrade_.take_profit, 'TP')
        await notifyClose(closed)
      }
    }

    // Open new trade on signal
    if (signal === 'LONG' || signal === 'SHORT') {
      const trade = openTrade(signal, time, price, stop, tp)
      await notifyOpen(trade)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[signal]', err)
    return NextResponse.json({ error: 'Signal error' }, { status: 500 })
  }
}
