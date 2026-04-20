'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import type { Candle, AlgoTrendResult } from '@/lib/algotrend'
import type { Trade } from '@/lib/db'
import StatsPanel from './StatsPanel'
import TradeTable from './TradeTable'
import NotificationBell from './NotificationBell'
import InstallButton from './InstallButton'
import SponsorBanner from './SponsorBanner'

const Chart = dynamic(() => import('./Chart'), { ssr: false })

// ── Bitstamp config ──────────────────────────────────────────────────────────
const PAIR = 'btcusd'
const STEP = 3600          // 1H in seconds
const REST_URL = `https://www.bitstamp.net/api/v2/ohlc/${PAIR}/?step=${STEP}&limit=1000`
const WS_URL = 'wss://ws.bitstamp.net'
const HISTORY_BATCHES = 5   // 5000 candles to satisfy Pine window_size=1000 pipeline

// Bitstamp OHLC REST response
interface BitstampOhlcEntry {
  timestamp: string
  open: string; high: string; low: string; close: string; volume: string
}
interface BitstampOhlcResponse {
  data: { pair: string; ohlc: BitstampOhlcEntry[] }
}

// Bitstamp WebSocket trade message
interface BitstampTradeData {
  id: number; timestamp: string
  amount: number; price: number; type: number
}
interface BitstampWsMsg {
  event: string; channel: string
  data: BitstampTradeData | Record<string, unknown>
}

interface TradesResponse {
  trades: Trade[]
  openTrade: Trade | null
  stats: { total: number; wins: number; winRate: number; totalPnl: number; balance: number }
}

const DEFAULT_STATS: TradesResponse['stats'] = {
  total: 0,
  wins: 0,
  winRate: 0,
  totalPnl: 0,
  balance: 10000,
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function normalizeTradesResponse(raw: unknown): TradesResponse {
  const data = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const trades = Array.isArray(data.trades) ? data.trades as Trade[] : []

  const openTradeCandidate = data.openTrade
  const openTrade = openTradeCandidate
    && typeof openTradeCandidate === 'object'
    && !Array.isArray(openTradeCandidate)
    && Object.keys(openTradeCandidate as Record<string, unknown>).length > 0
      ? openTradeCandidate as Trade
      : null

  const statsCandidate = data.stats
  const stats = statsCandidate && typeof statsCandidate === 'object' && !Array.isArray(statsCandidate)
    ? {
        total: toFiniteNumber((statsCandidate as Record<string, unknown>).total, DEFAULT_STATS.total),
        wins: toFiniteNumber((statsCandidate as Record<string, unknown>).wins, DEFAULT_STATS.wins),
        winRate: toFiniteNumber((statsCandidate as Record<string, unknown>).winRate, DEFAULT_STATS.winRate),
        totalPnl: toFiniteNumber((statsCandidate as Record<string, unknown>).totalPnl, DEFAULT_STATS.totalPnl),
        balance: toFiniteNumber((statsCandidate as Record<string, unknown>).balance, DEFAULT_STATS.balance),
      }
    : DEFAULT_STATS

  return { trades, openTrade, stats }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseOhlc(entries: BitstampOhlcEntry[]): Candle[] {
  return entries.map(e => ({
    time: parseInt(e.timestamp),
    open: parseFloat(e.open),
    high: parseFloat(e.high),
    low: parseFloat(e.low),
    close: parseFloat(e.close),
    volume: parseFloat(e.volume),
  }))
}

async function fetchHistoricalCandles(): Promise<Candle[]> {
  // Bitstamp max limit=1000 per request — load multiple batches for Pine parity
  const batches: Candle[][] = []
  let nextEnd: number | null = null

  for (let i = 0; i < HISTORY_BATCHES; i++) {
    const url = nextEnd === null ? REST_URL : `${REST_URL}&end=${nextEnd}`
    const resp = await fetch(url).then(r => r.json()) as BitstampOhlcResponse
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
    .filter(c => seen.has(c.time) ? false : (seen.add(c.time), true))
    .sort((a, b) => a.time - b.time)
}

// Snap a unix timestamp to the start of its 1H candle
function hourFloor(ts: number): number {
  return Math.floor(ts / STEP) * STEP
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [candles, setCandles] = useState<Candle[]>([])
  const [results, setResults] = useState<AlgoTrendResult[]>([])
  const [liveCandle, setLiveCandle] = useState<Candle | null>(null)
  const [lastPrice, setLastPrice] = useState<number | null>(null)
  const [connected, setConnected] = useState(false)
  const [trades, setTrades] = useState<Trade[]>([])
  const [openTrade, setOpenTrade] = useState<Trade | null>(null)
  const [stats, setStats] = useState<TradesResponse['stats'] | null>(null)
  const [engineReady, setEngineReady] = useState(false)

  const engineRef = useRef<typeof import('@/lib/algotrend') | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const candlesRef = useRef<Candle[]>([])
  // Accumulate live candle from trades
  const liveCandleRef = useRef<Candle | null>(null)

  // Load engine module
  useEffect(() => {
    import('@/lib/algotrend').then(mod => {
      engineRef.current = mod
      setEngineReady(true)
    })
  }, [])

  const refreshTrades = useCallback(async () => {
    try {
      const res = await fetch('/api/trades', { cache: 'no-store' })
      const raw = await res.json()
      const data = normalizeTradesResponse(raw)
      setTrades(data.trades)
      setOpenTrade(data.openTrade)
      setStats(data.stats)
    } catch (err) {
      console.error('[refreshTrades]', err)
      setTrades([])
      setOpenTrade(null)
      setStats(DEFAULT_STATS)
    }
  }, [])

  const processCandle = useCallback(async (newCandle: Candle, isClosed: boolean) => {
    const eng = engineRef.current
    if (!eng) return

    const all = [...candlesRef.current]
    if (all.length > 0 && all[all.length - 1].time === newCandle.time) {
      all[all.length - 1] = newCandle
    } else {
      all.push(newCandle)
    }
    candlesRef.current = all

    const res = eng.runAlgoTrend(all)
    setResults(res)
    setLiveCandle({ ...newCandle })
    setLastPrice(newCandle.close)

    if (isClosed && res.length > 0) {
      const last = res[res.length - 1]
      const signal = last.longSig ? 'LONG' : last.shortSig ? 'SHORT' : null
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal, time: last.time, price: last.close,
          open: newCandle.open, high: newCandle.high, low: newCandle.low,
          stop: signal === 'LONG' ? last.longStop : last.shortStop,
          tp: signal === 'LONG' ? last.longTp : last.shortTp,
          probUp: last.probUp,
          probDown: last.probDown,
        }),
      })
      await refreshTrades()
    }
  }, [refreshTrades])

  // Handle a single Bitstamp trade tick → build live candle
  const handleTrade = useCallback((trade: BitstampTradeData) => {
    const price = trade.price
    const ts = parseInt(trade.timestamp)
    const hour = hourFloor(ts)

    const prev = liveCandleRef.current

    // Hour rolled over → close previous candle, start new one
    if (prev && prev.time !== hour) {
      processCandle({ ...prev }, true)   // close the finished candle
      liveCandleRef.current = null
    }

    if (!liveCandleRef.current) {
      // New candle — seed from last closed candle if available
      const lastClosed = candlesRef.current[candlesRef.current.length - 1]
      liveCandleRef.current = {
        time: hour,
        open: lastClosed?.close ?? price,
        high: price,
        low: price,
        close: price,
        volume: trade.amount,
      }
    } else {
      liveCandleRef.current = {
        ...liveCandleRef.current,
        high: Math.max(liveCandleRef.current.high, price),
        low: Math.min(liveCandleRef.current.low, price),
        close: price,
        volume: liveCandleRef.current.volume + trade.amount,
      }
    }

    processCandle({ ...liveCandleRef.current }, false)
  }, [processCandle])

  // Bootstrap: load history + run engine + backfill if no trades
  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const hist = await fetchHistoricalCandles()
        if (!mounted) return

        candlesRef.current = hist
        setCandles(hist)

        // Check if there are existing trades; if not, run backfill first
        const tradesRes = await fetch('/api/trades', { cache: 'no-store' })
        const raw = await tradesRes.json()
        const tradesData = normalizeTradesResponse(raw)

        if (tradesData.trades.length === 0) {
          await fetch('/api/backfill', { method: 'POST' })
        }

        await refreshTrades()
        if (!mounted) return

        let waited = 0
        const poll = setInterval(() => {
          if (!mounted || engineRef.current || waited > 8000) {
            clearInterval(poll)
            if (mounted && engineRef.current) setResults(engineRef.current.runAlgoTrend(hist))
          }
          waited += 100
        }, 100)
      } catch (err) {
        console.error('[bootstrap]', err)
      }
    })()

    return () => { mounted = false }
  }, [refreshTrades])

  // Re-run engine once module loads
  useEffect(() => {
    if (engineReady && candlesRef.current.length > 0) {
      setResults(engineRef.current!.runAlgoTrend(candlesRef.current))
    }
  }, [engineReady])

  // Bitstamp WebSocket — live trades
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>

    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        ws.send(JSON.stringify({
          event: 'bts:subscribe',
          data: { channel: `live_trades_${PAIR}` },
        }))
      }

      ws.onclose = () => {
        setConnected(false)
        retryTimer = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()

      ws.onmessage = (ev: MessageEvent) => {
        const msg = JSON.parse(ev.data as string) as BitstampWsMsg
        if (msg.event === 'trade') {
          handleTrade(msg.data as BitstampTradeData)
        }
      }
    }

    connect()
    return () => { clearTimeout(retryTimer); wsRef.current?.close() }
  }, [handleTrade])

  // Poll trades every 30s
  useEffect(() => {
    const t = setInterval(refreshTrades, 30_000)
    return () => clearInterval(t)
  }, [refreshTrades])

  const lastResult = results[results.length - 1] ?? null
  const totalSignals = results.filter(r => r.longSig || r.shortSig).length
  const closedTrades = trades.filter(t => t.status === 'CLOSED').length
  const marketBias = lastResult
    ? lastResult.probUp >= lastResult.probDown ? 'Sesgo alcista' : 'Sesgo bajista'
    : 'Sin sesgo'
  const marketBiasColor = !lastResult
    ? 'text-[#9CA3AF]'
    : lastResult.probUp >= lastResult.probDown
      ? 'text-[#22C55E] value-glow'
      : 'text-[#EF4444] value-glow'

  return (
    <div className="app-shell min-h-screen px-3 py-4 text-[#E5E7EB] sm:px-6 sm:py-6 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-gradient-to-b from-[#111827] via-[#0B1220]/70 to-transparent" />

      <div className="relative mx-auto flex max-w-[1560px] flex-col gap-4 sm:gap-5">
        <header className="surface-panel reveal-up px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111827] shadow-[0_8px_20px_rgba(0,0,0,0.3)] border border-[#1f2937] overflow-hidden">
                <img src="/logo-algotrend.png" alt="IA AlgoTrend" className="h-9 w-9 object-contain" />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-[#289eff]" />
                  <p className="label-eyebrow">🧠 IA AlgoTrend en Vivo</p>
                </div>
                <h1 className="text-[1.65rem] leading-tight text-[#E5E7EB] sm:text-[2rem]">
                  Mesa de Trading BTC 1H
                </h1>
                <p className="max-w-2xl text-sm text-[#9CA3AF] sm:text-[0.95rem]">
                  Monitor de ejecución de Algoritmos Inteligentes con stream en vivo de Bitstamp e historial automático de operaciones.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="badge">
                    Parámetros por defecto
                  </span>
                  <span className="badge">
                    {totalSignals} señales históricas
                  </span>
                  <span className={`badge inline-flex items-center gap-1.5 ${connected ? 'badge-live' : 'badge-danger'}`}>
                    {connected && <span className="live-dot" />}
                    {connected ? 'Stream en vivo' : 'Reconectando stream'}
                  </span>
                  <span className="badge">
                    Algoritmo: Probabilidad IA
                  </span>
                  <InstallButton />
                  <NotificationBell />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.25fr_repeat(3,minmax(110px,1fr))]">
              <div className="surface-panel-muted min-w-[150px] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Precio BTC</p>
                <p className="mt-1 font-mono text-[1.75rem] font-semibold text-[#E5E7EB] value-glow">
                  {lastPrice ? `$${lastPrice.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...'}
                </p>
              </div>
              <div className="surface-panel-muted min-w-[110px] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Capital inicial</p>
                <p className="mt-1 font-mono text-[1.05rem] font-semibold text-[#E5E7EB]">$10,000</p>
              </div>
              <div className="surface-panel-muted min-w-[110px] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Operaciones cerradas</p>
                <p className="mt-1 font-mono text-[1.05rem] font-semibold text-[#E5E7EB]">{closedTrades}</p>
              </div>
              <div className="surface-panel-muted min-w-[110px] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Sesgo de mercado</p>
                <p className={`mt-1 text-[1rem] font-semibold ${marketBiasColor}`}>{marketBias}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Row 1, Col 1: Chart & Sponsor */}
          <div className="reveal-up reveal-delay-1 xl:col-span-1 xl:row-start-1 flex flex-col gap-4">
            <SponsorBanner />
            <Chart 
              candles={candles} 
              results={results} 
              liveCandle={liveCandle} 
              trades={trades}
              openTrade={openTrade}
            />
          </div>

          {/* Sidebar / Mobile Middle: StatsPanel (Engine, Perf, Risk, Params) */}
          <div className="reveal-up reveal-delay-3 xl:col-start-2 xl:row-start-1 xl:row-span-2">
            <StatsPanel stats={stats} engine={lastResult} connected={connected} lastPrice={lastPrice} />
          </div>

          {/* Mobile Bottom / Desktop Below Chart: TradeTable */}
          <div className="reveal-up reveal-delay-2 xl:col-start-1 xl:row-start-2">
            <TradeTable trades={trades} openTrade={openTrade} currentPrice={lastPrice} />
          </div>
        </div>

        {!engineReady && (
          <div className="surface-panel-muted px-4 py-2.5 text-center text-xs font-medium text-[#9CA3AF]">
            Inicializando motor de IA...
          </div>
        )}
      </div>
    </div>
  )
}
