import { NextRequest, NextResponse } from 'next/server'
import { openTrade, closeTrade, getOpenTrade, updateOpenTradeRisk, type Trade } from '@/lib/db'
import { notifyOpen, notifyClose } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

function directionLabel(direction: Trade['direction']) {
  return direction === 'LONG' ? 'Largo' : 'Corto'
}

function closeReasonLabel(reason: Trade['close_reason']) {
  if (reason === 'TP') return 'objetivo'
  if (reason === 'SL') return 'stop'
  if (reason === 'SIGNAL') return 'señal contraria'
  return 'cierre'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { signal, time, price, stop, tp, open, high, low, probUp, probDown } = body as {
      signal: 'LONG' | 'SHORT' | null
      time: number
      price: number
      stop: number
      tp: number
      open?: number
      high?: number
      low?: number
      probUp?: number
      probDown?: number
    }

    const openTrade_ = await getOpenTrade()

    if (openTrade_) {
      const o = typeof open === 'number' ? open : price
      const h = typeof high === 'number' ? high : price
      const l = typeof low === 'number' ? low : price

      const trailTriggerPct = 1.0
      const trailOffsetPct = 0.3

      let stopLoss = openTrade_.stop_loss
      let takeProfit: number | null = openTrade_.take_profit

      const path: ('high' | 'low')[] = Math.abs(o - h) < Math.abs(o - l) ? ['high', 'low'] : ['low', 'high']

      const hitPath = (leg: 'high' | 'low') => {
        if (openTrade_.direction === 'LONG') {
          if (leg === 'low' && l <= stopLoss) return { hit: 'SL' as const, closePrice: stopLoss }
          if (leg === 'high' && takeProfit !== null && h >= takeProfit) return { hit: 'TP' as const, closePrice: takeProfit }
          return null
        }
        if (leg === 'high' && h >= stopLoss) return { hit: 'SL' as const, closePrice: stopLoss }
        if (leg === 'low' && takeProfit !== null && l <= takeProfit) return { hit: 'TP' as const, closePrice: takeProfit }
        return null
      }

      const firstHit = hitPath(path[0])
      if (firstHit) {
        const closed = await closeTrade(openTrade_.id, time, firstHit.closePrice, firstHit.hit)
        await notifyClose(closed)
        await sendPush(req, {
          title: `⚪ AlgoTrend — Salida ${directionLabel(closed.direction)}`,
          body: `Precio: $${closed.close_price?.toLocaleString('es-MX')} | Resultado: ${closed.pnl_pct?.toFixed(2)}% (${closeReasonLabel(closed.close_reason)})`,
          tag: `close-${closed.id}`
        })
      } else {
        const secondHit = hitPath(path[1])
        if (secondHit) {
          const closed = await closeTrade(openTrade_.id, time, secondHit.closePrice, secondHit.hit)
          await notifyClose(closed)
          await sendPush(req, {
            title: `⚪ AlgoTrend — Salida ${directionLabel(closed.direction)}`,
            body: `Precio: $${closed.close_price?.toLocaleString('es-MX')} | Resultado: ${closed.pnl_pct?.toFixed(2)}% (${closeReasonLabel(closed.close_reason)})`,
            tag: `close-${closed.id}`
          })
        } else {
          // Trailing update with the same defaults used in the strategy.
          if (openTrade_.direction === 'LONG') {
            const gainPct = ((h - openTrade_.open_price) / openTrade_.open_price) * 100
            if (gainPct >= trailTriggerPct) {
              const trail = h * (1 - trailOffsetPct / 100)
              stopLoss = Math.max(openTrade_.open_price, stopLoss, trail)
              takeProfit = null
            }
          } else {
            const gainPct = ((openTrade_.open_price - l) / openTrade_.open_price) * 100
            if (gainPct >= trailTriggerPct) {
              const trail = l * (1 + trailOffsetPct / 100)
              stopLoss = Math.min(openTrade_.open_price, stopLoss, trail)
              takeProfit = null
            }
          }

          // Close-bar confirmation after trailing update.
          const closeHit = openTrade_.direction === 'LONG'
            ? (price <= stopLoss ? 'SL' : (takeProfit !== null && price >= takeProfit ? 'TP' : null))
            : (price >= stopLoss ? 'SL' : (takeProfit !== null && price <= takeProfit ? 'TP' : null))

          if (closeHit) {
            const closed = await closeTrade(openTrade_.id, time, price, closeHit)
            await notifyClose(closed)
            await sendPush(req, {
              title: `⚪ AlgoTrend — Salida ${directionLabel(closed.direction)}`,
              body: `Precio: $${closed.close_price?.toLocaleString('es-MX')} | Resultado: ${closed.pnl_pct?.toFixed(2)}% (${closeReasonLabel(closed.close_reason)})`,
              tag: `close-${closed.id}`
            })
          } else if (stopLoss !== openTrade_.stop_loss || takeProfit !== openTrade_.take_profit) {
            await updateOpenTradeRisk(openTrade_.id, stopLoss, takeProfit)
          }
        }
      }
    }

    if (signal === 'LONG' || signal === 'SHORT') {
      const trade = await openTrade(signal, time, time, price, stop, tp)

      if (trade) {
        const prob = signal === 'LONG' ? (probUp ?? 0) : (probDown ?? 0)
        const probText = (prob * 100).toFixed(1) + '%'

        await notifyOpen(trade)

        const emoji = signal === 'LONG' ? '🟢' : '🔴'
        const dir = signal === 'LONG' ? 'LARGO' : 'CORTO'

        await sendPush(req, {
          title: `${emoji} AlgoTrend — ${dir} (${probText})`,
          body: `Entrada: $${price.toLocaleString('es-MX')} | Stop: $${stop.toLocaleString('es-MX')} | Objetivo: ${tp ? '$' + tp.toLocaleString('es-MX') : 'Stop móvil'}`,
          tag: `signal-${time}`,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[signal]', err)
    return NextResponse.json({ error: 'Signal error' }, { status: 500 })
  }
}

async function sendPush(req: NextRequest, payload: { title: string; body: string; tag: string }) {
  try {
    await fetch(new URL('/api/push/send', req.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[push notify]', err)
  }
}
