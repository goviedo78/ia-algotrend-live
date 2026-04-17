'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Candle, AlgoTrendResult } from '@/lib/algotrend'
import type { Trade } from '@/lib/db'
import StatsPanel from './StatsPanel'
import TradeTable from './TradeTable'

const Chart = dynamic(() => import('./Chart'), { ssr: false })

// ── Bitstamp config ──────────────────────────────────────────────────────────
const PAIR     = 'btcusd'
const STEP     = 3600          // 1H in seconds
const REST_URL = `https://www.bitstamp.net/api/v2/ohlc/${PAIR}/?step=${STEP}&limit=1000`
const WS_URL   = 'wss://ws.bitstamp.net'

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseOhlc(entries: BitstampOhlcEntry[]): Candle[] {
  return entries.map(e => ({
    time:   parseInt(e.timestamp),
    open:   parseFloat(e.open),
    high:   parseFloat(e.high),
    low:    parseFloat(e.low),
    close:  parseFloat(e.close),
    volume: parseFloat(e.volume),
  }))
}

async function fetchHistoricalCandles(): Promise<Candle[]> {
  // Bitstamp max limit=1000 per request — fetch 2 batches for ~2000 candles
  const r1   = await fetch(REST_URL).then(r => r.json()) as BitstampOhlcResponse
  const ohlc1 = r1.data.ohlc
  const oldest = parseInt(ohlc1[0].timestamp)

  const r2 = await fetch(`${REST_URL}&end=${oldest - 1}`).then(r => r.json()) as BitstampOhlcResponse
  const ohlc2 = r2.data.ohlc

  const all  = [...parseOhlc(ohlc2), ...parseOhlc(ohlc1)]
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
  const [candles,     setCandles]     = useState<Candle[]>([])
  const [results,     setResults]     = useState<AlgoTrendResult[]>([])
  const [liveCandle,  setLiveCandle]  = useState<Candle | null>(null)
  const [lastPrice,   setLastPrice]   = useState<number | null>(null)
  const [connected,   setConnected]   = useState(false)
  const [trades,      setTrades]      = useState<Trade[]>([])
  const [openTrade,   setOpenTrade]   = useState<Trade | null>(null)
  const [stats,       setStats]       = useState<TradesResponse['stats'] | null>(null)
  const [engineReady, setEngineReady] = useState(false)

  const engineRef    = useRef<typeof import('@/lib/algotrend') | null>(null)
  const wsRef        = useRef<WebSocket | null>(null)
  const candlesRef   = useRef<Candle[]>([])
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
    const res  = await fetch('/api/trades')
    const data = await res.json() as TradesResponse
    setTrades(data.trades)
    setOpenTrade(data.openTrade)
    setStats(data.stats)
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
      const last   = res[res.length - 1]
      const signal = last.longSig ? 'LONG' : last.shortSig ? 'SHORT' : null
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal, time: last.time, price: last.close,
          stop: signal === 'LONG' ? last.longStop  : last.shortStop,
          tp:   signal === 'LONG' ? last.longTp    : last.shortTp,
        }),
      })
      await refreshTrades()
    }
  }, [refreshTrades])

  // Handle a single Bitstamp trade tick → build live candle
  const handleTrade = useCallback((trade: BitstampTradeData) => {
    const price = trade.price
    const ts    = parseInt(trade.timestamp)
    const hour  = hourFloor(ts)

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
        time:   hour,
        open:   lastClosed?.close ?? price,
        high:   price,
        low:    price,
        close:  price,
        volume: trade.amount,
      }
    } else {
      liveCandleRef.current = {
        ...liveCandleRef.current,
        high:   Math.max(liveCandleRef.current.high, price),
        low:    Math.min(liveCandleRef.current.low,  price),
        close:  price,
        volume: liveCandleRef.current.volume + trade.amount,
      }
    }

    processCandle({ ...liveCandleRef.current }, false)
  }, [processCandle])

  // Bootstrap: load history + run engine
  useEffect(() => {
    fetchHistoricalCandles().then(hist => {
      candlesRef.current = hist
      setCandles(hist)
      refreshTrades()

      let waited = 0
      const poll = setInterval(() => {
        if (engineRef.current || waited > 8000) {
          clearInterval(poll)
          if (engineRef.current) setResults(engineRef.current.runAlgoTrend(hist))
        }
        waited += 100
      }, 100)
    })
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
          data:  { channel: `live_trades_${PAIR}` },
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

  const lastResult    = results[results.length - 1] ?? null
  const totalSignals  = results.filter(r => r.longSig || r.shortSig).length

  return (
    <div className="min-h-screen bg-[#050510] text-white p-4 space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#289eff] font-bold text-lg tracking-widest">🤖 IA AlgoTrend — BTC 1H</h1>
          <p className="text-[#4a5a6a] text-xs">
            SuperTrend + KNN · Cripto Intraday · Paper Trading Live
            {totalSignals > 0 && <span className="ml-2 text-yellow-400">{totalSignals} señales históricas</span>}
          </p>
        </div>
        <div className="text-right text-xs text-[#4a5a6a]">
          <div>Capital: <span className="text-white font-mono">$10,000 USDT</span></div>
          <div className={connected ? 'text-[#00e676]' : 'text-gray-600'}>
            {connected ? '● Bitstamp WebSocket activo' : '○ Reconectando...'}
          </div>
          {!engineReady && <div className="text-yellow-500 animate-pulse">⏳ Cargando KNN...</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">
        <div className="space-y-4">
          <Chart candles={candles} results={results} liveCandle={liveCandle} />
          <TradeTable trades={trades} openTrade={openTrade} currentPrice={lastPrice} />
        </div>
        <StatsPanel stats={stats} engine={lastResult} connected={connected} lastPrice={lastPrice} />
      </div>

    </div>
  )
}
