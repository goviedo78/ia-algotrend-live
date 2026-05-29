import { NextRequest, NextResponse } from 'next/server'
import { runAlgoTrend, type AlgoTrendResult, type Candle } from '@/lib/algotrend'
import { openTrade, closeTrade, getOpenTrade, getAllTrades, updateOpenTradeRisk, getSetting } from '@/lib/db'
import { notifyOpen, notifyClose } from '@/lib/telegram'
import { emailOpen, emailClose } from '@/lib/email'
import { logEvent } from '@/lib/analytics'
import { latestAtrPercent } from '@/lib/atr'
import { sendPushNotification } from '@/lib/push'
import { safeExecuteBingxClose, safeExecuteBingxOpen } from '@/lib/bingx'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PAIR = 'btcusd'
const STEP = 3600
const HISTORY_BATCHES = 12

type TradeDirection = 'LONG' | 'SHORT'
type CloseReason = 'SL' | 'TP' | 'SIGNAL' | null
type ActionableSignal = {
  signal: TradeDirection
  result: AlgoTrendResult
  candle: Candle
  source: 'latest' | 'catch_up'
}
type OpenTrade = NonNullable<Awaited<ReturnType<typeof getOpenTrade>>>
type TradeRiskState = {
  stopLoss: number
  takeProfit: number | null
}

function directionLabel(direction: TradeDirection) {
  return direction === 'LONG' ? 'Largo' : 'Corto'
}

function closeReasonLabel(reason: CloseReason) {
  if (reason === 'TP') return 'objetivo'
  if (reason === 'SL') return 'stop'
  if (reason === 'SIGNAL') return 'señal contraria'
  return 'cierre'
}

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
    const resp = await fetch(reqUrl, { next: { revalidate: 55 } }).then(r => r.json()) as { data: { ohlc: BitstampOhlcEntry[] } }
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

async function sendPushDirect(payload: { title: string; body: string; tag: string }) {
  try {
    const result = await sendPushNotification(payload)
    console.log('[cron push]', result)
  } catch (err) {
    console.error('[cron push]', err)
    await logEvent('push_fail', { title: payload.title, error: String(err) })
  }
}

function isAuthorizedCronRequest(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.replace(/\\n/g, '').trim()
  if (!cronSecret) {
    return false
  }

  const authHeader = req.headers.get('authorization')?.trim()
  const headerSecret = req.headers.get('x-cron-secret')?.trim()
  const querySecret =
    req.nextUrl.searchParams.get('secret')?.trim() ??
    req.nextUrl.searchParams.get('token')?.trim()

  return (
    authHeader === `Bearer ${cronSecret}` ||
    headerSecret === cronSecret ||
    querySecret === cronSecret
  )
}

function signalFromResult(result: AlgoTrendResult): TradeDirection | null {
  return result.longSig ? 'LONG' : result.shortSig ? 'SHORT' : null
}

async function closeAndNotifyTrade(
  tradeToClose: OpenTrade,
  closeTime: number,
  closePrice: number,
  reason: Exclude<CloseReason, null>,
  actions: string[],
) {
  const trade = await closeTrade(tradeToClose.id, closeTime, closePrice, reason)
  await safeExecuteBingxClose(trade, actions)
  await notifyClose(trade)
  await sendPushDirect({
    title: `⚪ AlgoTrend — Salida ${directionLabel(trade.direction)}`,
    body: `Precio: $${trade.close_price?.toLocaleString('es-MX')} | Resultado: ${trade.pnl_pct?.toFixed(2)}% (${closeReasonLabel(trade.close_reason)})`,
    tag: `close-${trade.id}`
  })
  await emailClose(trade.direction, trade.open_price, trade.close_price ?? 0, trade.pnl_pct, trade.close_reason ?? reason)
  actions.push(`closed_${reason}_${closeTime}`)
  return trade
}

function evaluateTradeCandle(
  existingTrade: OpenTrade,
  state: TradeRiskState,
  candle: Candle,
): { hit: Exclude<CloseReason, null>; closePrice: number } | null {
  const { open: o, high: h, low: l, close: price } = candle
  const path: ('high' | 'low')[] = Math.abs(o - h) < Math.abs(o - l) ? ['high', 'low'] : ['low', 'high']
  const trailTriggerPct = 1.0
  const trailOffsetPct = 0.3

  const hitPath = (leg: 'high' | 'low') => {
    if (existingTrade.direction === 'LONG') {
      if (leg === 'low' && l <= state.stopLoss) return { hit: 'SL' as const, closePrice: state.stopLoss }
      if (leg === 'high' && state.takeProfit !== null && h >= state.takeProfit) return { hit: 'TP' as const, closePrice: state.takeProfit }
      return null
    }
    if (leg === 'high' && h >= state.stopLoss) return { hit: 'SL' as const, closePrice: state.stopLoss }
    if (leg === 'low' && state.takeProfit !== null && l <= state.takeProfit) return { hit: 'TP' as const, closePrice: state.takeProfit }
    return null
  }

  const firstHit = hitPath(path[0])
  if (firstHit) return firstHit

  const secondHit = hitPath(path[1])
  if (secondHit) return secondHit

  if (existingTrade.direction === 'LONG') {
    const gainPct = ((h - existingTrade.open_price) / existingTrade.open_price) * 100
    if (gainPct >= trailTriggerPct) {
      const trail = h * (1 - trailOffsetPct / 100)
      state.stopLoss = Math.max(existingTrade.open_price, state.stopLoss, trail)
      state.takeProfit = null
    }
  } else {
    const gainPct = ((existingTrade.open_price - l) / existingTrade.open_price) * 100
    if (gainPct >= trailTriggerPct) {
      const trail = l * (1 + trailOffsetPct / 100)
      state.stopLoss = Math.min(existingTrade.open_price, state.stopLoss, trail)
      state.takeProfit = null
    }
  }

  const closeHit = existingTrade.direction === 'LONG'
    ? (price <= state.stopLoss ? 'SL' : (state.takeProfit !== null && price >= state.takeProfit ? 'TP' : null))
    : (price >= state.stopLoss ? 'SL' : (state.takeProfit !== null && price <= state.takeProfit ? 'TP' : null))

  return closeHit ? { hit: closeHit, closePrice: price } : null
}

function isSignalStillOpen(signal: TradeDirection, result: AlgoTrendResult, candlesAfterSignal: Candle[]) {
  const openPrice = result.close
  let stopLoss = signal === 'LONG' ? result.longStop : result.shortStop
  let takeProfit: number | null = signal === 'LONG' ? result.longTp : result.shortTp
  const trailTriggerPct = 1.0
  const trailOffsetPct = 0.3

  for (const candle of candlesAfterSignal) {
    const { open: o, high: h, low: l, close: price } = candle
    const path: ('high' | 'low')[] = Math.abs(o - h) < Math.abs(o - l) ? ['high', 'low'] : ['low', 'high']

    const hitPath = (leg: 'high' | 'low') => {
      if (signal === 'LONG') {
        if (leg === 'low' && l <= stopLoss) return true
        if (leg === 'high' && takeProfit !== null && h >= takeProfit) return true
        return false
      }
      if (leg === 'high' && h >= stopLoss) return true
      if (leg === 'low' && takeProfit !== null && l <= takeProfit) return true
      return false
    }

    if (hitPath(path[0]) || hitPath(path[1])) return false

    if (signal === 'LONG') {
      const gainPct = ((h - openPrice) / openPrice) * 100
      if (gainPct >= trailTriggerPct) {
        const trail = h * (1 - trailOffsetPct / 100)
        stopLoss = Math.max(openPrice, stopLoss, trail)
        takeProfit = null
      }
    } else {
      const gainPct = ((openPrice - l) / openPrice) * 100
      if (gainPct >= trailTriggerPct) {
        const trail = l * (1 + trailOffsetPct / 100)
        stopLoss = Math.min(openPrice, stopLoss, trail)
        takeProfit = null
      }
    }

    const closeHit = signal === 'LONG'
      ? (price <= stopLoss || (takeProfit !== null && price >= takeProfit))
      : (price >= stopLoss || (takeProfit !== null && price <= takeProfit))

    if (closeHit) return false
  }

  return true
}

async function findActionableSignal(
  results: AlgoTrendResult[],
  candles: Candle[],
  last: AlgoTrendResult,
  lastCandle: Candle,
  existingTrade: Awaited<ReturnType<typeof getOpenTrade>>,
  actions: string[]
): Promise<ActionableSignal | null> {
  const latestSignal = signalFromResult(last)
  if (latestSignal) {
    return { signal: latestSignal, result: last, candle: lastCandle, source: 'latest' }
  }

  if (existingTrade) return null

  const latestKnownTrade = (await getAllTrades(1))[0]
  const latestKnownTime = latestKnownTrade
    ? Math.max(
        latestKnownTrade.signal_time ?? 0,
        latestKnownTrade.open_time ?? 0,
        latestKnownTrade.close_time ?? 0,
      )
    : 0

  const lookbackStart = Math.max(0, results.length - 13)
  for (let i = results.length - 2; i >= lookbackStart; i--) {
    const result = results[i]
    const missedSignal = signalFromResult(result)
    if (!missedSignal || result.time <= latestKnownTime) continue

    const candlesAfterSignal = candles.slice(i + 1)
    if (!isSignalStillOpen(missedSignal, result, candlesAfterSignal)) {
      actions.push(`missed_${missedSignal}_already_closed_${result.time}`)
      return null
    }

    actions.push(`catch_up_${missedSignal}_${result.time}`)
    return {
      signal: missedSignal,
      result,
      candle: candles[i],
      source: 'catch_up',
    }
  }

  return null
}

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (Fail-Closed). Uses isAuthorizedCronRequest() which
    // already sanitizes CRON_SECRET (strips literal "\n" + trim) and accepts
    // Bearer header, x-cron-secret header, or ?secret/?token query param.
    if (!isAuthorizedCronRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let candles = await fetchCandles()
    if (candles.length === 0) {
      return NextResponse.json({ ok: true, action: 'no_candles' })
    }

    // Strip the current OPEN candle — Bitstamp includes it as the last entry.
    // We only analyze CLOSED candles, just like TradingView/Pine Script.
    const nowHour = Math.floor(Date.now() / 1000 / STEP) * STEP
    if (candles[candles.length - 1].time >= nowHour) {
      candles = candles.slice(0, -1)
    }
    if (candles.length === 0) {
      return NextResponse.json({ ok: true, action: 'no_closed_candles' })
    }

    const results = runAlgoTrend(candles)
    const last = results[results.length - 1]
    if (!last) {
      return NextResponse.json({ ok: true, action: 'no_results' })
    }

    const lastCandle = candles[candles.length - 1]
    const actions: string[] = []

    // ── 1. Check if there's an open trade that needs SL/TP management ──
    //
    // Important BTC 1H contract:
    // ORIGINAL_BASE.pine uses process_orders_on_close=true, calc_on_every_tick=false,
    // SL=2% percentage, TP=1.5 R:R, trailing ON at 1.0% trigger / 0.3% offset,
    // and commission_value=0.0. Do not switch this route to SuperTrend SL,
    // tp_rr=1.0, trailing OFF, or paid-TV commission unless the Pine base changes.
    //
    // Cron can miss executions. When it resumes, managing only the last closed
    // candle can skip an SL/TP/trailing exit that happened during downtime.
    // Therefore we reconstruct the open trade from its original entry risk
    // levels and replay every CLOSED candle after open_time. The DB may already
    // contain a trail-updated stop, so replay must start from the engine's
    // original signal candle levels, not the current DB stop/take_profit.
    let existingTrade = await getOpenTrade()
    if (existingTrade) {
      const entryResult = results.find((result) => result.time === existingTrade?.signal_time)
      const state: TradeRiskState = {
        stopLoss: entryResult
          ? (existingTrade.direction === 'LONG' ? entryResult.longStop : entryResult.shortStop)
          : existingTrade.stop_loss,
        takeProfit: entryResult
          ? (existingTrade.direction === 'LONG' ? entryResult.longTp : entryResult.shortTp)
          : existingTrade.take_profit,
      }
      const openTime = existingTrade.open_time
      const candlesToManage = candles.filter((candle) => candle.time > openTime)
      let closed = false

      for (const candle of candlesToManage) {
        const hit = evaluateTradeCandle(existingTrade, state, candle)
        if (hit) {
          await closeAndNotifyTrade(existingTrade, candle.time, hit.closePrice, hit.hit, actions)
          closed = true
          existingTrade = null
          break
        }
      }

      if (!closed && existingTrade) {
        if (state.stopLoss !== existingTrade.stop_loss || state.takeProfit !== existingTrade.take_profit) {
          existingTrade = await updateOpenTradeRisk(existingTrade.id, state.stopLoss, state.takeProfit)
          actions.push('trailing_updated')
        }
        actions.push(`trade_monitored_${candlesToManage.length}_candles`)
      }
    }

    // ── 2. Open new trade if signal detected ──
    const actionableSignal = await findActionableSignal(results, candles, last, lastCandle, existingTrade, actions)
    if (actionableSignal) {
      const { signal, result: signalResult } = actionableSignal
      const ATR_PERIOD = 14
      const signalIndex = candles.findIndex((candle) => candle.time === signalResult.time)
      const atrPct = signalIndex >= 0 ? latestAtrPercent(candles.slice(0, signalIndex + 1), ATR_PERIOD) : latestAtrPercent(candles, ATR_PERIOD)

      // ── ATR Filter (opt-in via env var OR db setting) ──
      const dbEnabled = await getSetting('atr_filter_enabled')
      const envEnabled = process.env.ATR_FILTER_ENABLED === 'true'
      const atrFilterOn = dbEnabled === 'true' || envEnabled
      let atrBlocked = false

      if (atrFilterOn) {
        const dbThreshold = await getSetting('atr_threshold')
        const ATR_THRESHOLD = parseFloat(dbThreshold || process.env.ATR_THRESHOLD || '0.40')

        if (atrPct !== null && atrPct < ATR_THRESHOLD) {
          atrBlocked = true
          await logEvent('signal_filtered_atr', {
            signal, price: signalResult.close, atrPct: +atrPct.toFixed(3),
            threshold: ATR_THRESHOLD,
          })
          actions.push(`atr_filtered_${signal}_${atrPct.toFixed(2)}pct`)
        }
      }

      if (!atrBlocked) {
        if (existingTrade?.direction === signal) {
          actions.push(`signal_${signal}_same_side_ignored`)
        } else {
          if (existingTrade) {
            await closeAndNotifyTrade(existingTrade, signalResult.time, signalResult.close, 'SIGNAL', actions)
            existingTrade = null
          }

          const stop = signal === 'LONG' ? signalResult.longStop : signalResult.shortStop
          const tp = signal === 'LONG' ? signalResult.longTp : signalResult.shortTp
          const trade = await openTrade(signal, signalResult.time, signalResult.time, signalResult.close, stop, tp, atrPct !== null ? +atrPct.toFixed(3) : null)

          if (trade) {
            const prob = signal === 'LONG' ? signalResult.probUp : signalResult.probDown
            const probText = (prob * 100).toFixed(1) + '%'

            await safeExecuteBingxOpen(trade, actions)
            await notifyOpen(trade)

            const emoji = signal === 'LONG' ? '🟢' : '🔴'
            const dir = signal === 'LONG' ? 'LARGO' : 'CORTO'

            await sendPushDirect({
              title: `${emoji} AlgoTrend — ${dir} (${probText})`,
              body: `Entrada: $${signalResult.close.toLocaleString('es-MX')} (ATR = ${atrPct !== null ? atrPct.toFixed(2) : '—'}%) | Stop: $${stop.toLocaleString('es-MX')} | Objetivo: ${tp ? '$' + tp.toLocaleString('es-MX') : 'Stop móvil'}`,
              tag: `signal-${signalResult.time}`,
            })

            await emailOpen(signal, signalResult.close, stop, tp, prob)

            actions.push(`opened_${signal}_${actionableSignal.source}`)
          } else {
            actions.push('signal_already_processed')
          }
        }
      } // end !atrBlocked
    }

    return NextResponse.json({
      ok: true,
      time: last.time,
      price: last.close,
      signal: actionableSignal?.signal ?? null,
      probUp: last.probUp,
      probDown: last.probDown,
      actions,
    })
  } catch (err) {
    console.error('[cron/check]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
