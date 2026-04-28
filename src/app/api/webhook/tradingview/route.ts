import { NextRequest, NextResponse } from 'next/server'
import { openTrade, closeTrade, getOpenTrade } from '@/lib/db'
import { notifyOpen, notifyClose } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

// TradingView sends alerts as JSON or plain text.
// We expect JSON with this shape from the alert message:
// {
//   "signal": "LONG" | "SHORT" | "EXIT",
//   "price": 75742,
//   "prob": 85.8,
//   "sl": 77261,
//   "tp": 73462,
//   "secret": "your-webhook-secret"
// }

async function sendPush(req: NextRequest, payload: { title: string; body: string; tag: string }) {
  try {
    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://algotrend.vercel.app'
    await fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[webhook push]', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { signal, price, prob, sl, tp, secret } = body as {
      signal: 'LONG' | 'SHORT' | 'EXIT'
      price: number
      prob?: number
      sl?: number
      tp?: number
      secret?: string
    }

    // Verify webhook secret
    const webhookSecret = process.env.WEBHOOK_SECRET
    if (webhookSecret && secret !== webhookSecret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    if (!signal || !price) {
      return NextResponse.json({ error: 'Missing signal or price' }, { status: 400 })
    }

    const now = Math.floor(Date.now() / 1000)
    const probText = prob ? `${prob.toFixed(1)}%` : ''

    // Handle EXIT signal
    if (signal === 'EXIT') {
      const existing = await getOpenTrade()
      if (existing) {
        const closed = await closeTrade(existing.id, now, price, 'SIGNAL')
        await notifyClose(closed)
        await sendPush(req, {
          title: `⚪ AlgoTrend — Salida ${closed.direction}`,
          body: `Precio: $${price.toLocaleString('en-US')} | PnL: ${closed.pnl_pct?.toFixed(2)}% (TV Webhook)`,
          tag: `close-${closed.id}`
        })
        return NextResponse.json({ ok: true, action: 'closed', trade: closed })
      }
      return NextResponse.json({ ok: true, action: 'no_open_trade' })
    }

    // Handle LONG/SHORT signal
    // First close any existing trade
    const existing = await getOpenTrade()
    if (existing) {
      const closed = await closeTrade(existing.id, now, price, 'SIGNAL')
      await notifyClose(closed)
      await sendPush(req, {
        title: `⚪ AlgoTrend — Salida ${closed.direction}`,
        body: `Precio: $${price.toLocaleString('en-US')} | PnL: ${closed.pnl_pct?.toFixed(2)}% (Reversal)`,
        tag: `close-${closed.id}`
      })
    }

    // Open new trade — bucket signal_time to the current hour so retried
    // alerts within the same candle are deduplicated by the UNIQUE index.
    const signalTime = Math.floor(now / 3600) * 3600
    const stopLoss = sl ?? (signal === 'LONG' ? price * 0.98 : price * 1.02)
    const takeProfit = tp ?? (signal === 'LONG' ? price * 1.03 : price * 0.97)
    const trade = await openTrade(signal, signalTime, now, price, stopLoss, takeProfit)

    if (!trade) {
      return NextResponse.json({ ok: true, action: 'signal_already_processed' })
    }

    await notifyOpen(trade)

    const emoji = signal === 'LONG' ? '🟢' : '🔴'
    const dir = signal === 'LONG' ? 'LARGO' : 'CORTO'

    await sendPush(req, {
      title: `${emoji} AlgoTrend — ${dir} ${probText ? `(${probText})` : ''}`,
      body: `Entrada: $${price.toLocaleString('en-US')} | SL: $${stopLoss.toLocaleString('en-US')} | TP: $${takeProfit.toLocaleString('en-US')}`,
      tag: `signal-${now}`,
    })

    return NextResponse.json({ ok: true, action: `opened_${signal}`, trade })
  } catch (err) {
    console.error('[webhook/tradingview]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
