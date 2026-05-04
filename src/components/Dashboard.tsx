'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Candle, AlgoTrendResult } from '@/lib/algotrend'
import type { Trade } from '@/lib/db'
import StatsPanel from './StatsPanel'
import TradeTable from './TradeTable'
import NotificationBell from './NotificationBell'
import InstallButton from './InstallButton'
import SponsorBanner from './SponsorBanner'
import GonSignature from './brand/GonSignature'
import GonEmblem3D from './brand/GonEmblem3D'
import ShareButton from './ShareButton'

const Chart = dynamic(() => import('./Chart'), { ssr: false })
const MateriaLogo = dynamic(() => import('./brand/MateriaLogo').then(mod => mod.MateriaLogo), { ssr: false })

// ── Bitstamp config ──────────────────────────────────────────────────────────
const PAIR = 'btcusd'
const STEP = 3600          // 1H in seconds
const REST_URL = `https://www.bitstamp.net/api/v2/ohlc/${PAIR}/?step=${STEP}&limit=1000`
const WS_URL = 'wss://ws.bitstamp.net'
const HISTORY_BATCHES = 5   // 5000 candles to satisfy Pine window_size=1000 pipeline

const HOME_MATERIA_LIGHTS = [
  { type: 'ambient' as const, color: 0x1b120d, intensity: 0.48 },
  { type: 'directional' as const, color: 0xf44e1c, intensity: 1.85, position: [0, 90, -520] as [number, number, number] },
  { type: 'directional' as const, color: 0xff6a21, intensity: 0.95, position: [-320, 360, 520] as [number, number, number] },
  { type: 'directional' as const, color: 0xf2dfc3, intensity: 0.32, position: [460, -120, 260] as [number, number, number] },
]

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
  const headerRef = useRef<HTMLElement>(null)

  // Analytics: track pageview on mount
  useEffect(() => {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/', referrer: document.referrer || '' }),
    }).catch(() => {})
  }, [])

  // Scroll-collapse: shrink header after 60px scroll
  useEffect(() => {
    const onScroll = () => {
      if (headerRef.current) {
        headerRef.current.dataset.scrolled = window.scrollY > 60 ? 'true' : 'false'
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
  const initialCapital = 10000
  const currentBalance = stats?.balance ?? initialCapital
  const returnPct = ((currentBalance - initialCapital) / initialCapital) * 100
  const returnPctColor = returnPct >= 0 ? 'text-[#4FBC72]' : 'text-[#F44E1C]'
  const winRate = stats?.winRate ?? 0
  const winRateColor = winRate >= 50 ? 'text-[#4FBC72]' : 'text-[#F44E1C]'
  const marketBias = lastResult
    ? lastResult.probUp >= lastResult.probDown ? 'Sesgo alcista' : 'Sesgo bajista'
    : 'Sin sesgo'
  const marketBiasColor = !lastResult
    ? 'text-[#A8AABA]'
    : lastResult.probUp >= lastResult.probDown
      ? 'text-[#4FBC72] value-glow'   // warm green
      : 'text-[#F44E1C] value-glow'   // GON pulse

  return (
    <div className="app-shell relative isolate min-h-screen px-3 py-4 font-sans text-[#E5D4B6] sm:px-6 sm:py-6 lg:px-10">
      <div className="pointer-events-none fixed inset-0 -z-20 opacity-[0.22] mix-blend-screen [mask-image:radial-gradient(circle_at_50%_22%,black_0%,black_34%,transparent_72%)]">
        <MateriaLogo
          amplitude={5}
          autoRotateIdle
          baseColor={0x120d0a}
          bloomIntensity={0.42}
          cameraDistance={2050}
          cursorTilt={false}
          enableZoom={false}
          environmentIntensity={0.2}
          height="100vh"
          heatColor={[0.96, 0.31, 0.11]}
          heatEmissive={[1, 0.28, 0.04]}
          heatEmissiveStrength={2.6}
          heatTintStrength={1.4}
          idleDelay={0}
          lights={HOME_MATERIA_LIGHTS}
          material={{
            clearcoat: 0.36,
            clearcoatRoughness: 0.38,
            reflectivity: 0.08,
            roughness: 0.48,
          }}
          preset="brasa"
          style={{ pointerEvents: 'none' }}
          toneMappingExposure={0.92}
          transparentBackground
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] bg-[radial-gradient(circle_at_50%_0%,rgba(244,78,28,0.15),transparent_22rem),radial-gradient(circle_at_78%_8%,rgba(248,218,194,0.10),transparent_20rem),linear-gradient(180deg,#1C223A,rgba(17,22,42,0)_86%)]" />

      <div className="relative mx-auto flex max-w-[1560px] flex-col gap-4 sm:gap-5">
        <div className="gon-eyebrow-strip reveal-up">
          <span className="gon-strip-chip">GONOVI · ALGOTREND</span>
          <span className="gon-strip-accent">BTC 1H</span>
          <span className="live-tag">LIVE</span>
        </div>

        <header ref={headerRef} className="glass-header reveal-up rounded-xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="header-shell flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="header-brand flex items-start gap-4">
              <div className="header-logo flex-shrink-0">
                <GonEmblem3D size={56} />
              </div>

              <div className="header-copy flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-[#F44E1C]" />
                  <p className="label-eyebrow accent-underline">IA AlgoTrend · en vivo</p>
                </div>
                <h1 className="header-title font-display text-[1.65rem] font-semibold leading-tight text-[#E5D4B6] sm:text-[2rem]">
                  AlgoTrend Live Desk
                </h1>
                <p className="header-description max-w-2xl text-sm text-[#A8AABA] sm:text-[0.95rem]">
                  Monitor probabilístico BTC 1H con stream Bitstamp, señales activas e historial automático de operaciones.
                </p>
                <div className="header-actions flex flex-wrap gap-2">
                  <span className="badge badge-pastel">
                    Parámetros por defecto
                  </span>
                  <span className="badge">
                    {totalSignals} señales históricas
                  </span>
                  <span className={`badge inline-flex items-center gap-1.5 ${connected ? 'badge-live' : 'badge-danger'}`}>
                    {connected && <span className="live-dot" />}
                    {connected ? 'Stream en vivo' : 'Reconectando stream'}
                  </span>
                  <InstallButton />
                  <NotificationBell />
                  <ShareButton
                    price={lastPrice}
                    winRate={winRate}
                    returnPct={returnPct}
                    balance={currentBalance}
                    totalTrades={closedTrades}
                  />
                </div>
              </div>
            </div>

            <div className="header-stats-grid flex gap-3 overflow-x-auto pb-1 xl:grid xl:grid-cols-[1.35fr_repeat(3,minmax(120px,1fr))] xl:overflow-visible xl:pb-0">
              <div className="header-summary-card header-summary-card-featured surface-panel-muted min-w-[210px] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7385]">Precio BTC</p>
                <p className="mt-1 font-mono text-[1.75rem] font-semibold text-[#E5D4B6]">
                  {lastPrice ? `$${lastPrice.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...'}
                </p>
              </div>
              <div className="header-summary-card surface-panel-muted min-w-[132px] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7385]">WR</p>
                <p className={`mt-1 font-mono text-[1.2rem] font-semibold ${winRateColor}`}>
                  {winRate.toFixed(1)}%
                </p>
              </div>
              <div className="header-summary-card surface-panel-muted min-w-[150px] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7385]">Ganancia</p>
                <p className={`mt-1 font-mono text-[1.2rem] font-semibold ${returnPctColor}`}>
                  {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                </p>
              </div>
              <div className="header-summary-card surface-panel-muted min-w-[170px] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7385]">Sesgo de mercado</p>
                <p className={`mt-1 text-[1rem] font-semibold ${marketBiasColor}`}>{marketBias}</p>
                <p className="mt-1 font-mono text-[10px] text-[#6B7385]">{closedTrades} cerradas</p>
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
          <div className="surface-panel-muted px-4 py-2.5 text-center text-xs font-medium text-[#A8AABA]">
            Inicializando motor de IA...
          </div>
        )}

        <footer className="mt-6 flex justify-end pb-4 pr-1">
          {/* href={null} = sello visual sin link, las rutas /brand quedan
              accesibles solo si alguien teclea la URL directamente. */}
          <GonSignature href={null} label="By GONOVI" />
        </footer>
      </div>
    </div>
  )
}
