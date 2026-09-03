import { after, NextRequest, NextResponse } from 'next/server'
import { runAlgoTrend, type AlgoTrendResult, type Candle } from '@/lib/algotrend'
import { openTrade, closeTrade, getOpenTrade, getAllTrades, updateOpenTradeRisk, getSetting, type Trade } from '@/lib/db'
import { notifyOpen, notifyClose } from '@/lib/telegram'
import { emailOpen, emailClose } from '@/lib/email'
import { logEvent } from '@/lib/analytics'
import { latestAtrPercent } from '@/lib/atr'
import { evaluateOpenTradeAgainstCandle } from '@/lib/trade-management'
import { sendPushNotification } from '@/lib/push'
import {
  isLegacyBingxEnabled,
  reconcileLegacyBingxExecutions,
  safeExecuteBingxClose,
  safeExecuteBingxOpen,
} from '@/lib/bingx'
import { dispatchBrokerSignal } from '@/lib/brokers/signals'
import { safeProcessBrokerJobsInApp } from '@/lib/brokers/worker'

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
    const resp = await fetch(reqUrl, { cache: 'no-store' }).then(r => r.json()) as { data: { ohlc: BitstampOhlcEntry[] } }
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

async function queueBrokerPlatformSignal(
  trade: Trade,
  action: 'OPEN' | 'CLOSE',
  signalTime: number,
  price: number,
  actions: string[],
) {
  try {
    const result = await dispatchBrokerSignal({
      externalSignalId: `algotrend-btc-1h-${trade.id}-${action.toLowerCase()}-${signalTime}`,
      strategyCode: 'ALGOTREND_BTC_1H',
      symbol: 'BTC-USDT',
      timeframe: '1h',
      action,
      direction: trade.direction,
      signalTime: new Date(signalTime * 1000).toISOString(),
      price,
    })
    actions.push(`broker_${action.toLowerCase()}_${result.accepted}${result.duplicate ? '_duplicate' : ''}`)
  } catch (error) {
    actions.push(`broker_${action.toLowerCase()}_queue_failed`)
    await logEvent('broker_signal_queue_fail', {
      tradeId: trade.id,
      action,
      error: error instanceof Error ? error.name : 'unknown',
    })
  }
}

async function closeTradeEverywhere(trade: Trade, actions: string[]) {
  if (isLegacyBingxEnabled()) {
    await safeExecuteBingxClose(trade, actions, 'cron')
  }
  await queueBrokerPlatformSignal(
    trade,
    'CLOSE',
    trade.close_time ?? trade.signal_time,
    trade.close_price ?? trade.open_price,
    actions,
  )
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
  // El cron vuelve a analizar la última vela cerrada durante toda la hora. Si esa misma señal
  // ya abrió el trade, no debe interpretarla como un reverso y cerrarlo contra sí mismo.
  if (existingTrade && latestSignal && existingTrade.signal_time === last.time) {
    actions.push(`signal_${latestSignal}_already_open_${last.time}`)
    return null
  }
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
    after(() => safeProcessBrokerJobsInApp({
      batchSize: 50,
      maxBatches: 4,
      concurrency: 20,
      timeBudgetMs: 18_000,
    }).then(() => undefined))

    const actions: string[] = []
    try {
      await reconcileLegacyBingxExecutions(actions)
    } catch (error) {
      actions.push('bingx_reconcile_failed')
      await logEvent('bingx_reconcile_fail', {
        error: error instanceof Error ? error.name : 'unknown',
      })
    }

    let candles = await fetchCandles()
    if (candles.length === 0) {
      return NextResponse.json({ ok: true, action: 'no_candles', actions })
    }

    // Strip the current OPEN candle — Bitstamp includes it as the last entry.
    // We only analyze CLOSED candles, just like TradingView/Pine Script.
    const nowHour = Math.floor(Date.now() / 1000 / STEP) * STEP
    if (candles[candles.length - 1].time >= nowHour) {
      candles = candles.slice(0, -1)
    }
    if (candles.length === 0) {
      return NextResponse.json({ ok: true, action: 'no_closed_candles', actions })
    }

    const results = runAlgoTrend(candles)
    const last = results[results.length - 1]
    if (!last) {
      return NextResponse.json({ ok: true, action: 'no_results', actions })
    }

    const lastCandle = candles[candles.length - 1]
    let existingTradeClosedThisRun = false

    // ── 1. Check if there's an open trade that needs SL/TP management ──
    const existingTrade = await getOpenTrade()
    if (existingTrade) {
      const decision = evaluateOpenTradeAgainstCandle({
        direction: existingTrade.direction,
        signalTime: existingTrade.signal_time,
        openPrice: existingTrade.open_price,
        stopLoss: existingTrade.stop_loss,
        takeProfit: existingTrade.take_profit,
      }, lastCandle)

      if (decision.kind === 'CLOSE') {
        const trade = await closeTrade(existingTrade.id, last.time, decision.closePrice, decision.reason)
        await closeTradeEverywhere(trade, actions)
        await notifyClose(trade)
        await sendPushDirect({
          title: `⚪ AlgoTrend — Salida ${directionLabel(trade.direction)}`,
          body: `Precio: $${trade.close_price?.toLocaleString('es-MX')} | Resultado: ${trade.pnl_pct?.toFixed(2)}% (${closeReasonLabel(trade.close_reason)})`,
          tag: `close-${trade.id}`
        })
        await emailClose(trade.direction, trade.open_price, trade.close_price ?? 0, trade.pnl_pct, trade.close_reason ?? 'SL')
        existingTradeClosedThisRun = true
        actions.push(`closed_${decision.reason}`)
      } else {
        if (decision.kind === 'TRAIL') {
          await updateOpenTradeRisk(existingTrade.id, decision.stopLoss, decision.takeProfit)
          actions.push('trailing_updated')
        } else if (decision.kind === 'BEFORE_ENTRY') {
          // La vela de la señal es la de la entrada: su recorrido ocurrió antes del trade.
          actions.push(`entry_candle_not_managed_${lastCandle.time}`)
        }
        actions.push('trade_monitored')
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
        const stop = signal === 'LONG' ? signalResult.longStop : signalResult.shortStop
        const tp = signal === 'LONG' ? signalResult.longTp : signalResult.shortTp
        if (existingTrade && !existingTradeClosedThisRun) {
          const closed = await closeTrade(
            existingTrade.id,
            signalResult.time,
            signalResult.close,
            'SIGNAL',
          )
          await closeTradeEverywhere(closed, actions)
          existingTradeClosedThisRun = true
        }

        const trade = await openTrade(
          signal,
          signalResult.time,
          signalResult.time,
          signalResult.close,
          stop,
          tp,
          atrPct !== null ? +atrPct.toFixed(3) : null,
        )

        if (trade) {
          const prob = signal === 'LONG' ? signalResult.probUp : signalResult.probDown
          const probText = (prob * 100).toFixed(1) + '%'

          if (isLegacyBingxEnabled()) {
            await safeExecuteBingxOpen(trade, actions, 'cron')
          }
          await queueBrokerPlatformSignal(trade, 'OPEN', signalResult.time, signalResult.close, actions)
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
