'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Time,
} from 'lightweight-charts'
import type { Candle } from '@/lib/algotrend'
import type { AlgoTrendResult } from '@/lib/algotrend'

interface ChartProps {
  candles: Candle[]
  results: AlgoTrendResult[]
  liveCandle: Candle | null
}

export default function Chart({ candles, results, liveCandle }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  const candleRef    = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const stBullRef    = useRef<ISeriesApi<'Line'> | null>(null)
  const stBearRef    = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#080812' }, textColor: '#9ca3af' },
      grid:   { vertLines: { color: '#111128' }, horzLines: { color: '#111128' } },
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#1f2937' },
      rightPriceScale: { borderColor: '#1f2937' },
      width:  containerRef.current.clientWidth,
      height: 480,
    })
    chartRef.current = chart

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#00e676', downColor: '#ff1744',
      borderUpColor: '#00e676', borderDownColor: '#ff1744',
      wickUpColor: '#00e676', wickDownColor: '#ff1744',
    })

    // SuperTrend bullish line (blue)
    stBullRef.current = chart.addSeries(LineSeries, {
      color: '#289eff', lineWidth: 2,
      lastValueVisible: false, priceLineVisible: false,
      lineStyle: 0,
    })

    // SuperTrend bearish line (pink/red)
    stBearRef.current = chart.addSeries(LineSeries, {
      color: '#ce3f6c', lineWidth: 2,
      lastValueVisible: false, priceLineVisible: false,
      lineStyle: 0,
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, [])

  // Update data when results change
  useEffect(() => {
    if (!candleRef.current || !candles.length || !results.length) return

    candleRef.current.setData(
      candles.map(c => ({
        time: c.time as Time,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })) as CandlestickData[]
    )

    // Split SuperTrend into bullish and bearish segments (NaN gap = line break)
    const bullData: LineData[] = []
    const bearData: LineData[] = []

    for (const r of results) {
      if (isNaN(r.supertrend) || isNaN(r.stDirection)) continue
      if (r.stDirection < 0) {
        bullData.push({ time: r.time as Time, value: r.supertrend })
      } else {
        bearData.push({ time: r.time as Time, value: r.supertrend })
      }
    }

    stBullRef.current?.setData(bullData)
    stBearRef.current?.setData(bearData)

    chartRef.current?.timeScale().scrollToRealTime()
  }, [candles, results])

  // Live candle tick
  useEffect(() => {
    if (!candleRef.current || !liveCandle) return
    candleRef.current.update({
      time:  liveCandle.time as Time,
      open:  liveCandle.open,
      high:  liveCandle.high,
      low:   liveCandle.low,
      close: liveCandle.close,
    })
  }, [liveCandle])

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden border border-[#1a1a30]" />
}
