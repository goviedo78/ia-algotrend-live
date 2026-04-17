'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Candle, AlgoTrendResult } from '@/lib/algotrend'
import type { Trade } from '@/lib/db'
import StatsPanel from './StatsPanel'
import TradeTable from './TradeTable'

const Chart = dynamic(() => import('./Chart'), { ssr: false })

const SYMBOL   = 'BTCUSDT'
const INTERVAL = '1h'
const WS_URL   = `wss://stream.binance.com:9443/ws/${SYMBOL.toLowerCase()}@kline_${INTERVAL}`
const REST_BASE = `https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=${INTERVAL}&limit=1000`

interface BinanceKline {
  t: number; o: string; h: string; l: string; c: string; v: string; x: boolean
}
interface BinanceWsMsg { k: BinanceKline }
interface TradesResponse {
  trades: Trade[]
  openTrade: Trade | null
  stats: { total: number; wins: number; winRate: number; totalPnl: number; balance: number }
}

function parseKlines(data: number[][]): Candle[] {
  return data.map(d => ({
    time:   Math.floor(d[0] / 1000),
    open:   parseFloat(d[1] as unknown as string),
    high:   parseFloat(d[2] as unknown as string),
    low:    parseFloat(d[3] as unknown as string),
    close:  parseFloat(d[4] as unknown as string),
    volume: parseFloat(d[5] as unknown as string),
  }))
}

async function fetchHistoricalCandles(): Promise<Candle[]> {
  // Fetch 2000 candles across two requests (need 1200+ for double normalization with window=600)
  const recent = await fetch(`${REST_BASE}`).then(r => r.json()) as number[][]
  const oldest  = recent[0][0]  // timestamp of oldest candle in first batch
  const older   = await fetch(`${REST_BASE}&endTime=${oldest - 1}`).then(r => r.json()) as number[][]

  const all = [...parseKlines(older), ...parseKlines(recent)]
  // Deduplicate by time
  const seen = new Set<number>()
  return all.filter(c => seen.has(c.time) ? false : (seen.add(c.time), true))
    .sort((a, b) => a.time - b.time)
}

export default function Dashboard() {
  const [candles,    setCandles]    = useState<Candle[]>([])
  const [results,    setResults]    = useState<AlgoTrendResult[]>([])
  const [liveCandle, setLiveCandle] = useState<Candle | null>(null)
  const [lastPrice,  setLastPrice]  = useState<number | null>(null)
  const [connected,  setConnected]  = useState(false)
  const [trades,     setTrades]     = useState<Trade[]>([])
  const [openTrade,  setOpenTrade]  = useState<Trade | null>(null)
  const [stats,      setStats]      = useState<TradesResponse['stats'] | null>(null)
  const [engineReady, setEngineReady] = useState(false)

  const engineRef  = useRef<typeof import('@/lib/algotrend') | null>(null)
  const wsRef      = useRef<WebSocket | null>(null)
  const candlesRef = useRef<Candle[]>([])

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

  const processNewCandle = useCallback(async (newCandle: Candle, isClosed: boolean) => {
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
    setLiveCandle(newCandle)
    setLastPrice(newCandle.close)

    if (isClosed && res.length > 0) {
      const last = res[res.length - 1]
      const signal = last.longSig ? 'LONG' : last.shortSig ? 'SHORT' : null

      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal,
          time:  last.time,
          price: last.close,
          stop:  signal === 'LONG' ? last.longStop  : last.shortStop,
          tp:    signal === 'LONG' ? last.longTp    : last.shortTp,
        }),
      })
      await refreshTrades()
    }
  }, [refreshTrades])

  // Bootstrap: historical data + initial engine run
  useEffect(() => {
    fetchHistoricalCandles().then(hist => {
      candlesRef.current = hist
      setCandles(hist)
      refreshTrades()

      let waited = 0
      const poll = setInterval(() => {
        if (engineRef.current || waited > 8000) {
          clearInterval(poll)
          if (engineRef.current) {
            const res = engineRef.current.runAlgoTrend(hist)
            setResults(res)
          }
        }
        waited += 100
      }, 100)
    })
  }, [refreshTrades])

  // Re-run engine when it loads (if candles already fetched)
  useEffect(() => {
    if (engineReady && candlesRef.current.length > 0) {
      const res = engineRef.current!.runAlgoTrend(candlesRef.current)
      setResults(res)
    }
  }, [engineReady])

  // WebSocket
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>

    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen  = () => setConnected(true)
      ws.onclose = () => { setConnected(false); retryTimer = setTimeout(connect, 3000) }
      ws.onerror = () => ws.close()
      ws.onmessage = (ev: MessageEvent) => {
        const msg = JSON.parse(ev.data as string) as BinanceWsMsg
        const k   = msg.k
        processNewCandle({
          time:   Math.floor(k.t / 1000),
          open:   parseFloat(k.o), high: parseFloat(k.h),
          low:    parseFloat(k.l), close: parseFloat(k.c),
          volume: parseFloat(k.v),
        }, k.x)
      }
    }

    connect()
    return () => { clearTimeout(retryTimer); wsRef.current?.close() }
  }, [processNewCandle])

  // Poll trades every 30s
  useEffect(() => {
    const t = setInterval(refreshTrades, 30_000)
    return () => clearInterval(t)
  }, [refreshTrades])

  const lastResult = results.length > 0 ? results[results.length - 1] : null

  // Signal counts from results
  const totalSignals = results.filter(r => r.longSig || r.shortSig).length

  return (
    <div className="min-h-screen bg-[#050510] text-white p-4 space-y-4">

      {/* Header */}
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
            {connected ? '● Binance WebSocket activo' : '○ Reconectando...'}
          </div>
          {!engineReady && (
            <div className="text-yellow-500 animate-pulse">⏳ Cargando KNN...</div>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">
        <div className="space-y-4">
          <Chart candles={candles} results={results} liveCandle={liveCandle} />
          <TradeTable trades={trades} openTrade={openTrade} currentPrice={lastPrice} />
        </div>
        <StatsPanel
          stats={stats}
          engine={lastResult}
          connected={connected}
          lastPrice={lastPrice}
        />
      </div>

    </div>
  )
}
